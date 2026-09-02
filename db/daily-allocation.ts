export type DailyAllocation = {
  date: string;
  minutes: number;
};

export type DailyAllocationErrorCode =
  | "INVALID_DAILY_ALLOCATION"
  | "DUPLICATE_DAY"
  | "DAY_OUTSIDE_PERIOD"
  | "DAILY_TOTAL_MISMATCH";

export type DailyAllocationResult =
  | { ok: true; days: DailyAllocation[] }
  | { ok: false; code: DailyAllocationErrorCode; field: "days" };

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isDailyAllocation(value: unknown): value is DailyAllocation {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return isIsoDate(row.date)
    && Number.isInteger(row.minutes)
    && Number(row.minutes) > 0
    && Number(row.minutes) <= 1_440;
}

export function validateDailyAllocation(input: {
  startDate: unknown;
  endDate: unknown;
  totalMinutes: unknown;
  days: unknown;
}): DailyAllocationResult {
  if (!isIsoDate(input.startDate)
      || !isIsoDate(input.endDate)
      || input.startDate > input.endDate
      || !Number.isInteger(input.totalMinutes)
      || Number(input.totalMinutes) <= 0
      || !Array.isArray(input.days)
      || input.days.length === 0
      || !input.days.every(isDailyAllocation)) {
    return { ok: false, code: "INVALID_DAILY_ALLOCATION", field: "days" };
  }

  const days = [...input.days].sort((left, right) => left.date.localeCompare(right.date));
  if (new Set(days.map((day) => day.date)).size !== days.length) {
    return { ok: false, code: "DUPLICATE_DAY", field: "days" };
  }
  if (days.some((day) => day.date < input.startDate || day.date > input.endDate)) {
    return { ok: false, code: "DAY_OUTSIDE_PERIOD", field: "days" };
  }
  const allocatedMinutes = days.reduce((total, day) => total + day.minutes, 0);
  if (allocatedMinutes !== input.totalMinutes) {
    return { ok: false, code: "DAILY_TOTAL_MISMATCH", field: "days" };
  }
  return { ok: true, days };
}

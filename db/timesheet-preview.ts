export type TimesheetPreviewState = "READY" | "NEEDS_REVIEW" | "CLOSED";

export type TimesheetBlockerCode =
  | "PENDING_LEAVE"
  | "PENDING_OCCURRENCE"
  | "PENDING_NON_BUSINESS_AUTH"
  | "INCOMPLETE_DAILY_ALLOCATION"
  | "NO_ENTRIES"
  | "ALREADY_CLOSED";

export type TimesheetBlocker = {
  code: TimesheetBlockerCode;
  message: string;
  action: string;
};

export type TimesheetWarning = {
  code: string;
  message: string;
};

export type TimesheetPreview = {
  organizationId: string;
  contractorId: string;
  year: number;
  month: number;
  state: TimesheetPreviewState;
  workedMinutes: number;
  occurrenceMinutes: number;
  leaveMinutes: number;
  creditedMinutes: number;
  consideredMinutes: number;
  requiredMinutes: number;
  projectedBalanceMinutes: number;
  bankImpact: {
    direction: "CREDIT" | "DEBIT" | "NONE";
    minutes: number;
  };
  blockers: TimesheetBlocker[];
  warnings: TimesheetWarning[];
  reviewVersion: string;
};

const blockerCodes = new Set<TimesheetBlockerCode>([
  "PENDING_LEAVE",
  "PENDING_OCCURRENCE",
  "PENDING_NON_BUSINESS_AUTH",
  "INCOMPLETE_DAILY_ALLOCATION",
  "NO_ENTRIES",
  "ALREADY_CLOSED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isBlocker(value: unknown): value is TimesheetBlocker {
  if (!isRecord(value)) return false;
  return typeof value.code === "string"
    && blockerCodes.has(value.code as TimesheetBlockerCode)
    && typeof value.message === "string"
    && typeof value.action === "string";
}

function isWarning(value: unknown): value is TimesheetWarning {
  return isRecord(value)
    && typeof value.code === "string"
    && typeof value.message === "string";
}

export function normalizeTimesheetPreview(value: unknown): TimesheetPreview {
  if (!isRecord(value)) throw new Error("Invalid timesheet preview");

  const state = value.state;
  const bankImpact = value.bankImpact;
  const numericFields = [
    value.year,
    value.month,
    value.workedMinutes,
    value.occurrenceMinutes,
    value.leaveMinutes,
    value.creditedMinutes,
    value.consideredMinutes,
    value.requiredMinutes,
    value.projectedBalanceMinutes,
  ];

  if (typeof value.organizationId !== "string"
      || typeof value.contractorId !== "string"
      || !isInteger(value.year)
      || !isInteger(value.month)
      || Number(value.month) < 1
      || Number(value.month) > 12
      || !numericFields.every(isInteger)
      || !["READY", "NEEDS_REVIEW", "CLOSED"].includes(String(state))
      || !isRecord(bankImpact)
      || !["CREDIT", "DEBIT", "NONE"].includes(String(bankImpact.direction))
      || !isInteger(bankImpact.minutes)
      || !Array.isArray(value.blockers)
      || !value.blockers.every(isBlocker)
      || !Array.isArray(value.warnings)
      || !value.warnings.every(isWarning)
      || typeof value.reviewVersion !== "string"
      || value.reviewVersion.length === 0) {
    throw new Error("Invalid timesheet preview");
  }

  return value as TimesheetPreview;
}

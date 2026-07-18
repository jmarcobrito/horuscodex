export type TimeCalculation = {
  startMinutes: number;
  endMinutes: number;
  workedMinutes: number;
};

function parseTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateWorkedMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): TimeCalculation | null {
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    !Number.isInteger(breakMinutes) ||
    breakMinutes < 0 ||
    endMinutes <= startMinutes
  ) {
    return null;
  }

  const workedMinutes = endMinutes - startMinutes - breakMinutes;
  if (workedMinutes <= 0 || workedMinutes > 1_440) return null;

  return { startMinutes, endMinutes, workedMinutes };
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function civilDate(instant: string, timeZone: string): string | null {
  if (!timeZone) throw new Error("Fuso horário da organização não informado.");
  // Construct first: an invalid organization timezone is a configuration error,
  // even when the supplied timestamp is also unavailable.
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  if (!validCalendarDate(instant.slice(0, 10)) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(instant)) return null;
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}

export function registrationDelayDays(workDate: string, createdAt: string, timeZone: string): number | null {
  const registered = civilDate(createdAt, timeZone);
  if (!registered || !validCalendarDate(workDate)) return null;
  return Math.max(0, Math.round((Date.parse(registered + "T00:00:00Z") - Date.parse(workDate + "T00:00:00Z")) / 86_400_000));
}

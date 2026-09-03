import type { DashboardPeriod } from "./dashboard-types";

export function monthPeriod(year: number, month: number): DashboardPeriod {
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) throw Error("Mês inválido");
  const prefix = year + "-" + String(month).padStart(2, "0");
  return { from: prefix + "-01", to: prefix + "-" + new Date(Date.UTC(year, month, 0)).getUTCDate(), year, month };
}
export function parseMonthValue(value: string): DashboardPeriod | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  try { return monthPeriod(year, month); } catch { return null; }
}
export function validPeriodDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 2000 && year <= 2200 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function asFullMonth(period: DashboardPeriod): DashboardPeriod | null {
  const candidate = parseMonthValue(period.from.slice(0, 7));
  return candidate && samePeriod(candidate, period) ? candidate : null;
}
export function shiftMonth(period: DashboardPeriod, offset: number): DashboardPeriod | null {
  const base = asFullMonth(period);
  if (!base || !Number.isInteger(offset)) return null;
  const next = new Date(Date.UTC(base.year!, base.month! - 1 + offset, 1));
  try { return monthPeriod(next.getUTCFullYear(), next.getUTCMonth() + 1); } catch { return null; }
}
export function samePeriod(a: DashboardPeriod, b: DashboardPeriod) { return a.from === b.from && a.to === b.to; }
export function periodQuery(period: DashboardPeriod) {
  if (!validPeriodDate(period.from) || !validPeriodDate(period.to) || period.from > period.to) throw Error("Intervalo inválido");
  const month = asFullMonth(period);
  return new URLSearchParams(month ? { year: String(month.year), month: String(month.month) } : { from: period.from, to: period.to }).toString();
}

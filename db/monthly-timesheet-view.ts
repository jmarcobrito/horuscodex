import type { DashboardMonthlyTimesheet } from "../app/dashboard-types";

export type MonthlyTimesheetRow = {
  id: string; contractor_id: string; year: number; month: number;
  status: "OPEN" | "CLOSED" | "REOPENED";
  worked_minutes: number; credited_minutes: number; considered_minutes: number; required_minutes: number;
  closed_at: string | null; closed_by: string | null;
};
export function projectMonthlyTimesheet(row: MonthlyTimesheetRow, names: ReadonlyMap<string, string>): DashboardMonthlyTimesheet {
  return {
    id: row.id, contractorId: row.contractor_id, year: row.year, month: row.month,
    status: row.status, workedMinutes: row.worked_minutes, creditedMinutes: row.credited_minutes,
    consideredMinutes: row.considered_minutes, requiredMinutes: row.required_minutes,
    closedAt: row.closed_at, closedByName: row.closed_by ? names.get(row.closed_by) ?? null : null,
  };
}

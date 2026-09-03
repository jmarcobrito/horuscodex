import type {
  DashboardAudit, DashboardAuthorization, DashboardBalanceLot, DashboardBalanceTransaction,
  DashboardContractor, DashboardData, DashboardEntry, DashboardOccurrence, DashboardRequest,
} from "../app/dashboard-types";
import { projectMonthlyTimesheet, type MonthlyTimesheetRow } from "./monthly-timesheet-view";
import type { HorusActor } from "./actor";
import { buildPeriodSummary } from "./dashboard-summary";
import { getSupabaseAdmin } from "./supabase";

type PeriodInput = { year?: number; month?: number; from?: string; to?: string };
type UserRow = { id: string; name: string; email: string; status: "ACTIVE" | "INACTIVE" };
type EntryRow = { id: string; contractor_id: string; work_date: string; start_time: string; end_time: string; break_minutes: number; calculated_minutes: number; eligible_minutes: number; non_business_day_status: string; notes: string; created_at: string; updated_at: string };
type LotRow = { id: string; contractor_id: string; type: "CREDIT" | "DEBIT"; original_minutes: number; remaining_minutes: number; reserved_minutes: number; origin_date: string; deadline_date: string; status: string };
type TransactionRow = { id: string; contractor_id: string; lot_id: string; type: string; minutes: number; description: string; created_at: string };
type RequestRow = { id: string; contractor_id: string; start_date: string; end_date: string; requested_minutes: number; reserved_minutes: number; status: string; reason: string; requested_at: string; decision_notes: string | null };
type OccurrenceRow = { id: string; contractor_id: string; type: string; start_date: string; end_date: string; minutes: number; calculation_effect: string; status: string; description: string; created_at: string; decision_notes: string | null };
type AuthorizationRow = { id: string; contractor_id: string; work_date: string; estimated_minutes: number; approved_minutes: number | null; reason: string; status: string; requested_at: string; decision_notes: string | null };
type AuditRow = { id: string; user_id: string; action: string; entity_type: string; entity_id: string; reason: string | null; created_at: string };

function isoDate(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function resolveDashboardPeriod(input: PeriodInput) {
  if (input.from && input.to && validIsoDate(input.from) && validIsoDate(input.to) && input.from <= input.to) return { from: input.from, to: input.to, year: null, month: null };
  const now = new Date(); const year = Number.isInteger(input.year) && input.year! >= 2000 && input.year! <= 2200 ? input.year! : now.getFullYear();
  const month = Number.isInteger(input.month) && input.month! >= 1 && input.month! <= 12 ? input.month! : now.getMonth() + 1;
  return { from: isoDate(year, month, 1), to: isoDate(year, month, new Date(year, month, 0).getDate()), year, month };
}
function monthKeys(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number); const [ty, tm] = to.split("-").map(Number); const keys = new Set<string>(); let y = fy; let m = fm;
  while (y < ty || (y === ty && m <= tm)) { keys.add(`${y}-${m}`); m += 1; if (m === 13) { m = 1; y += 1; } }
  return keys;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function sum<T>(rows: T[], value: (row: T) => number) { return rows.reduce((total, row) => total + value(row), 0); }
function delayDays(entry: EntryRow) {
  const created = new Date(entry.created_at); const worked = new Date(entry.work_date + "T00:00:00Z");
  return Math.max(0, Math.floor((Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate()) - worked.getTime()) / 86_400_000));
}

export async function getDashboardData(actor: HorusActor, input: PeriodInput = {}): Promise<DashboardData> {
  const period = resolveDashboardPeriod(input); const admin = getSupabaseAdmin();
  const refresh = await admin.rpc("refresh_hour_balance_statuses", { p_organization_id: actor.organizationId });
  if (refresh.error && refresh.error.code !== "PGRST202") throw refresh.error;

  let usersQuery = admin.from("users").select("id,name,email,status").eq("organization_id", actor.organizationId).eq("role", "PJ").order("name");
  let entriesQuery = admin.from("time_entries").select("id,contractor_id,work_date,start_time,end_time,break_minutes,calculated_minutes,eligible_minutes,non_business_day_status,notes,created_at,updated_at").eq("organization_id", actor.organizationId).gte("work_date", period.from).lte("work_date", period.to).order("work_date", { ascending: false });
  let timesheetsQuery = admin.from("monthly_timesheets").select("id,contractor_id,year,month,required_minutes,credited_minutes,worked_minutes,considered_minutes,status,closed_at,closed_by").eq("organization_id", actor.organizationId);
  let lotsQuery = admin.from("hour_balance_lots").select("id,contractor_id,type,original_minutes,remaining_minutes,reserved_minutes,origin_date,deadline_date,status").eq("organization_id", actor.organizationId).order("origin_date");
  let transactionsQuery = admin.from("hour_balance_transactions").select("id,contractor_id,lot_id,type,minutes,description,created_at").eq("organization_id", actor.organizationId).order("created_at", { ascending: false }).limit(100);
  let requestsQuery = admin.from("leave_requests").select("id,contractor_id,start_date,end_date,requested_minutes,reserved_minutes,status,reason,requested_at,decision_notes").eq("organization_id", actor.organizationId).order("requested_at", { ascending: false }).limit(100);
  let occurrencesQuery = admin.from("occurrences").select("id,contractor_id,type,start_date,end_date,minutes,calculation_effect,status,description,created_at,decision_notes").eq("organization_id", actor.organizationId).lte("start_date", period.to).gte("end_date", period.from).order("created_at", { ascending: false }).limit(100);
  let authorizationsQuery = admin.from("non_business_day_authorizations").select("id,contractor_id,work_date,estimated_minutes,approved_minutes,reason,status,requested_at,decision_notes").eq("organization_id", actor.organizationId).gte("work_date", period.from).lte("work_date", period.to).order("requested_at", { ascending: false }).limit(100);
  let auditsQuery = admin.from("audit_logs").select("id,user_id,action,entity_type,entity_id,reason,created_at").eq("organization_id", actor.organizationId).order("created_at", { ascending: false }).limit(80);
  if (actor.role === "PJ") {
    usersQuery = usersQuery.eq("id", actor.id); entriesQuery = entriesQuery.eq("contractor_id", actor.id); timesheetsQuery = timesheetsQuery.eq("contractor_id", actor.id);
    lotsQuery = lotsQuery.eq("contractor_id", actor.id); transactionsQuery = transactionsQuery.eq("contractor_id", actor.id); requestsQuery = requestsQuery.eq("contractor_id", actor.id);
    occurrencesQuery = occurrencesQuery.eq("contractor_id", actor.id); authorizationsQuery = authorizationsQuery.eq("contractor_id", actor.id); auditsQuery = auditsQuery.eq("user_id", actor.id);
  }
  const results = await Promise.all([
    usersQuery, entriesQuery, timesheetsQuery, lotsQuery, transactionsQuery, requestsQuery, occurrencesQuery, authorizationsQuery, auditsQuery,
    admin.from("organization_policies").select("monthly_required_minutes,positive_balance_after_deadline_policy,minimum_leave_notice_days,retroactive_batch_threshold").eq("organization_id", actor.organizationId).maybeSingle(),
    admin.from("users").select("id,name").eq("organization_id", actor.organizationId),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const [usersResult, entriesResult, timesheetsResult, lotsResult, transactionsResult, requestsResult, occurrencesResult, authorizationsResult, auditsResult, policyResult, actorUsersResult] = results;
  const users = (usersResult.data ?? []) as UserRow[];
  const entries = (entriesResult.data ?? []) as EntryRow[]; const keys = monthKeys(period.from, period.to);
  const timesheets = ((timesheetsResult.data ?? []) as MonthlyTimesheetRow[]).filter((row) => keys.has(`${row.year}-${row.month}`));
  const lots = ((lotsResult.data ?? []) as LotRow[]).filter((lot) => !["CONSUMED", "CANCELLED", "SETTLED"].includes(lot.status) && lot.remaining_minutes > 0);
  const transactions = (transactionsResult.data ?? []) as TransactionRow[]; const requests = (requestsResult.data ?? []) as RequestRow[];
  const occurrences = (occurrencesResult.data ?? []) as OccurrenceRow[]; const authorizations = (authorizationsResult.data ?? []) as AuthorizationRow[]; const audits = (auditsResult.data ?? []) as AuditRow[];
  const policyRow = policyResult.data; const requiredPerMonth = policyRow?.monthly_required_minutes ?? 9_720;
  const names = new Map<string, string>((actorUsersResult.data ?? []).map((user) => [user.id, user.name])); if (!names.has(actor.id)) names.set(actor.id, actor.name);

  const dashboardEntries: DashboardEntry[] = entries.map((row) => ({ id: row.id, contractorId: row.contractor_id, contractorName: names.get(row.contractor_id) ?? actor.name, workDate: row.work_date, startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5), breakMinutes: row.break_minutes, calculatedMinutes: row.calculated_minutes, eligibleMinutes: row.eligible_minutes, nonBusinessDayStatus: row.non_business_day_status, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at }));
  const contractors: DashboardContractor[] = users.map((user) => {
    const userEntries = entries.filter((entry) => entry.contractor_id === user.id); const userTimesheets = timesheets.filter((row) => row.contractor_id === user.id);
    const workedMinutes = sum(userEntries, (entry) => entry.calculated_minutes); const consideredMinutes = sum(userEntries, (entry) => entry.eligible_minutes) + sum(userTimesheets, (row) => row.credited_minutes);
    const requiredMinutes = userTimesheets.length ? sum(userTimesheets, (row) => row.required_minutes) : requiredPerMonth * keys.size;
    const delays = userEntries.map(delayDays); const statuses = new Set(userTimesheets.map((row) => row.status));
    return { id: user.id, name: user.name, email: user.email, initials: initials(user.name), status: user.status, lastEntryDate: userEntries[0]?.work_date ?? null, lastEntryAt: userEntries[0]?.created_at ?? null, workedMinutes, consideredMinutes, requiredMinutes, fillPercentage: requiredMinutes ? Math.min(100, Math.round(consideredMinutes / requiredMinutes * 100)) : 0, averageDelayDays: delays.length ? Math.round(sum(delays, (value) => value) / delays.length) : 0, retroactiveEntries: delays.filter((value) => value > 0).length, timesheetStatus: statuses.size === 1 ? [...statuses][0] : statuses.size > 1 ? "MIXED" : "OPEN" };
  });
  const balanceLots: DashboardBalanceLot[] = lots.map((row) => ({ id: row.id, contractorId: row.contractor_id, contractorName: names.get(row.contractor_id) ?? actor.name, type: row.type, originalMinutes: row.original_minutes, remainingMinutes: row.remaining_minutes, reservedMinutes: row.reserved_minutes, originDate: row.origin_date, deadlineDate: row.deadline_date, status: row.status }));
  const balanceTransactions: DashboardBalanceTransaction[] = transactions.map((row) => ({ id: row.id, contractorId: row.contractor_id, contractorName: names.get(row.contractor_id) ?? actor.name, lotId: row.lot_id, type: row.type, minutes: row.minutes, description: row.description, createdAt: row.created_at }));
  const dashboardRequests: DashboardRequest[] = requests.map((row) => ({ id: row.id, contractorId: row.contractor_id, contractorName: names.get(row.contractor_id) ?? actor.name, startDate: row.start_date, endDate: row.end_date, requestedMinutes: row.requested_minutes, reservedMinutes: row.reserved_minutes, status: row.status, reason: row.reason, requestedAt: row.requested_at, decisionNotes: row.decision_notes ?? "" }));
  const dashboardOccurrences: DashboardOccurrence[] = occurrences.map((row) => ({ id: row.id, contractorId: row.contractor_id, contractorName: names.get(row.contractor_id) ?? actor.name, type: row.type, startDate: row.start_date, endDate: row.end_date, minutes: row.minutes, calculationEffect: row.calculation_effect, status: row.status, description: row.description, createdAt: row.created_at, decisionNotes: row.decision_notes ?? "" }));
  const dashboardAuthorizations: DashboardAuthorization[] = authorizations.map((row) => ({ id: row.id, contractorId: row.contractor_id, contractorName: names.get(row.contractor_id) ?? actor.name, workDate: row.work_date, estimatedMinutes: row.estimated_minutes, approvedMinutes: row.approved_minutes, reason: row.reason, status: row.status, requestedAt: row.requested_at, decisionNotes: row.decision_notes ?? "" }));
  const dashboardAudits: DashboardAudit[] = audits.map((row) => ({ id: row.id, userName: names.get(row.user_id) ?? (row.user_id === actor.id ? actor.name : "Usuário"), action: row.action, entityType: row.entity_type, entityId: row.entity_id, reason: row.reason ?? "", createdAt: row.created_at }));
  const summary = buildPeriodSummary({
    users: users.map((user) => ({ id: user.id, status: user.status })),
    entries: entries.map((entry) => ({ contractorId: entry.contractor_id, calculatedMinutes: entry.calculated_minutes, eligibleMinutes: entry.eligible_minutes })),
    timesheets: timesheets.map((row) => ({ contractorId: row.contractor_id, requiredMinutes: row.required_minutes, creditedMinutes: row.credited_minutes })),
    requiredPerMonth,
    monthCount: keys.size,
  });
  const statuses = new Set(timesheets.map((row) => row.status));
  return {
    period,
    monthlyTimesheets: timesheets.map(row => projectMonthlyTimesheet(row, names)),
    metrics: { activeContractors: summary.activeContractors, workedMinutes: summary.workedMinutes, requiredMinutes: summary.requiredMinutes, positiveBalanceMinutes: sum(lots.filter((lot) => lot.type === "CREDIT"), (lot) => lot.remaining_minutes), negativeBalanceMinutes: sum(lots.filter((lot) => lot.type === "DEBIT"), (lot) => lot.remaining_minutes), pendingRequests: requests.filter((row) => row.status === "REQUESTED").length, pendingOccurrences: occurrences.filter((row) => row.status === "REQUESTED").length, pendingAuthorizations: authorizations.filter((row) => row.status === "REQUESTED").length },
    timesheet: { workedMinutes: summary.workedMinutes, creditedMinutes: summary.creditedMinutes, consideredMinutes: summary.consideredMinutes, requiredMinutes: summary.requiredMinutes, projectedBalanceMinutes: summary.consideredMinutes - summary.requiredMinutes, status: statuses.size === 1 ? [...statuses][0] : statuses.size > 1 ? "MIXED" : "OPEN" },
    policy: { monthlyRequiredMinutes: requiredPerMonth, positiveBalanceAfterDeadlinePolicy: policyRow?.positive_balance_after_deadline_policy ?? "ALLOW_AFTER_DEADLINE", minimumLeaveNoticeDays: policyRow?.minimum_leave_notice_days ?? null, retroactiveBatchThreshold: policyRow?.retroactive_batch_threshold ?? 3 },
    contractors, entries: dashboardEntries, balanceLots, balanceTransactions, requests: dashboardRequests,
    occurrences: dashboardOccurrences, authorizations: dashboardAuthorizations, audits: dashboardAudits,
  };
}

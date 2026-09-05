import type { DashboardContractor, DashboardData } from "./dashboard-types";
import { buildClosingRows, type ClosingRow, type ClosingStatus } from "./closing-model";
import { dashboardDisplay } from "./dashboard-display";
import { asFullMonth } from "./period";

export type ReviewScope = { personId: string | null; sectorId: string | null };
export type OverviewFilters = ReviewScope & { status: ClosingStatus | "all" };
export const defaultOverviewFilters: OverviewFilters = { personId: null, sectorId: null, status: "all" };
export type OverviewRow = { person: DashboardContractor; days: number; workedMinutes: number; closing: ClosingRow | null };
export type OverviewModel = {
  fullMonth: boolean; rows: OverviewRow[]; counts: Record<ClosingStatus, number> | null;
  totalPeople: number; pendingPeople: number | null;
  bank: { availableMinutes: number; reservedMinutes: number; debitMinutes: number };
  scopedData: DashboardData;
};
const matchesSector = (person: DashboardContractor, sector: string | null) =>
  sector === null || (sector === "__unassigned__" ? person.sectorId === null : person.sectorId === sector);

export function resolveReviewIds(data: DashboardData, scope: ReviewScope): Set<string> {
  return new Set(data.contractors.filter(person => (!scope.personId || person.id === scope.personId)
    && matchesSector(person, scope.sectorId)).map(person => person.id));
}

/** A read-only presentation projection. Never use as a workspace or mutation source. */
export function scopeDashboard(data: DashboardData, scope: ReviewScope): DashboardData {
  const ids = resolveReviewIds(data, scope);
  const belongs = (item: { contractorId: string }) => ids.has(item.contractorId);
  const contractors = data.contractors.filter(person => ids.has(person.id));
  const entries = data.entries.filter(belongs), monthlyTimesheets = data.monthlyTimesheets?.filter(belongs);
  const balanceLots = data.balanceLots.filter(belongs), requests = data.requests.filter(belongs);
  const occurrences = data.occurrences.filter(belongs), authorizations = data.authorizations.filter(belongs);
  const workedMinutes = entries.reduce((sum, entry) => sum + entry.calculatedMinutes, 0);
  const requiredMinutes = contractors.reduce((sum, person) => sum + person.requiredMinutes, 0);
  const creditedMinutes = monthlyTimesheets?.reduce((sum, month) => sum + month.creditedMinutes, 0) ?? 0;
  const consideredMinutes = entries.reduce((sum, entry) => sum + entry.eligibleMinutes, 0) + creditedMinutes;
  const statuses = new Set(monthlyTimesheets?.map(month => month.status));
  const status = statuses.size === 1 ? [...statuses][0] : "MIXED";
  const projected: DashboardData = {
    ...data, contractors, entries, monthlyTimesheets, balanceLots, requests, occurrences, authorizations,
    balanceTransactions: data.balanceTransactions.filter(belongs),
    metrics: {
      activeContractors: contractors.filter(person => person.status === "ACTIVE").length,
      workedMinutes, requiredMinutes,
      estimatedRequiredPersonMonths: contractors.reduce((sum, person) => sum + (person.estimatedRequiredMonths ?? 0), 0),
      positiveBalanceMinutes: 0,
      negativeBalanceMinutes: balanceLots.filter(lot => lot.type === "DEBIT").reduce((sum, lot) => sum + lot.remainingMinutes, 0),
      pendingRequests: requests.filter(item => item.status === "REQUESTED").length,
      pendingOccurrences: occurrences.filter(item => item.status === "REQUESTED").length,
      pendingAuthorizations: authorizations.filter(item => ["REQUESTED", "NEEDS_ADJUSTMENT"].includes(item.status)).length,
    },
    timesheet: { workedMinutes, creditedMinutes, consideredMinutes, requiredMinutes,
      projectedBalanceMinutes: consideredMinutes - requiredMinutes, status },
  };
  projected.metrics.positiveBalanceMinutes = dashboardDisplay(projected).validCreditMinutes;
  return projected;
}

export function normalizeOverviewFilters(data: DashboardData, filters: OverviewFilters): { filters: OverviewFilters; notice: string | null } {
  const next = { ...filters }, notices: string[] = [];
  if (next.sectorId !== null && !data.contractors.some(person => matchesSector(person, next.sectorId))) {
    next.sectorId = null; notices.push("O setor selecionado não está disponível nesta consulta.");
  }
  if (next.personId && !data.contractors.some(person => person.id === next.personId && matchesSector(person, next.sectorId))) {
    next.personId = null; notices.push("A pessoa selecionada não está disponível neste período ou setor.");
  }
  if (!asFullMonth(data.period) && next.status !== "all") {
    next.status = "all"; notices.push("O filtro de situação foi removido: escolha um mês completo para conferir o fechamento.");
  }
  return { filters: next, notice: notices.length ? notices.join(" ") : null };
}

export function buildOverviewModel(data: DashboardData, filters: OverviewFilters): OverviewModel {
  const fullMonth = Boolean(asFullMonth(data.period)), scopedData = scopeDashboard(data, filters);
  const display = dashboardDisplay(scopedData), ids = resolveReviewIds(data, filters);
  const closing = fullMonth ? buildClosingRows(data).filter(row => ids.has(row.contractorId)) : [];
  const inPeriod = (date: string) => date >= data.period.from && date <= data.period.to;
  const monthNumber = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  const people = scopedData.contractors.filter(person => fullMonth ? closing.some(row => row.contractorId === person.id) :
    person.status === "ACTIVE" || data.entries.some(entry => entry.contractorId === person.id && inPeriod(entry.workDate)) ||
    data.monthlyTimesheets?.some(month => month.contractorId === person.id && month.year * 12 + month.month >= monthNumber(data.period.from) && month.year * 12 + month.month <= monthNumber(data.period.to)) ||
    data.occurrences.some(item => item.contractorId === person.id && item.startDate <= data.period.to && item.endDate >= data.period.from) ||
    data.authorizations.some(item => item.contractorId === person.id && inPeriod(item.workDate)));
  const counts: Record<ClosingStatus, number> | null = fullMonth ? { UNKNOWN: 0, NO_RECORD: 0, NO_ENTRIES: 0, PENDING: 0, READY: 0, CLOSED: 0 } : null;
  for (const row of closing) if (counts) counts[row.status]++;
  const rows = people.map(person => {
    const entries = data.entries.filter(entry => entry.contractorId === person.id && inPeriod(entry.workDate));
    return { person, days: new Set(entries.map(entry => entry.workDate)).size,
      workedMinutes: entries.reduce((sum, entry) => sum + entry.calculatedMinutes, 0),
      closing: closing.find(row => row.contractorId === person.id) ?? null };
  }).filter(row => !fullMonth || filters.status === "all" || row.closing?.status === filters.status)
    .sort((a, b) => a.person.name.localeCompare(b.person.name, "pt-BR") || a.person.id.localeCompare(b.person.id));
  return { fullMonth, scopedData, rows, counts, totalPeople: people.length, pendingPeople: counts?.PENDING ?? null,
    bank: { availableMinutes: display.availableCreditMinutes, reservedMinutes: display.reservedCreditMinutes, debitMinutes: scopedData.metrics.negativeBalanceMinutes } };
}

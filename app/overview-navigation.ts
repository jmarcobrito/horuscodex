import type { DashboardData, DashboardPeriod } from "./dashboard-types";
import type { ClosingStatus } from "./closing-model";
import { resolveReviewIds, type OverviewFilters, type ReviewScope } from "./overview-model";
import { asFullMonth } from "./period";

export type OverviewIntent = { kind: "closing" } | { kind: "pending" } | { kind: "person"; personId: string } | { kind: "daily" } | { kind: "balance" };
export type OverviewTarget = {
  section: "entries" | "closing" | "balance"; period: DashboardPeriod; scope: ReviewScope;
  closingStatus: ClosingStatus | "all"; entriesMode: "collaborator" | "day"; workDate: string;
};
export function reviewContextNotice(data: DashboardData | undefined, scope: ReviewScope | undefined): string {
  return data && scope?.personId && !data.contractors.some(person => person.id === scope.personId)
    ? "A pessoa não está disponível nesta consulta. Os filtros recebidos foram mantidos para não mostrar outra pessoa."
    : "";
}
export function overviewTarget(data: DashboardData, filters: OverviewFilters, intent: OverviewIntent): OverviewTarget {
  const month = asFullMonth(data.period);
  if (intent.kind !== "balance" && !month) throw Error("Escolha um mês completo para conferir o fechamento");
  const period = { ...(intent.kind === "balance" ? data.period : month!) };
  const scope = { personId: filters.personId, sectorId: filters.sectorId };
  if (intent.kind === "person") {
    if (!resolveReviewIds(data, scope).has(intent.personId)) throw Error("Colaborador não disponível nesta consulta");
    scope.personId = intent.personId;
  }
  return { section: intent.kind === "balance" ? "balance" : ["closing", "pending"].includes(intent.kind) ? "closing" : "entries",
    period, scope, closingStatus: intent.kind === "pending" ? "PENDING" : intent.kind === "closing" ? filters.status : "all",
    entriesMode: intent.kind === "daily" ? "day" : "collaborator", workDate: period.from };
}

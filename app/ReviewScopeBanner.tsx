import type { DashboardData } from "./dashboard-types";
import type { ReviewScope } from "./overview-model";
import { monthLabel } from "./HorusViews";

export function ReviewScopeBanner({ data, scope, onClear }: { data: DashboardData; scope: ReviewScope; onClear: () => void }) {
  const person = scope.personId ? data.contractors.find(person => person.id === scope.personId)?.name ?? "Pessoa não disponível nesta consulta" : "Todas as pessoas";
  const sector = scope.sectorId === "__unassigned__" ? "Sem setor definido" : scope.sectorId ? data.contractors.find(person => person.sectorId === scope.sectorId)?.sectorName ?? "Setor não disponível nesta consulta" : "Todos os setores";
  return <div className="review-scope-banner" role="status"><p><strong>Conferência recebida do Painel</strong><span>{monthLabel(data.period)} · {person} · {sector}</span></p><button type="button" className="secondary-button" onClick={onClear}>Limpar filtros recebidos</button></div>;
}

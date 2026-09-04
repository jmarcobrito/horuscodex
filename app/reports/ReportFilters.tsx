"use client";

import type { DashboardPeriod } from "../dashboard-types";
import { PeriodPicker } from "../PeriodPicker";
import { SelectMenu } from "../SelectMenu";
import type { ReportFilters as Filters, ReportOptions } from "./report-types";

type Props = {
  period: DashboardPeriod;
  filters: Filters;
  options: ReportOptions;
  busy: boolean;
  onPeriodChange: (period: DashboardPeriod) => void;
  onChange: (change: Partial<Pick<Filters, "personId" | "sectorId" | "category" | "actorId">>) => void;
  onClear: () => void;
};

const EMPTY_OPTIONS: ReportOptions = { people: [], sectors: [], actors: [], categories: [] };
export function emptyReportOptions() { return EMPTY_OPTIONS; }

function selectedLabel(options: ReportOptions[keyof ReportOptions], value: string | null, fallback: string) {
  return value ? options.find(option => option.value === value)?.label ?? fallback : null;
}

export function ReportFilters({ period, filters, options, busy, onPeriodChange, onChange, onClear }: Props) {
  const chips = [
    { key: "personId" as const, label: selectedLabel(options.people, filters.personId, "Pessoa selecionada") },
    { key: "sectorId" as const, label: selectedLabel(options.sectors, filters.sectorId, "Setor selecionado") },
    { key: "category" as const, label: selectedLabel(options.categories, filters.category, "Tipo selecionado") },
    { key: "actorId" as const, label: selectedLabel(options.actors, filters.actorId, "Responsável selecionado") },
  ].filter((chip): chip is { key: "personId" | "sectorId" | "category" | "actorId"; label: string } => Boolean(chip.label));

  return <>
    <PeriodPicker value={period} busy={busy} allowRange onChange={onPeriodChange} />
    <section className="panel request-section report-filter-panel" aria-label="Filtros do relatório">
      <div className="panel-heading static"><div><span>REFINE A CONSULTA</span><h2>Filtros</h2></div></div>
      <div className="request-list">
      <div className="entries-filter">
        <div className="field"><span>Pessoa</span><SelectMenu ariaLabel="Pessoa" value={filters.personId ?? ""} disabled={busy} onChange={value => onChange({ personId: value || null })} options={[{ value: "", label: "Toda a equipe" }, ...options.people]} /></div>
        <div className="field"><span>Setor</span><SelectMenu ariaLabel="Setor" value={filters.sectorId ?? ""} disabled={busy} onChange={value => onChange({ sectorId: value || null })} options={[{ value: "", label: "Todos os setores" }, ...options.sectors]} /></div>
        <div className="field"><span>Tipo</span><SelectMenu ariaLabel="Tipo" value={filters.category ?? ""} disabled={busy} onChange={value => onChange({ category: value || null })} options={[{ value: "", label: "Todos os tipos" }, ...options.categories]} /></div>
      </div>
      {filters.kind === "history" && <details className="report-more-filters"><summary>Mais filtros</summary><div className="field"><span>Quem realizou a ação</span><SelectMenu ariaLabel="Quem realizou a ação" value={filters.actorId ?? ""} disabled={busy} onChange={value => onChange({ actorId: value || null })} options={[{ value: "", label: "Todas as pessoas" }, ...options.actors]} /></div></details>}
      <div className="report-filter-actions" aria-label="Filtros aplicados">
        {chips.map(chip => <button key={chip.key} type="button" className="secondary-button" disabled={busy} aria-label={`Remover filtro ${chip.label}`} onClick={() => onChange({ [chip.key]: null })}>{chip.label} ×</button>)}
        <button type="button" className="secondary-button" disabled={busy || chips.length === 0} onClick={onClear}>Limpar filtros</button>
      </div>
      </div>
    </section>
  </>;
}

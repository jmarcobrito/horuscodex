"use client";

import { useRef } from "react";
import type { DashboardData, DashboardPeriod } from "./dashboard-types";
import type { ClosingStatus } from "./closing-model";
import { buildOverviewModel, type OverviewFilters } from "./overview-model";
import type { OverviewIntent } from "./overview-navigation";
import { dashboardDisplay } from "./dashboard-display";
import { formatDate, formatMinutes, MonthlyContext, RegistrationDelay, submissionLabel } from "./HorusViews";
import { PeriodPicker } from "./PeriodPicker";
import { SelectMenu } from "./SelectMenu";

export type OverviewProps = {
  data: DashboardData; filters: OverviewFilters; busy: boolean; receivedAt: string | null;
  onFiltersChange: (filters: OverviewFilters) => void; onPeriodChange: (period: DashboardPeriod) => void;
  onRefresh: () => void; onIntent: (intent: OverviewIntent) => void;
};
const states: { status: ClosingStatus; label: string; singular: string }[] = [
  { status: "CLOSED", label: "Fechados", singular: "Fechado" },
  { status: "READY", label: "Prontos para revisar", singular: "Pronto para revisar" },
  { status: "PENDING", label: "Com pendências", singular: "Com pendências" },
  { status: "NO_ENTRIES", label: "Sem lançamentos", singular: "Sem lançamentos" },
  { status: "NO_RECORD", label: "Sem registro mensal", singular: "Sem registro mensal" },
  { status: "UNKNOWN", label: "Situação indisponível", singular: "Situação indisponível" },
];

export function Overview({ data, filters, busy, receivedAt, onFiltersChange, onPeriodChange, onRefresh, onIntent }: OverviewProps) {
  const model = buildOverviewModel(data, filters), picker = useRef<HTMLDivElement>(null);
  const contextData = !filters.personId && !filters.sectorId ? data : model.scopedData;
  const display = dashboardDisplay(contextData);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(data.period.from + "T00:00:00Z"));
  const sectors = [...new Map(data.contractors.map(person => [person.sectorId ?? "__unassigned__", person.sectorId ? person.sectorName : "Sem setor definido"])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const monthlyDisabled = busy || !model.fullMonth;
  return <div className="overview-root">
    <section className="page-heading overview-title"><div><h1>Painel</h1><p>Confira a equipe antes de fechar o mês.</p></div></section>
    <div className="overview-toolbar">
      <div ref={picker}><PeriodPicker value={data.period} busy={busy} allowRange variant="compact" onChange={onPeriodChange} /></div>
      <div className="overview-filters">
        <SelectMenu ariaLabel="Filtrar painel por pessoa" value={filters.personId ?? ""} disabled={busy} onChange={id => onFiltersChange({ ...filters, personId: id || null })}
          options={[{ value: "", label: "Todas as pessoas" }, ...data.contractors.filter(person => !filters.sectorId || (person.sectorId ?? "__unassigned__") === filters.sectorId).map(person => ({ value: person.id, label: person.name, description: person.status === "INACTIVE" ? "Cadastro inativo · histórico preservado" : person.sectorName }))]} />
        <SelectMenu ariaLabel="Filtrar painel por setor" value={filters.sectorId ?? ""} disabled={busy} onChange={id => onFiltersChange({ ...filters, sectorId: id || null })}
          options={[{ value: "", label: "Todos os setores" }, ...sectors.map(([value, label]) => ({ value, label }))]} />
      </div>
      <div className="overview-refresh"><span>{receivedAt && Number.isFinite(Date.parse(receivedAt)) ? "Consulta atualizada às " + new Intl.DateTimeFormat("pt-BR", { timeZone: data.timezone ?? "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(receivedAt)) : "Consulta carregada"}</span><button type="button" className="overview-action" disabled={busy} onClick={onRefresh}>Atualizar consulta</button></div>
    </div>
    <section className="overview-closing" aria-labelledby="overview-closing-title">
      <div className="overview-closing-heading"><div><h2 id="overview-closing-title">{model.fullMonth ? "Fechamento de " + month : "Conferência por intervalo"}</h2><p>{model.totalPeople} pessoa(s) nesta consulta</p><small>{model.fullMonth ? "Revise e confirme o fechamento na próxima tela." : "Consulte as horas do intervalo. Para fechar, selecione um mês completo."}</small></div><button type="button" className="primary-button overview-action" disabled={monthlyDisabled} aria-describedby={!model.fullMonth ? "overview-month-help" : undefined} onClick={() => onIntent({ kind: "closing" })}>Ir para fechamento</button></div>
      {model.counts ? <><div className="overview-statuses">{states.map(({ status, label }) => <button type="button" className={"overview-status overview-status-" + status} key={status} aria-pressed={filters.status === status} disabled={busy} onClick={() => onFiltersChange({ ...filters, status: filters.status === status ? "all" : status })}><span>{label}</span><strong>{model.counts![status]}</strong></button>)}</div>{filters.status !== "all" && <button className="overview-clear overview-action" disabled={busy} onClick={() => onFiltersChange({ ...filters, status: "all" })}>Limpar filtro de situação</button>}</> : <div className="overview-month-help"><p id="overview-month-help">Escolha um mês completo para conferir o fechamento. As ações mensais não se aplicam a este intervalo.</p><button className="overview-action" disabled={busy} onClick={() => picker.current?.querySelector<HTMLInputElement>('input[type="month"]')?.focus()}>Escolher mês completo</button></div>}
      {(model.pendingPeople ?? 0) > 0 && <div className="overview-pending"><p>{model.pendingPeople} pessoa(s) com pendências neste mês</p><button type="button" className="overview-action" disabled={busy} onClick={() => onIntent({ kind: "pending" })}>Ver pendências do mês</button></div>}
    </section>
    {(data.metrics.estimatedRequiredPersonMonths ?? 0) > 0 && <p className="overview-estimate">Inclui estimativa para meses sem registro mensal. A carga estimada é apenas informativa.</p>}
    {!model.fullMonth && <><p className="overview-interval-total">HORAS TRABALHADAS {formatMinutes(display.workedMinutes)} · Consideradas nos lançamentos: {formatMinutes(display.entryEligibleMinutes)}</p><MonthlyContext context={display.monthlyContext} estimatedMonths={contextData.metrics.estimatedRequiredPersonMonths ?? 0} /></>}
    <section className="overview-team" aria-labelledby="overview-team-title">
      <div className="overview-team-heading"><h2 id="overview-team-title">Conferência da equipe</h2><button type="button" className="overview-action" disabled={monthlyDisabled} aria-describedby={!model.fullMonth ? "overview-month-help" : undefined} onClick={() => onIntent({ kind: "daily" })}>Conferir por dia</button></div>
      <table className="overview-table"><thead><tr><th scope="col">Pessoa</th><th scope="col">Dias com lançamento</th><th scope="col">Horas trabalhadas</th><th scope="col">Situação do mês</th><th scope="col">Conferir</th></tr></thead><tbody>{model.rows.map(({ person, days, workedMinutes, closing }) => <tr key={person.id}>
        <td data-label="Pessoa"><strong>{person.name}</strong><small>{person.sectorId ? person.sectorName : "Sem setor definido"}{person.status === "INACTIVE" ? " · Cadastro inativo" : ""}</small>
          <details className="overview-details"><summary>Detalhes do mês</summary><dl>
            <dt>Última data trabalhada</dt><dd>{person.lastEntryDate ? formatDate(person.lastEntryDate) : "Sem lançamentos"}</dd>
            <dt>Último envio</dt><dd>{submissionLabel(person.lastEntryAt, data.timezone)}</dd>
            <dt>Dias entre trabalho e registro</dt><dd><RegistrationDelay person={person} /></dd>
            <dt>Registrados após a data trabalhada</dt><dd>{person.retroactiveEntries}</dd>
            <dt>Carga mensal</dt><dd>{formatMinutes(person.requiredMinutes)}{(person.estimatedRequiredMonths ?? 0) > 0 && <small>Inclui estimativa da carga</small>}</dd>
            <dt>Horas em relação à carga mensal</dt><dd>{model.fullMonth ? person.fillPercentage + "%" : "Consulte um mês completo"}</dd>
          </dl></details></td>
        <td data-label="Dias com lançamento">{days}</td><td data-label="Horas trabalhadas">{formatMinutes(workedMinutes)}</td>
        <td data-label="Situação do mês"><span className={"overview-pill overview-status-" + (closing?.status ?? "UNKNOWN")}>{closing ? states.find(state => state.status === closing.status)?.singular : "Consulte um mês completo"}</span></td>
        <td data-label="Conferir"><button type="button" className="overview-action" disabled={monthlyDisabled} aria-label={"Conferir " + person.name} aria-describedby={!model.fullMonth ? "overview-month-help" : undefined} onClick={() => onIntent({ kind: "person", personId: person.id })}>Conferir</button></td>
      </tr>)}</tbody></table>
      {!model.rows.length && <p className="overview-empty" role="status">Nenhuma pessoa corresponde aos filtros desta consulta.</p>}
      <p className="overview-table-note">Sem lançamentos não significa falta.</p>
    </section>
    <section className="overview-bank" aria-label="Banco de horas — posição atual">
      <h2>Banco de horas <span>· posição atual</span></h2>
      <dl><div><dt>Disponível para usar</dt><dd>{formatMinutes(model.bank.availableMinutes)}</dd></div><div><dt>Reservado</dt><dd>{formatMinutes(model.bank.reservedMinutes)}</dd></div><div><dt>Débitos em aberto</dt><dd>{formatMinutes(model.bank.debitMinutes)}</dd></div></dl>
      <button type="button" className="overview-action" disabled={busy} onClick={() => onIntent({ kind: "balance" })}>Ver extrato</button>
      <p>{filters.personId || filters.sectorId ? "Pessoa/setor selecionados · posição atual. " : ""}Saldo atual do banco; não é uma posição histórica do mês selecionado.</p>
    </section>
  </div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardPeriod } from "../dashboard-types";
import { ExportMenu } from "./ExportMenu";
import { ReportFilters, emptyReportOptions } from "./ReportFilters";
import { ReportTable } from "./ReportTable";
import {
  changeReportFilters, changeReportKind, changeReportPeriod, clearReportFilters, createReportLoader, reportFilters,
  type ReportLoadState, type ReportRequest,
} from "./report-client";
import type { ReportFilters as Filters, ReportKind } from "./report-types";

export const REPORT_TABS = [
  { value: "entries", label: "Lançamentos de horas", description: "Confira os horários registrados, as horas calculadas e as observações de cada dia." },
  { value: "balances", label: "Banco de horas", description: "Acompanhe créditos, débitos, reservas, utilizações, liberações e vencimentos." },
  { value: "history", label: "Histórico de alterações", description: "Veja quem realizou cada ação, quando aconteceu e qual pessoa ou registro foi afetado." },
] as const;

export function ReportsView({ period, onPeriodChange, request, isDev }: { period: DashboardPeriod; onPeriodChange: (period: DashboardPeriod) => void; request: ReportRequest; isDev: boolean }) {
  const [selection, setSelection] = useState<Filters>(() => reportFilters({ from: period.from, to: period.to }));
  const filters = useMemo(() => changeReportPeriod(selection, { from: period.from, to: period.to }), [selection, period.from, period.to]);
  const loader = useMemo(() => createReportLoader(request), [request]);
  const [state, setState] = useState<ReportLoadState>(() => ({ status: "loading", filters, response: null, message: null }));
  const [retry, setRetry] = useState(0);
  const activeTab = REPORT_TABS.find(tab => tab.value === filters.kind) ?? REPORT_TABS[0];

  // Reconcile before commit so the loading effect observes only the new period on page 1.
  if (filters !== selection) setSelection(filters);

  useEffect(() => {
    let current = true;
    void loader.load(filters).then(next => { if (current) setState(next); });
    return () => { current = false; loader.cancel(); };
  }, [loader, filters, retry]);

  const viewState: ReportLoadState = state.filters === filters ? state : { status: "loading", filters, response: null, message: null };
  const options = state.response?.kind === filters.kind ? state.response.options : emptyReportOptions();
  function update(change: Partial<Pick<Filters, "personId" | "sectorId" | "category" | "actorId">>) { setSelection(current => changeReportFilters(current, change)); }
  function changeKind(kind: ReportKind) { setSelection(current => changeReportKind(current, kind)); }
  function changePage(page: number) { setSelection(current => ({ ...current, page })); }

  return <>
    <section className="page-heading"><div><span className="eyebrow">CONSULTA ADMINISTRATIVA</span><h1>Relatórios</h1><p>Consulte e exporte a mesma visão, sempre com os filtros exibidos.</p></div></section>
    <div className="filter-tabs" role="tablist" aria-label="Tipos de relatório">{REPORT_TABS.map(tab => <button key={tab.value} type="button" role="tab" id={`report-tab-${tab.value}`} aria-controls="report-panel" aria-selected={filters.kind === tab.value} className={filters.kind === tab.value ? "active" : ""} onClick={() => changeKind(tab.value)}>{tab.label}</button>)}</div>
    <section id="report-panel" role="tabpanel" aria-labelledby={`report-tab-${activeTab.value}`}>
      <p className="daily-guidance">{activeTab.description}</p>
      <ReportFilters period={period} filters={filters} options={options} busy={false} onPeriodChange={onPeriodChange} onChange={update} onClear={() => setSelection(current => clearReportFilters(current))} />
      <ExportMenu filters={filters} request={request} />
      {viewState.status === "loading" && <section className="panel workspace-status" role="status"><p>Carregando relatório…</p></section>}
      {viewState.status === "empty" && <section className="panel empty-state" role="status"><strong>Sem resultados</strong><p>Nenhum registro encontrado com estes filtros. Use “Limpar filtros” para voltar à consulta inicial.</p></section>}
      {viewState.status === "error" && <section className="panel workspace-status" role="alert"><p>Não foi possível carregar o relatório. {viewState.message}</p><button type="button" className="secondary-button" onClick={() => { setState({ status: "loading", filters, response: null, message: null }); setRetry(value => value + 1); }}>Tentar novamente</button></section>}
      {viewState.status === "ready" && viewState.response && <ReportTable report={viewState.response} isDev={isDev} onPageChange={changePage} />}
    </section>
  </>;
}

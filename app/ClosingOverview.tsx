"use client";
import { useState } from "react";
import type { DashboardData } from "./dashboard-types";
import { formatDate, formatMinutes, monthLabel } from "./HorusViews";
import { buildClosingRows, makeClosingCommand, type ClosingCommand, type ClosingIssue, type ClosingRow, type ClosingStatus } from "./closing-model";

const labels: Record<ClosingStatus, string> = { UNKNOWN: "Situação mensal não disponível", NO_RECORD: "Sem registro mensal", NO_ENTRIES: "Sem lançamentos", PENDING: "Com pendências", READY: "Pronto para revisar", CLOSED: "Fechado" };
export function ClosingOverview({ data, onReview, onIssue, closingEnabled = false }: {
  data: DashboardData; onReview: (command: ClosingCommand, rows: ClosingRow[]) => void; onIssue: (issue: ClosingIssue) => void; closingEnabled?: boolean;
}) {
  const rows = buildClosingRows(data);
  const [selection, setSelection] = useState<{ data: DashboardData; ids: string[]; acknowledged: string[] }>({ data, ids: [], acknowledged: [] });
  const current = selection.data === data ? selection : { data, ids: [], acknowledged: [] };
  const closed = rows.filter(row => row.status === "CLOSED"), open = rows.filter(row => row.status !== "CLOSED");
  const update = (id: string, checked: boolean) => setSelection({ ...current, ids: checked ? [...new Set([...current.ids, id])] : current.ids.filter(value => value !== id) });
  const acknowledge = (id: string, checked: boolean) => setSelection({ data, ids: current.ids.filter(value => value !== id), acknowledged: checked ? [...new Set([...current.acknowledged, id])] : current.acknowledged.filter(value => value !== id) });
  function review() {
    if (!current.ids.length) return;
    onReview(makeClosingCommand(data.period, rows, current.ids, current.acknowledged), rows);
  }
  function person(row: ClosingRow) {
    const selectable = row.status === "READY" || (row.status === "NO_ENTRIES" && current.acknowledged.includes(row.contractorId));
    const hours = (value: number | undefined) => value === undefined ? "Não disponível" : formatMinutes(value);
    return <article className="closing-review-row" key={row.contractorId}>
      <div className="closing-row-heading">
        {row.status !== "CLOSED" && <input type="checkbox" aria-label={"Selecionar " + row.name} checked={current.ids.includes(row.contractorId)} disabled={!selectable} onChange={event => update(row.contractorId, event.target.checked)} />}
        <div><h3>{row.name}</h3><small>{data.contractors.find(item => item.id === row.contractorId)?.status === "INACTIVE" ? "Cadastro inativo · histórico preservado" : "Colaborador ativo"}</small></div>
        <span className={"status-pill " + (row.status === "CLOSED" ? "neutral" : row.status === "READY" ? "success" : "warning")}>{labels[row.status]}</span>
      </div>
      <dl className="closing-hours">
        <div><dt>Trabalhadas</dt><dd>{hours(row.month?.workedMinutes)}</dd></div>
        <div><dt>Abonos</dt><dd>{hours(row.month?.creditedMinutes)}</dd></div>
        <div><dt>Consideradas</dt><dd>{hours(row.month?.consideredMinutes)}</dd></div>
        <div><dt>Carga mensal</dt><dd>{hours(row.month?.requiredMinutes)}</dd></div>
        <div><dt>Saldo previsto</dt><dd>{row.forecastMinutes === null ? "Não disponível" : formatMinutes(row.forecastMinutes, true)}</dd></div>
      </dl>
      {row.status === "UNKNOWN" && <p>Atualize a consulta para verificar a situação mensal. Esta pessoa não pode ser incluída na revisão.</p>}
      {row.status === "NO_RECORD" && <p>Não há registro mensal nesta consulta. Isso não significa que o mês esteja aberto ou fechado.</p>}
      {row.status === "NO_ENTRIES" && <label className="check-field"><input type="checkbox" checked={current.acknowledged.includes(row.contractorId)} onChange={event => acknowledge(row.contractorId, event.target.checked)} /><span>Conferi este mês sem lançamentos e quero incluí-lo · {row.name}</span></label>}
      {row.issues.length > 0 && <ul className="closing-issues">{row.issues.map(issue => <li key={issue.kind + issue.sourceId}><span>{formatDate(issue.workDate)} · {issue.label}</span><button type="button" onClick={() => onIssue(issue)}>Ver pendência de {row.name}</button></li>)}</ul>}
      {row.status === "CLOSED" && <p>Fechado em: {row.month?.closedAt && Number.isFinite(Date.parse(row.month.closedAt)) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.month.closedAt)) : "Não informado"} · Responsável: {row.month?.closedByName || "Não informado"}</p>}
    </article>;
  }
  return <>
    <section className="page-heading closing-heading"><div><span className="eyebrow">{closingEnabled ? "CONFERÊNCIA E FECHAMENTO" : "SOMENTE CONFERÊNCIA"}</span><h1>Fechamento do mês</h1><p>{monthLabel(data.period)} · {closingEnabled ? "Selecione uma pessoa ou a equipe. O mês só será fechado após sua confirmação." : "Fechamento temporariamente indisponível. Você pode consultar o mês e suas pendências."}</p></div></section>
    <div className="closing-toolbar">
      <button type="button" className="secondary-button" disabled={!rows.some(row => row.status === "READY")} onClick={() => setSelection({ ...current, ids: rows.filter(row => row.status === "READY").map(row => row.contractorId) })}>Selecionar prontos para revisar</button>
      <span role="status">{current.ids.length} selecionado(s)</span>
      <button type="button" className="primary-button" disabled={!current.ids.length} onClick={review}>Revisar fechamento</button>
    </div>
    <section className="closing-groups">
      <section className="closing-group panel"><div className="panel-heading static"><div><span>{open.length} PESSOA(S)</span><h2>Para conferir</h2></div></div>{open.length ? open.map(person) : <p className="closing-empty">Nenhum colaborador para conferir neste mês.</p>}</section>
      <section className="closing-group panel"><div className="panel-heading static"><div><span>{closed.length} PESSOA(S)</span><h2>Mês fechado</h2></div></div>{closed.length ? closed.map(person) : <p className="closing-empty">Nenhum colaborador com este mês fechado.</p>}</section>
    </section>
  </>;
}

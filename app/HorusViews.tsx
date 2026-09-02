"use client";

import { useState } from "react";
import type { DashboardData, DashboardEntry } from "./dashboard-types";

export type Role = "rh" | "pj";
export type Section = "overview" | "entries" | "balance" | "requests" | "closing" | "team" | "reports" | "admin";

export function formatMinutes(minutes: number, signed = false) {
  const sign = minutes < 0 ? "−" : signed && minutes > 0 ? "+" : ""; const absolute = Math.abs(minutes);
  return sign + Math.floor(absolute / 60).toString().padStart(2, "0") + ":" + (absolute % 60).toString().padStart(2, "0");
}
export function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}
export function monthLabel(period: DashboardData["period"]) {
  if (period.year && period.month) return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(period.year, period.month - 1, 1));
  return formatDate(period.from) + " – " + formatDate(period.to);
}
function entryDay(entry: DashboardEntry) {
  const [year, month, day] = entry.workDate.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date(year, month - 1, day));
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Aberta", CLOSED: "Fechada", REOPENED: "Reaberta", MIXED: "Múltiplas",
    REQUESTED: "Pendente", APPROVED: "Aprovada", REJECTED: "Rejeitada", CANCELLED: "Cancelada", UTILIZED: "Utilizada",
    NEEDS_ADJUSTMENT: "Requer ajuste", RETROACTIVELY_APPROVED: "Aprovada retroativamente",
    AVAILABLE: "Disponível", RESERVED: "Reservado", OVERDUE_AVAILABLE: "Fora do prazo, disponível",
    OVERDUE: "Vencido", EXPIRED: "Expirado", PARTIALLY_COMPENSATED: "Parcialmente compensado",
    PENDING_AUTHORIZATION: "Aguardando autorização", AUTHORIZED: "Autorizado", NOT_APPLICABLE: "Regular",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}
function occurrenceLabel(type: string) {
  return ({ VACATION: "Férias", JUSTIFIED_ABSENCE: "Falta justificada", MEDICAL_CERTIFICATE: "Atestado", BANK_LEAVE: "Folga com banco", OTHER: "Outra ocorrência" } as Record<string, string>)[type] ?? type;
}
function statusTone(status: string) {
  if (["APPROVED", "AUTHORIZED", "AVAILABLE", "OPEN", "REOPENED", "RETROACTIVELY_APPROVED"].includes(status)) return "success";
  if (["REJECTED", "EXPIRED", "OVERDUE", "CLOSED"].includes(status)) return "danger";
  if (["REQUESTED", "PENDING_AUTHORIZATION", "NEEDS_ADJUSTMENT", "RESERVED"].includes(status)) return "warning";
  return "neutral";
}

export function Overview({ data, loading, onNavigate, onPeriod }: { data: DashboardData; loading: boolean; onNavigate: (section: Section) => void; onPeriod: (query: string) => void }) {
  const [year, setYear] = useState(data.period.year ?? new Date().getFullYear()); const [month, setMonth] = useState(data.period.month ?? new Date().getMonth() + 1);
  const [from, setFrom] = useState(data.period.from); const [to, setTo] = useState(data.period.to);
  const visibleMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  function moveMonth(offset: number) {
    const next = new Date(year, month - 1 + offset, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    setYear(nextYear);
    setMonth(nextMonth);
    void onPeriod(new URLSearchParams({ year: String(nextYear), month: String(nextMonth) }).toString());
  }
  function applyRange() { void onPeriod(new URLSearchParams({ from, to }).toString()); }
  const pending = data.metrics.pendingRequests + data.metrics.pendingOccurrences + data.metrics.pendingAuthorizations;
  return <>
    <section className="page-heading overview-heading"><div><span className="eyebrow">VISÃO CONSOLIDADA</span><h1>Painel</h1><p>{monthLabel(data.period)} · dados reais da organização</p></div>{pending > 0 && <button className="secondary-button" onClick={() => onNavigate("requests")}>{pending} pendência(s)</button>}</section>
    <section className="period-panel panel" aria-label="Selecionar período">
      <div className="month-selector">
        <span className="period-section-label">NAVEGAR POR MÊS</span>
        <div className="month-selector-controls">
          <button type="button" onClick={() => moveMonth(-1)} disabled={loading} aria-label="Voltar para o mês anterior">←</button>
          <strong aria-live="polite">{visibleMonth}</strong>
          <button type="button" onClick={() => moveMonth(1)} disabled={loading} aria-label="Avançar para o próximo mês">→</button>
        </div>
      </div>
      <div className="period-divider" aria-hidden="true" />
      <div className="custom-period-selector">
        <span className="period-section-label">INTERVALO DE DATAS</span>
        <div className="period-inline">
          <label>Data inicial<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Data final<input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <button className="primary-button" type="button" onClick={applyRange} disabled={loading || !from || !to || from > to}>Aplicar período</button>
        </div>
      </div>
    </section>
    <section className="metric-grid"><Metric label="COLABORADORES ATIVOS" value={String(data.metrics.activeContractors)} meta="Cadastros ativos" tone="violet" /><Metric label="HORAS REALIZADAS" value={formatMinutes(data.metrics.workedMinutes)} meta={"Meta " + formatMinutes(data.metrics.requiredMinutes)} tone="blue" /><Metric label="SALDO POSITIVO" value={formatMinutes(data.metrics.positiveBalanceMinutes, true)} meta="Créditos em aberto" tone="green" /><Metric label="SALDO NEGATIVO" value={formatMinutes(-data.metrics.negativeBalanceMinutes, true)} meta="Déficits em aberto" tone="amber" /></section>
    <section className="dashboard-grid"><div className="panel discipline-panel"><PanelHeading eyebrow="DISCIPLINA DE PREENCHIMENTO" title="Acompanhamento das pessoas" action="Ver todas as pessoas" onAction={() => onNavigate("team")} />{data.contractors.filter((person) => person.status === "ACTIVE").length ? <div className="table-scroll"><table><thead><tr><th>Colaborador</th><th>Último lançamento</th><th>Atraso médio</th><th>Retroativos</th><th>Preenchimento</th></tr></thead><tbody>{data.contractors.filter((person) => person.status === "ACTIVE").map((person) => <tr key={person.id}><td><div className="person-cell"><span className="mini-avatar violet">{person.initials}</span><div><strong>{person.name}</strong><small>{person.email}</small></div></div></td><td>{person.lastEntryDate ? formatDate(person.lastEntryDate) : "Sem lançamentos"}</td><td>{person.averageDelayDays} dia(s)</td><td>{person.retroactiveEntries}</td><td><div className="fill-cell"><div className="mini-progress"><span style={{ width: person.fillPercentage + "%" }} /></div><b>{person.fillPercentage}%</b></div></td></tr>)}</tbody></table></div> : <Empty text="Nenhum colaborador ativo encontrado." />}</div>
      <div className="panel balance-panel"><PanelHeading eyebrow="BANCO DE HORAS" title="Saldos mais antigos" action="Ver extrato" onAction={() => onNavigate("balance")} />{data.balanceLots.length ? <div className="lot-list">{data.balanceLots.slice(0, 5).map((lot) => <article className="lot-row" key={lot.id}><div className="lot-top"><div><strong>{lot.contractorName}</strong><span>{formatDate(lot.originDate)}</span></div><b className={lot.type === "CREDIT" ? "positive" : "negative"}>{formatMinutes((lot.type === "CREDIT" ? 1 : -1) * lot.remainingMinutes, true)}</b></div><div className="deadline-line"><small>{statusLabel(lot.status)}</small><time>{formatDate(lot.deadlineDate)}</time></div></article>)}</div> : <Empty text="Nenhum lote de saldo aberto." />}</div></section>
  </>;
}

function Metric({ label, value, meta, tone }: { label: string; value: string; meta: string; tone: string }) { return <article className="metric-card"><div className={"metric-icon " + tone}>◇</div><span>{label}</span><strong>{value}</strong><p>{meta}</p></article>; }
function PanelHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction: () => void }) { return <div className="panel-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div><button onClick={onAction}>{action} <b>→</b></button></div>; }

export function EntriesView({ role, data, onNew, onEdit, onHistory, readOnly = false }: { role: Role; data: DashboardData; onNew: () => void; onEdit: (entry: DashboardEntry) => void; onHistory: (entry: DashboardEntry) => void; readOnly?: boolean }) {
  return <><section className="page-heading"><div><span className="eyebrow">PERÍODO SELECIONADO</span><h1>{role === "rh" ? "Lançamentos da equipe" : "Meu mês"}</h1><p>{monthLabel(data.period)}</p></div>{role === "pj" && !readOnly && <button className="primary-button" onClick={onNew}>+ Registrar horas</button>}</section>
    <section className="timesheet-summary"><div><span>Horas trabalhadas</span><strong>{formatMinutes(data.timesheet.workedMinutes)}</strong></div><div><span>Horas abonadas</span><strong>{formatMinutes(data.timesheet.creditedMinutes)}</strong></div><div><span>Total considerado</span><strong>{formatMinutes(data.timesheet.consideredMinutes)}</strong><small>Meta: {formatMinutes(data.timesheet.requiredMinutes)}</small></div><div className="projected"><span>Saldo</span><strong>{formatMinutes(data.timesheet.projectedBalanceMinutes, true)}</strong><small>{statusLabel(data.timesheet.status)}</small></div></section>
    <section className="panel entries-panel">{data.entries.length ? <div className="entry-list">{data.entries.map((entry) => <article key={entry.id} className="entry-row"><div className="date-tile"><strong>{entry.workDate.slice(8, 10)}</strong><span>{entry.workDate.slice(5, 7)}</span></div><div className="entry-day"><strong>{role === "rh" ? entry.contractorName : entryDay(entry)}</strong><span>{entry.notes || entryDay(entry)}</span></div><div className="time-block"><span>Entrada</span><strong>{entry.startTime}</strong></div><div className="time-separator">→</div><div className="time-block"><span>Saída</span><strong>{entry.endTime}</strong></div><div className="time-block break-block"><span>Intervalo</span><strong>{formatMinutes(entry.breakMinutes)}</strong></div><div className="entry-total"><span>Total</span><strong>{formatMinutes(entry.calculatedMinutes)}</strong></div><span className={"status-pill " + statusTone(entry.nonBusinessDayStatus)}>{statusLabel(entry.nonBusinessDayStatus)}</span><div className="row-actions">{!readOnly && <button onClick={() => onEdit(entry)}>Editar</button>}<button onClick={() => onHistory(entry)}>Histórico</button></div></article>)}</div> : <Empty text="Nenhum lançamento no período selecionado." />}</section></>;
}

export function BalanceView({ data }: { data: DashboardData }) {
  return <><section className="page-heading"><div><span className="eyebrow">EXTRATO AUDITÁVEL</span><h1>Banco de horas</h1><p>Lotes preservados individualmente e consumidos do mais antigo para o mais novo.</p></div></section><section className="balance-hero"><div><span>SALDO LÍQUIDO</span><strong>{formatMinutes(data.metrics.positiveBalanceMinutes - data.metrics.negativeBalanceMinutes, true)}</strong></div><div className="balance-breakdown"><p><span>Créditos disponíveis</span><strong>{formatMinutes(data.metrics.positiveBalanceMinutes)}</strong></p><p><span>Déficits pendentes</span><strong>{formatMinutes(data.metrics.negativeBalanceMinutes)}</strong></p></div><div className="fifo-card"><span>FIFO</span><strong>Mais antigos primeiro</strong></div></section>
    <section className="panel ledger-panel"><div className="panel-heading static"><div><span>LOTES EM ABERTO</span><h2>Saldo por origem</h2></div></div>{data.balanceLots.length ? <div className="table-scroll"><table><thead><tr><th>Colaborador</th><th>Natureza</th><th>Origem</th><th>Saldo</th><th>Reservado</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>{data.balanceLots.map((lot) => <tr key={lot.id}><td><strong>{lot.contractorName}</strong></td><td>{lot.type === "CREDIT" ? "Crédito" : "Déficit"}</td><td>{formatDate(lot.originDate)}</td><td>{formatMinutes((lot.type === "CREDIT" ? 1 : -1) * lot.remainingMinutes, true)}</td><td>{formatMinutes(lot.reservedMinutes)}</td><td>{formatDate(lot.deadlineDate)}</td><td><span className={"status-pill " + statusTone(lot.status)}>{statusLabel(lot.status)}</span></td></tr>)}</tbody></table></div> : <Empty text="Nenhum saldo aberto." />}</section>
    <section className="panel ledger-panel"><div className="panel-heading static"><div><span>MOVIMENTAÇÕES</span><h2>Extrato recente</h2></div></div>{data.balanceTransactions.length ? <div className="table-scroll"><table><thead><tr><th>Data</th><th>Colaborador</th><th>Tipo</th><th>Horas</th><th>Descrição</th></tr></thead><tbody>{data.balanceTransactions.map((transaction) => <tr key={transaction.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(transaction.createdAt))}</td><td>{transaction.contractorName}</td><td>{statusLabel(transaction.type)}</td><td>{formatMinutes(transaction.minutes)}</td><td>{transaction.description}</td></tr>)}</tbody></table></div> : <Empty text="Nenhuma movimentação registrada." />}</section></>;
}

type RequestActions = { onNewLeave: () => void; onNewOccurrence: () => void; onNewAuthorization: () => void; onDecision: (resource: "leave-requests" | "occurrences" | "non-business-authorizations", id: string, action: string) => void };
export function RequestsView({ data, role, onNewLeave, onNewOccurrence, onNewAuthorization, onDecision, readOnly = false }: { data: DashboardData; role: Role; readOnly?: boolean } & RequestActions) {
  return <><section className="page-heading"><div><span className="eyebrow">FLUXOS DE APROVAÇÃO</span><h1>Solicitações e ocorrências</h1><p>{role === "rh" ? "Decisões com autoria e reflexo automático nos cálculos." : readOnly ? "Visualização das solicitações do colaborador selecionado." : "Acompanhe seus pedidos e envie novas solicitações."}</p></div>{!readOnly && <div className="heading-actions"><button className="secondary-button" onClick={onNewOccurrence}>+ Ocorrência</button><button className="secondary-button" onClick={onNewAuthorization}>+ Dia não útil</button><button className="primary-button" onClick={onNewLeave}>+ Solicitar folga</button></div>}</section>
    <RequestSection title="Folgas com banco de horas" count={data.requests.filter((item) => item.status === "REQUESTED").length}>{data.requests.length ? data.requests.map((item) => <RequestCard key={item.id} title={item.contractorName} meta={`${formatDate(item.startDate)} a ${formatDate(item.endDate)} · ${formatMinutes(item.requestedMinutes)}`} detail={item.reason || "Sem justificativa informada."} status={item.status}>{!readOnly && item.status === "REQUESTED" && (role === "rh" ? <><button onClick={() => onDecision("leave-requests", item.id, "REJECT")}>Rejeitar</button><button className="approve" onClick={() => onDecision("leave-requests", item.id, "APPROVE")}>Aprovar</button></> : <button onClick={() => onDecision("leave-requests", item.id, "CANCEL")}>Cancelar</button>)}{!readOnly && role === "rh" && item.status === "APPROVED" && <button className="approve" onClick={() => onDecision("leave-requests", item.id, "UTILIZE")}>Marcar utilizada</button>}</RequestCard>) : <Empty text="Nenhuma solicitação de folga." />}</RequestSection>
    <RequestSection title="Ocorrências e abonos" count={data.occurrences.filter((item) => item.status === "REQUESTED").length}>{data.occurrences.length ? data.occurrences.map((item) => <RequestCard key={item.id} title={`${occurrenceLabel(item.type)} · ${item.contractorName}`} meta={`${formatDate(item.startDate)} · ${formatMinutes(item.minutes)}`} detail={item.description || "Sem descrição."} status={item.status}>{!readOnly && item.status === "REQUESTED" && (role === "rh" ? <><button onClick={() => onDecision("occurrences", item.id, "REJECT")}>Rejeitar</button><button className="approve" onClick={() => onDecision("occurrences", item.id, "APPROVE")}>Aprovar</button></> : <button onClick={() => onDecision("occurrences", item.id, "CANCEL")}>Cancelar</button>)}</RequestCard>) : <Empty text="Nenhuma ocorrência no período." />}</RequestSection>
    <RequestSection title="Trabalho em dias não úteis" count={data.authorizations.filter((item) => item.status === "REQUESTED").length}>{data.authorizations.length ? data.authorizations.map((item) => <RequestCard key={item.id} title={item.contractorName} meta={`${formatDate(item.workDate)} · ${formatMinutes(item.estimatedMinutes)}`} detail={item.reason || "Sem justificativa."} status={item.status}>{!readOnly && role === "rh" && item.status === "REQUESTED" && <><button onClick={() => onDecision("non-business-authorizations", item.id, "NEEDS_ADJUSTMENT")}>Solicitar ajuste</button><button onClick={() => onDecision("non-business-authorizations", item.id, "REJECT")}>Rejeitar</button><button className="approve" onClick={() => onDecision("non-business-authorizations", item.id, "APPROVE")}>Aprovar</button></>}</RequestCard>) : <Empty text="Nenhuma autorização no período." />}</RequestSection>
  </>;
}
function RequestSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <section className="request-section panel"><div className="panel-heading static"><div><span>{count} PENDENTE(S)</span><h2>{title}</h2></div></div><div className="request-list">{children}</div></section>; }
function RequestCard({ title, meta, detail, status, children }: { title: string; meta: string; detail: string; status: string; children: React.ReactNode }) { return <article className="request-card"><div className="request-card-icon">◇</div><div className="request-card-main"><span>REGISTRO</span><h3>{title}</h3><p>{meta}</p><small>{detail}</small></div><div className="request-card-status"><span className={statusTone(status)}>{statusLabel(status)}</span></div><div className="request-actions">{children}</div></article>; }

export function TeamView({ data, onNew, onStatus, onSetPassword }: { data: DashboardData; onNew: () => void; onStatus: (id: string, next: "ACTIVE" | "INACTIVE") => void; onSetPassword: (id: string, name: string) => void }) {
  return <><section className="page-heading"><div><span className="eyebrow">{data.metrics.activeContractors} COLABORADORES ATIVOS</span><h1>Pessoas</h1><p>Cadastros, acesso e situação dos colaboradores.</p></div><button className="primary-button" onClick={onNew}>+ Novo colaborador</button></section><section className="team-grid">{data.contractors.length ? data.contractors.map((person) => <article className={"team-card " + (person.status === "INACTIVE" ? "inactive" : "")} key={person.id}><div className="team-avatar violet">{person.initials}</div><div className="team-person"><h3>{person.name}</h3><span>{person.email}</span></div><span className={"status-pill " + (person.status === "ACTIVE" ? "success" : "neutral")}>{person.status === "ACTIVE" ? "Ativo" : "Inativo"}</span><div className="team-stats"><p><span>Preenchimento</span><strong>{person.fillPercentage}%</strong></p><p><span>Atraso médio</span><strong>{person.averageDelayDays}d</strong></p></div><div className="team-progress"><span style={{ width: person.fillPercentage + "%" }} /></div><div className="team-actions"><button onClick={() => onSetPassword(person.id, person.name)}>Definir senha</button><button onClick={() => onStatus(person.id, person.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{person.status === "ACTIVE" ? "Inativar" : "Reativar"}</button></div></article>) : <Empty text="Nenhum colaborador cadastrado." />}</section></>;
}

export function ReportsView({ data, onPolicy }: { data: DashboardData; onPolicy: () => void }) {
  const base = `from=${encodeURIComponent(data.period.from)}&to=${encodeURIComponent(data.period.to)}`;
  return <><section className="page-heading"><div><span className="eyebrow">RELATÓRIOS E CONTROLE</span><h1>Relatórios</h1><p>Exportações respeitam o período selecionado na visão geral.</p></div><button className="secondary-button" onClick={onPolicy}>Configurar políticas</button></section><section className="report-grid"><ReportCard title="Lançamentos" text="Horas trabalhadas, consideradas, atraso e observações." href={`/api/reports/export?type=entries&${base}`} /><ReportCard title="Banco de horas" text="Lotes, origem, prazo, reservas e saldos remanescentes." href={`/api/reports/export?type=balances&${base}`} /><ReportCard title="Auditoria" text="Ações, responsáveis e justificativas registradas." href={`/api/reports/export?type=audit&${base}`} /></section><section className="panel ledger-panel"><div className="panel-heading static"><div><span>TRILHA DE AUDITORIA</span><h2>Ações recentes</h2></div></div>{data.audits.length ? <div className="table-scroll"><table><thead><tr><th>Data</th><th>Responsável</th><th>Ação</th><th>Entidade</th><th>Justificativa</th></tr></thead><tbody>{data.audits.map((audit) => <tr key={audit.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(audit.createdAt))}</td><td>{audit.userName}</td><td>{statusLabel(audit.action)}</td><td>{audit.entityType}</td><td>{audit.reason || "—"}</td></tr>)}</tbody></table></div> : <Empty text="Nenhuma ação registrada." />}</section></>;
}
function ReportCard({ title, text, href }: { title: string; text: string; href: string }) { return <article className="report-card"><div>↓</div><h2>{title}</h2><p>{text}</p><a className="primary-button" href={href}>Exportar CSV <span>→</span></a></article>; }
export function Empty({ text }: { text: string }) { return <div className="empty-state"><strong>Sem dados</strong><p>{text}</p></div>; }

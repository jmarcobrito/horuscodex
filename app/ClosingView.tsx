"use client";

import type { TimesheetPreview, TimesheetPreviewState } from "../db/timesheet-preview";
import type { DashboardContractor, DashboardData } from "./dashboard-types";
import { Empty, formatMinutes, monthLabel } from "./HorusViews";

type Props = {
  data: DashboardData;
  loading: boolean;
  onClose: (preview: TimesheetPreview, allowEmptyMonth?: boolean) => void;
  onCloseReady: (previews: TimesheetPreview[]) => void;
  onReopen: (preview: TimesheetPreview) => void;
};

const blockerNames: Record<string, string> = {
  PENDING_LEAVE: "Há uma folga aguardando análise.",
  PENDING_OCCURRENCE: "Há uma ausência aguardando análise.",
  PENDING_NON_BUSINESS_AUTH: "Há trabalho em dia não útil aguardando análise.",
  INCOMPLETE_DAILY_ALLOCATION: "As horas do período ainda não foram distribuídas por dia.",
  NO_ENTRIES: "Nenhuma hora foi registrada neste mês.",
  ALREADY_CLOSED: "Este mês já está fechado.",
};

function personFor(data: DashboardData, preview: TimesheetPreview): DashboardContractor | undefined {
  return data.contractors.find((person) => person.id === preview.contractorId);
}

function ClosingCard({ data, preview, loading, onClose, onReopen }: { data: DashboardData; preview: TimesheetPreview; loading: boolean; onClose: Props["onClose"]; onReopen: Props["onReopen"] }) {
  const person = personFor(data, preview);
  const noEntriesOnly = preview.blockers.length === 1 && preview.blockers[0].code === "NO_ENTRIES";
  return <article className="closing-card">
    <div className="closing-person"><span className="mini-avatar violet">{person?.initials ?? "?"}</span><div><h3>{person?.name ?? "Prestador"}</h3><p>{person?.email ?? "Cadastro não encontrado"}</p></div></div>
    <div className="closing-totals"><p><span>Total considerado</span><strong>{formatMinutes(preview.consideredMinutes)}</strong></p><p><span>Meta do mês</span><strong>{formatMinutes(preview.requiredMinutes)}</strong></p><p><span>Impacto no banco</span><strong className={preview.projectedBalanceMinutes >= 0 ? "positive" : "negative"}>{formatMinutes(preview.projectedBalanceMinutes, true)}</strong></p></div>
    {preview.blockers.length > 0 && <ul className="closing-blockers">{preview.blockers.map((blocker) => <li key={blocker.code}><strong>{blockerNames[blocker.code] ?? blocker.message}</strong><span>{blocker.action}</span></li>)}</ul>}
    {preview.warnings.length > 0 && <div className="closing-warnings">{preview.warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}</div>}
    <div className="closing-card-actions">{preview.state === "READY" && <button className="primary-button" disabled={loading} onClick={() => onClose(preview)}>Revisar e fechar</button>}{noEntriesOnly && <button className="secondary-button" disabled={loading} onClick={() => onClose(preview, true)}>Fechar mês sem horas registradas</button>}{preview.state === "CLOSED" && <button className="secondary-button" disabled={loading} onClick={() => onReopen(preview)}>Revisar reabertura</button>}</div>
  </article>;
}

function ClosingGroup({ state, title, description, data, previews, loading, onClose, onReopen }: { state: TimesheetPreviewState; title: string; description: string; data: DashboardData; previews: TimesheetPreview[]; loading: boolean; onClose: Props["onClose"]; onReopen: Props["onReopen"] }) {
  return <section className={`closing-group ${state.toLowerCase()}`}><header><div><span>{previews.length} PESSOA(S)</span><h2>{title}</h2><p>{description}</p></div></header><div className="closing-list">{previews.length ? previews.map((preview) => <ClosingCard key={preview.contractorId} data={data} preview={preview} loading={loading} onClose={onClose} onReopen={onReopen} />) : <Empty text="Nenhuma pessoa nesta etapa." />}</div></section>;
}

export function ClosingView({ data, loading, onClose, onCloseReady, onReopen }: Props) {
  const ready = data.closingPreviews.filter((preview) => preview.state === "READY");
  const needsReview = data.closingPreviews.filter((preview) => preview.state === "NEEDS_REVIEW");
  const closed = data.closingPreviews.filter((preview) => preview.state === "CLOSED");
  return <>
    <section className="page-heading closing-heading"><div><span className="eyebrow">CONFERÊNCIA DA FOLHA</span><h1>Fechamento do mês</h1><p>{monthLabel(data.period)} · revise as pendências antes de gerar qualquer movimentação no banco de horas.</p></div>{ready.length > 0 && <button className="primary-button" disabled={loading} onClick={() => onCloseReady(ready)}>Fechar todos os prontos ({ready.length})</button>}</section>
    {!data.period.year || !data.period.month ? <section className="panel"><Empty text="Selecione um mês completo no Painel para iniciar o fechamento." /></section> : <div className="closing-board">
      <ClosingGroup state="READY" title="Prontas para fechar" description="Conferência concluída e sem pendências." data={data} previews={ready} loading={loading} onClose={onClose} onReopen={onReopen} />
      <ClosingGroup state="NEEDS_REVIEW" title="Precisam de revisão" description="Resolva cada pendência antes de fechar." data={data} previews={needsReview} loading={loading} onClose={onClose} onReopen={onReopen} />
      <ClosingGroup state="CLOSED" title="Mês fechado" description="Fechamentos concluídos e disponíveis para consulta." data={data} previews={closed} loading={loading} onClose={onClose} onReopen={onReopen} />
    </div>}
  </>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApprovalInboxItem } from "../db/approval-inbox";
import type { DashboardData } from "./dashboard-types";
import { Empty, formatDate, formatMinutes, type Role } from "./HorusViews";

type Resource = "leave-requests" | "occurrences" | "non-business-authorizations";
type KindFilter = "ALL" | ApprovalInboxItem["kind"];

type Props = {
  data: DashboardData;
  role: Role;
  readOnly?: boolean;
  onNewLeave: () => void;
  onNewOccurrence: () => void;
  onNewAuthorization: () => void;
  onDecision: (resource: Resource, id: string, action: string) => void;
};

const kindNames: Record<ApprovalInboxItem["kind"], string> = {
  LEAVE: "Folga com banco de horas",
  OCCURRENCE: "Ausência ou justificativa",
  NON_BUSINESS_AUTHORIZATION: "Trabalho em dia não útil",
};

function statusName(status: string) {
  return ({
    REQUESTED: "Aguardando análise",
    APPROVED: "Aprovada",
    REJECTED: "Rejeitada",
    CANCELLED: "Cancelada",
    NEEDS_ADJUSTMENT: "Ajuste solicitado",
    RETROACTIVELY_APPROVED: "Aprovada depois do prazo",
  } as Record<string, string>)[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function resourceFor(kind: ApprovalInboxItem["kind"]): Resource {
  if (kind === "LEAVE") return "leave-requests";
  if (kind === "OCCURRENCE") return "occurrences";
  return "non-business-authorizations";
}

function itemDetails(data: DashboardData, item: ApprovalInboxItem) {
  if (item.kind === "LEAVE") {
    const source = data.requests.find((request) => request.id === item.id);
    return {
      name: source?.contractorName ?? "Prestador",
      amount: formatMinutes(source?.requestedMinutes ?? 0),
      detail: source?.reason || "Sem justificativa informada.",
    };
  }
  if (item.kind === "OCCURRENCE") {
    const source = data.occurrences.find((occurrence) => occurrence.id === item.id);
    return {
      name: source?.contractorName ?? "Prestador",
      amount: formatMinutes(source?.minutes ?? 0),
      detail: source?.description || "Sem descrição informada.",
    };
  }
  const source = data.authorizations.find((authorization) => authorization.id === item.id);
  return {
    name: source?.contractorName ?? "Prestador",
    amount: formatMinutes(source?.estimatedMinutes ?? 0),
    detail: source?.reason || "Sem justificativa informada.",
  };
}

export function ApprovalInboxView({ data, role, readOnly = false, onNewLeave, onNewOccurrence, onNewAuthorization, onDecision }: Props) {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [filter, setFilter] = useState<KindFilter>("ALL");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const source = tab === "pending" ? data.approvalInbox.pending : data.approvalInbox.history.items;
  const visibleItems = useMemo(() => source.filter((item) => filter === "ALL" || item.kind === filter), [filter, source]);

  useEffect(() => {
    function closeMenu(event: KeyboardEvent) { if (event.key === "Escape") setNewMenuOpen(false); }
    window.addEventListener("keydown", closeMenu);
    return () => window.removeEventListener("keydown", closeMenu);
  }, []);

  function openNew(action: () => void) {
    setNewMenuOpen(false);
    action();
  }

  return <>
    <section className="page-heading approval-heading"><div><span className="eyebrow">FLUXO DE DECISÕES</span><h1>{role === "rh" ? "Aprovações" : "Solicitações"}</h1><p>{role === "rh" ? "Analise primeiro o que está pendente e consulte decisões anteriores no histórico." : "Envie pedidos e acompanhe a decisão do RH em um único lugar."}</p></div>{!readOnly && <div className="new-request-wrap"><button className="primary-button" aria-expanded={newMenuOpen} onClick={() => setNewMenuOpen((open) => !open)}>+ Nova solicitação</button>{newMenuOpen && <div className="new-request-menu" role="menu"><button role="menuitem" onClick={() => openNew(onNewLeave)}><strong>Solicitar folga</strong><span>Usar saldo do banco de horas</span></button><button role="menuitem" onClick={() => openNew(onNewOccurrence)}><strong>Informar ausência</strong><span>Atestado, férias ou justificativa</span></button><button role="menuitem" onClick={() => openNew(onNewAuthorization)}><strong>Trabalhar em dia não útil</strong><span>Pedir autorização prévia</span></button></div>}</div>}</section>
    <section className="approval-toolbar" aria-label="Organização das solicitações">
      <div className="approval-tabs" role="tablist"><button role="tab" aria-selected={tab === "pending"} className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>Aguardando análise <span>{data.approvalInbox.pending.length}</span></button><button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Histórico</button></div>
      <div className="approval-filters" aria-label="Filtrar por tipo">{(["ALL", "LEAVE", "OCCURRENCE", "NON_BUSINESS_AUTHORIZATION"] as KindFilter[]).map((kind) => <button key={kind} className={filter === kind ? "active" : ""} onClick={() => setFilter(kind)}>{kind === "ALL" ? "Todos" : kind === "LEAVE" ? "Folgas" : kind === "OCCURRENCE" ? "Ausências" : "Dias não úteis"}</button>)}</div>
    </section>
    <section className="approval-list" aria-live="polite">{visibleItems.length ? visibleItems.map((item) => {
      const details = itemDetails(data, item);
      const pending = item.status === "REQUESTED";
      return <article className="approval-card" key={`${item.kind}-${item.id}`}>
        <div className={`approval-kind ${item.kind.toLowerCase()}`} aria-hidden="true">◇</div>
        <div className="approval-card-main"><span>{kindNames[item.kind]}</span><h2>{details.name}</h2><p>{formatDate(item.startDate)}{item.endDate !== item.startDate ? ` a ${formatDate(item.endDate)}` : ""} · {details.amount}</p><small>{details.detail}</small></div>
        <div className="approval-state"><span className={pending ? "warning" : item.status === "APPROVED" || item.status === "RETROACTIVELY_APPROVED" ? "success" : "neutral"}>{statusName(item.status)}</span><time>{formatDate(item.requestedAt.slice(0, 10))}</time></div>
        {!readOnly && pending && <div className="approval-actions">{role === "rh" ? <>{item.kind === "NON_BUSINESS_AUTHORIZATION" && <button onClick={() => onDecision(resourceFor(item.kind), item.id, "NEEDS_ADJUSTMENT")}>Pedir ajuste</button>}<button onClick={() => onDecision(resourceFor(item.kind), item.id, "REJECT")}>Rejeitar</button><button className="approve" onClick={() => onDecision(resourceFor(item.kind), item.id, "APPROVE")}>Aprovar</button></> : item.kind !== "NON_BUSINESS_AUTHORIZATION" ? <button onClick={() => onDecision(resourceFor(item.kind), item.id, "CANCEL")}>Cancelar solicitação</button> : null}</div>}
      </article>;
    }) : <div className="panel"><Empty text={tab === "pending" ? "Não há solicitações aguardando análise com este filtro." : "Ainda não há decisões no histórico com este filtro."} /></div>}</section>
  </>;
}

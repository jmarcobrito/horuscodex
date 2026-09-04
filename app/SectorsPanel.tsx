"use client";

import { FormEvent, useRef, useState } from "react";
import type { AdminSector, SectorUpdate } from "./admin-types";
import { Modal } from "./Modal";

type Props = {
  sectors: AdminSector[];
  loading: boolean;
  onCreate: (name: string) => boolean | void | Promise<boolean | void>;
  onUpdate: (sector: AdminSector, update: SectorUpdate) => boolean | void | Promise<boolean | void>;
};

type Editor = { kind: "create" } | { kind: "rename" | "status"; sector: AdminSector };

export function SectorsPanel({ sectors, loading, onCreate, onUpdate }: Props) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const inFlight = useRef(false);
  const busy = loading || pending;

  function openCreate() {
    setName(""); setReason(""); setEditor({ kind: "create" });
  }

  function openUpdate(kind: "rename" | "status", sector: AdminSector) {
    setName(sector.name); setReason(""); setEditor({ kind, sector });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || inFlight.current) return;
    inFlight.current = true; setPending(true); setStatus("");
    try {
      if (editor.kind === "create") {
        const saved = await onCreate(name.trim());
        if (saved === false) return;
        setStatus("Setor criado.");
      } else {
        const nextStatus = editor.kind === "status"
          ? editor.sector.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
          : editor.sector.status;
        const saved = await onUpdate(editor.sector, { name: name.trim(), status: nextStatus, reason: reason.trim() });
        if (saved === false) return;
        setStatus(editor.kind === "rename" ? "Nome do setor atualizado." : nextStatus === "ACTIVE" ? "Setor reativado." : "Setor inativado.");
      }
      setEditor(null);
    } finally {
      inFlight.current = false; setPending(false);
    }
  }

  return <>
    <section className="panel sector-panel" aria-labelledby="sectors-title">
      <div className="panel-heading"><div><span>CLASSIFICAÇÃO ATUAL</span><h2 id="sectors-title">Setores da organização</h2></div><button type="button" onClick={openCreate} disabled={busy}>+ Novo setor</button></div>
      {loading && sectors.length === 0 ? <div className="empty-state" role="status"><strong>Carregando setores…</strong></div> : sectors.length ? <div className="sector-list">{sectors.map(sector => <article key={sector.id} className={sector.status === "INACTIVE" ? "inactive" : ""}>
        <div><strong>{sector.name}</strong><span>{sector.memberCount} {sector.memberCount === 1 ? "colaborador" : "colaboradores"}</span></div>
        <span className={`status-pill ${sector.status === "ACTIVE" ? "success" : "neutral"}`}>{sector.status === "ACTIVE" ? "Ativo" : "Inativo"}</span>
        <div className="team-actions">
          <button type="button" onClick={() => openUpdate("rename", sector)} disabled={busy}>Renomear</button>
          <button type="button" onClick={() => openUpdate("status", sector)} disabled={busy}>{sector.status === "ACTIVE" ? "Inativar" : "Reativar"}</button>
        </div>
      </article>)}</div> : <div className="empty-state"><strong>Nenhum setor cadastrado</strong><p>Crie o primeiro setor para classificar os colaboradores.</p></div>}
    </section>
    <p role="status" aria-live="polite" className="competence-state">{status}</p>
    {editor && <Modal
      title={editor.kind === "create" ? "Novo setor" : editor.kind === "rename" ? "Renomear setor" : editor.sector.status === "ACTIVE" ? "Inativar setor" : "Reativar setor"}
      eyebrow="ADMINISTRAÇÃO DE SETORES"
      description={editor.kind === "status" ? "A situação muda sem excluir o setor nem alterar registros históricos." : "Use um nome claro para toda a organização."}
      busy={busy}
      onClose={() => setEditor(null)}
    ><form onSubmit={submit}>
      <label className="field full-field">Nome do setor<input value={name} onChange={event => setName(event.target.value)} minLength={1} maxLength={120} required disabled={editor.kind === "status"} /></label>
      {editor.kind !== "create" && <label className="field full-field">Justificativa<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={2000} required /></label>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={busy}>{busy ? "Processando…" : editor.kind === "create" ? "Criar setor" : editor.kind === "rename" ? "Salvar nome" : editor.sector.status === "ACTIVE" ? "Inativar setor" : "Reativar setor"}</button></div>
    </form></Modal>}
  </>;
}

"use client";

import { formatMinutes } from "./HorusViews";
export type HistoryVersion = { id: string; version_number: number; previous_data: Record<string, unknown>; new_data: Record<string, unknown>; changed_by: string; changed_by_name?: string | null; change_reason: string | null; changed_at: string };
export type HistoryState =
  | { status: "loading"; entryId: string }
  | { status: "error"; entryId: string; message: string }
  | { status: "ready"; entryId: string; versions: HistoryVersion[]; timezone?: string };
const fields = [["Entrada", "start_time"], ["Saída", "end_time"], ["Intervalo", "break_minutes"], ["Observação", "notes"], ["Horas calculadas", "calculated_minutes"], ["Horas consideradas", "eligible_minutes"], ["Autorização do dia", "non_business_day_status"]] as const;
const authorizationLabels: Readonly<Record<string, string>> = { NOT_APPLICABLE: "Regular", PENDING_AUTHORIZATION: "Aguardando autorização", AUTHORIZED: "Autorizado", REJECTED: "Rejeitado", NEEDS_ADJUSTMENT: "Requer ajuste" };
export function historyFields(version: HistoryVersion) {
  const display = (data: Record<string, unknown>, key: string) => {
    const value = data[key];
    if (value === null || value === undefined) return "Não informado";
    if (key === "start_time" || key === "end_time") return String(value).slice(0, 5) || "Não informado";
    if (key === "break_minutes") return Number.isFinite(Number(value)) ? value + " min" : "Não informado";
    if (key === "calculated_minutes" || key === "eligible_minutes") return Number.isFinite(Number(value)) ? formatMinutes(Number(value)) : "Não informado";
    if (key === "non_business_day_status") return Object.hasOwn(authorizationLabels, String(value)) ? authorizationLabels[String(value)] : "Situação não reconhecida";
    return String(value) || "Sem observação";
  };
  return fields.map(([label, key]) => ({ label, before: display(version.previous_data, key), after: display(version.new_data, key) }));
}
export function EntryHistory({ state, names, onRetry }: { state: HistoryState; names: ReadonlyMap<string, string>; onRetry: () => void }) {
  if (state.status === "loading") return <div className="history-status" role="status">Carregando histórico deste dia…</div>;
  if (state.status === "error") return <div className="history-status" role="alert"><h3>Não foi possível carregar o histórico</h3><p>{state.message}</p><button type="button" className="secondary-button" onClick={onRetry}>Tentar novamente</button></div>;
  if (!state.versions.length) return <div className="history-status" role="status">Este dia ainda não teve alterações.</div>;
  return <div className="history-list">{state.versions.map(version => {
    const date = new Date(version.changed_at);
    return <article key={version.id}>
      <h3>Versão {version.version_number}</h3>
      <p><time>{Number.isNaN(date.getTime()) ? "Data não disponível" : new Intl.DateTimeFormat("pt-BR", { timeZone: state.timezone ?? "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(date)}</time> · {version.changed_by_name ?? names.get(version.changed_by) ?? "Responsável não identificado"}</p>
      <p>{version.change_reason || "Justificativa não informada"}</p>
      <table className="history-comparison"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>{historyFields(version).map(field => <tr key={field.label}><th scope="row">{field.label}</th><td>{field.before}</td><td>{field.after}</td></tr>)}</tbody></table>
    </article>;
  })}</div>;
}

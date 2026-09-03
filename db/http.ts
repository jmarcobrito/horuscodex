import { actorErrorResponse } from "./actor";
import { SupabaseConfigurationError } from "./supabase";

const databaseFailures: Record<string, { status: number; error: string }> = {
  "Invalid leave request values": { status: 400, error: "Dados da solicitação de folga inválidos." },
  "Insufficient leave notice": { status: 409, error: "A data não atende à antecedência mínima para solicitar folga. Confira a política da empresa." },
  "Incomplete history read": { status: 502, error: "Não foi possível carregar o histórico completo. Tente novamente." },
  "History changed during read": { status: 409, error: "Os registros mudaram durante a consulta. Atualize para carregar o histórico completo." },
  "Timesheet is closed": { status: 409, error: "O mês está fechado. Solicite a reabertura ao RH." },
  "Invalid contractor": { status: 400, error: "Colaborador inválido ou inativo." },
  "Forbidden operation": { status: 403, error: "Você não tem permissão para realizar esta ação." },
  "Invalid authorization values": { status: 400, error: "Dados da autorização inválidos." },
  "Invalid occurrence values": { status: 400, error: "Dados da ocorrência inválidos." },
  "Invalid period": { status: 400, error: "Período inválido. Selecione datas entre 2000 e 2200." },
  "Invalid record identity": { status: 400, error: "Não é possível mudar a identificação deste registro." },
  "Invalid timesheet reference": { status: 400, error: "O lançamento não corresponde ao mês selecionado." },
  "Invalid time entry values": { status: 400, error: "Dados do lançamento inválidos." },
  "Request not found": { status: 404, error: "Solicitação não encontrada." },
  "Request is not pending": { status: 409, error: "A solicitação já foi decidida. Atualize a página para conferir." },
  "Insufficient credit balance": { status: 409, error: "Saldo de crédito insuficiente para aprovar a folga." },
  "Pending non-business day authorization": { status: 409, error: "Existem autorizações de dia não útil pendentes. Resolva-as antes de fechar o mês." },
  "Pending occurrence": { status: 409, error: "Existem ocorrências aguardando decisão neste mês." },
  "Timesheet not found": { status: 409, error: "Mês não encontrado." },
  "Timesheet is not closed": { status: 409, error: "O mês não está fechado." },
  "Later balance movements prevent reopening": { status: 409, error: "O mês possui movimentações posteriores e não pode ser reaberto automaticamente." },
  "Reopen reason is required": { status: 409, error: "Informe uma justificativa para reabrir o mês." },
  "Request cannot be cancelled": { status: 409, error: "A solicitação não pode ser cancelada nesta situação." },
  "Request is not approved": { status: 409, error: "A solicitação ainda não foi aprovada." },
};

export function apiFailure(error: unknown, operation: string) {
  const actorResponse = actorErrorResponse(error);
  if (actorResponse) return actorResponse;
  if (error instanceof SupabaseConfigurationError) {
    return Response.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }
  // PostgREST returns plain objects, not necessarily Error instances.
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
  const known = Object.hasOwn(databaseFailures, message) ? databaseFailures[message] : undefined;
  // Do not expose/log row contents, SQL details or unrecognized database messages.
  console.error("[horus] " + operation + " failed", known ? message : "Unrecognized database error");
  return Response.json({ error: known?.error ?? "Não foi possível concluir a operação." }, { status: known?.status ?? 502 });
}

export function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { return null; }
}

export function cleanText(value: unknown, maxLength = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}


import { actorErrorResponse } from "./actor";
import { SupabaseConfigurationError } from "./supabase";

export function apiFailure(error: unknown, operation: string) {
  const actorResponse = actorErrorResponse(error);
  if (actorResponse) return actorResponse;
  console.error("[horus] " + operation + " failed", error);
  if (error instanceof SupabaseConfigurationError) {
    return Response.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  const known = [
    "Timesheet is closed", "Invalid contractor", "Request not found", "Request is not pending",
    "Insufficient credit balance", "Pending non-business day authorization", "Pending occurrence",
    "Timesheet not found", "Timesheet is not closed", "Later balance movements prevent reopening",
    "Reopen reason is required", "Request cannot be cancelled", "Request is not approved",
  ];
  const status = known.some((item) => message.includes(item)) ? 409 : 502;
  return Response.json({ error: translateDatabaseError(message) }, { status });
}

function translateDatabaseError(message: string) {
  if (message.includes("Timesheet is closed")) return "A competência está fechada. Solicite a reabertura ao RH.";
  if (message.includes("Invalid contractor")) return "Prestador inválido ou inativo.";
  if (message.includes("Insufficient credit balance")) return "Saldo de crédito insuficiente para aprovar a folga.";
  if (message.includes("Pending non-business day authorization")) return "Existem horas em dia não útil aguardando autorização.";
  if (message.includes("Pending occurrence")) return "Existem ocorrências aguardando decisão nesta competência.";
  if (message.includes("Later balance movements prevent reopening")) return "A competência possui movimentações posteriores e não pode ser reaberta automaticamente.";
  if (message.includes("Reopen reason is required")) return "Informe uma justificativa para reabrir a competência.";
  if (message.includes("Timesheet not found")) return "Competência não encontrada.";
  if (message.includes("Timesheet is not closed")) return "A competência não está fechada.";
  if (message.includes("Request")) return "A solicitação não está em uma situação compatível com essa ação.";
  return "Não foi possível concluir a operação.";
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


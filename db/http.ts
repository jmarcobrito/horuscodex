import { actorErrorResponse } from "./actor";
import { domainError, domainErrorFromUnknown, domainErrorResponse, type DomainErrorCode } from "./domain-errors";
import { SupabaseConfigurationError } from "./supabase";

export function apiError(
  code: string,
  message: string,
  status: number,
  field: string | null = null,
  action = "REVIEW_FIELDS",
) {
  return Response.json({ error: { code, message, field, action } }, { status });
}

export function apiDomainError(code: DomainErrorCode, field: string | null = null) {
  const response = domainErrorResponse(domainError(code, field));
  return Response.json(response.body, { status: response.status });
}

export function apiFailure(error: unknown, operation: string) {
  const domain = domainErrorFromUnknown(error);
  if (domain) {
    const response = domainErrorResponse(domain);
    return Response.json(response.body, { status: response.status });
  }
  const actorResponse = actorErrorResponse(error);
  if (actorResponse) return actorResponse;
  console.error("[horus] " + operation + " failed", error);
  if (error instanceof SupabaseConfigurationError) {
    return apiError("SERVICE_UNAVAILABLE", "O sistema está temporariamente indisponível.", 503, null, "TRY_AGAIN");
  }
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  const legacy: Array<[string, DomainErrorCode]> = [
    ["Timesheet is closed", "MONTH_ALREADY_CLOSED"],
    ["Invalid contractor", "CONTRACTOR_NOT_FOUND"],
    ["Insufficient credit balance", "INSUFFICIENT_CREDIT_BALANCE"],
    ["Pending non-business day authorization", "PENDING_NON_BUSINESS_AUTH"],
    ["Pending occurrence", "PENDING_OCCURRENCE"],
    ["Later balance movements prevent reopening", "BALANCE_ALREADY_USED"],
    ["Reopen reason is required", "REOPEN_REASON_REQUIRED"],
    ["Timesheet is not closed", "TIMESHEET_NOT_CLOSED"],
  ];
  const legacyCode = legacy.find(([text]) => message.includes(text))?.[1];
  const response = domainErrorResponse(legacyCode ? domainError(legacyCode) : error);
  return Response.json(response.body, { status: response.status });
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


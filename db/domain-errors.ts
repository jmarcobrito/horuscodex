export type DomainErrorCode =
  | "INVALID_DAILY_ALLOCATION"
  | "DAILY_TOTAL_MISMATCH"
  | "DUPLICATE_DAY"
  | "DAY_OUTSIDE_PERIOD"
  | "MONTH_ALREADY_CLOSED"
  | "REVIEW_OUTDATED"
  | "NO_ENTRIES"
  | "PENDING_LEAVE"
  | "PENDING_OCCURRENCE"
  | "PENDING_NON_BUSINESS_AUTH"
  | "INCOMPLETE_DAILY_ALLOCATION"
  | "BALANCE_ALREADY_USED"
  | "ALREADY_CLOSED"
  | "INVALID_PERIOD"
  | "ACTOR_NOT_AUTHORIZED"
  | "CONTRACTOR_NOT_FOUND"
  | "REVIEW_REQUIRED"
  | "EMPTY_MONTH_REASON_REQUIRED"
  | "EMPTY_MONTH_EXCEPTION_NOT_APPLICABLE"
  | "RESERVED_CREDIT_MISMATCH"
  | "TIMESHEET_NOT_CLOSED"
  | "REOPEN_REASON_REQUIRED"
  | "LEGACY_CLOSING_REQUIRES_MANUAL_REVIEW"
  | "OCCURRENCE_NOT_FOUND"
  | "OCCURRENCE_ALREADY_DECIDED"
  | "AUTHORIZATION_NOT_FOUND"
  | "AUTHORIZATION_ALREADY_DECIDED"
  | "TIME_ENTRY_NOT_FOUND"
  | "INVALID_APPROVED_MINUTES"
  | "LEAVE_NOT_FOUND"
  | "LEAVE_ALREADY_DECIDED"
  | "INSUFFICIENT_CREDIT_BALANCE"
  | "LEAVE_CANNOT_BE_CANCELLED"
  | "USE_MONTH_CLOSING"
  | "INVALID_ACTION";

export type DomainError = {
  code: DomainErrorCode;
  field: string | null;
};

type ErrorDefinition = {
  status: number;
  message: string;
  action: string;
};

const definitions: Record<DomainErrorCode, ErrorDefinition> = {
  INVALID_DAILY_ALLOCATION: { status: 400, message: "Informe as horas de cada dia do período.", action: "REVIEW_FIELDS" },
  DAILY_TOTAL_MISMATCH: { status: 400, message: "A soma das horas por dia precisa ser igual ao total informado.", action: "REVIEW_FIELDS" },
  DUPLICATE_DAY: { status: 400, message: "Cada dia pode aparecer apenas uma vez.", action: "REVIEW_FIELDS" },
  DAY_OUTSIDE_PERIOD: { status: 400, message: "Há uma data fora do período informado.", action: "REVIEW_FIELDS" },
  MONTH_ALREADY_CLOSED: { status: 409, message: "Este mês já está fechado. Reabra o mês antes de alterar seus dados.", action: "REOPEN_MONTH" },
  REVIEW_OUTDATED: { status: 409, message: "Os dados deste mês mudaram. Revise novamente antes de fechar.", action: "REVIEW_AGAIN" },
  NO_ENTRIES: { status: 409, message: "Nenhuma hora foi registrada neste mês.", action: "REVIEW_EMPTY_MONTH" },
  PENDING_LEAVE: { status: 409, message: "Há uma folga aguardando análise.", action: "REVIEW_LEAVE" },
  PENDING_OCCURRENCE: { status: 409, message: "Há uma ausência ou justificativa aguardando análise.", action: "REVIEW_OCCURRENCE" },
  PENDING_NON_BUSINESS_AUTH: { status: 409, message: "Há trabalho em fim de semana ou feriado aguardando autorização.", action: "REVIEW_AUTHORIZATION" },
  INCOMPLETE_DAILY_ALLOCATION: { status: 409, message: "As horas de alguns dias precisam ser distribuídas.", action: "REVIEW_DAILY_ALLOCATION" },
  BALANCE_ALREADY_USED: { status: 409, message: "Não é possível reabrir automaticamente porque este saldo já foi utilizado.", action: "CONTACT_SUPPORT" },
  ALREADY_CLOSED: { status: 409, message: "Este mês já está fechado.", action: "VIEW_CLOSING" },
  INVALID_PERIOD: { status: 400, message: "Selecione um mês válido.", action: "REVIEW_FIELDS" },
  ACTOR_NOT_AUTHORIZED: { status: 403, message: "Você não tem permissão para realizar esta ação.", action: "GO_BACK" },
  CONTRACTOR_NOT_FOUND: { status: 404, message: "Colaborador não encontrado.", action: "SELECT_CONTRACTOR" },
  REVIEW_REQUIRED: { status: 400, message: "Revise o mês antes de confirmar o fechamento.", action: "REVIEW_AGAIN" },
  EMPTY_MONTH_REASON_REQUIRED: { status: 400, message: "Explique por que este mês será fechado sem horas registradas.", action: "REVIEW_FIELDS" },
  EMPTY_MONTH_EXCEPTION_NOT_APPLICABLE: { status: 409, message: "A exceção de mês sem horas não se aplica a este mês.", action: "REVIEW_AGAIN" },
  RESERVED_CREDIT_MISMATCH: { status: 409, message: "A reserva da folga mudou. Revise a solicitação antes de fechar.", action: "REVIEW_LEAVE" },
  TIMESHEET_NOT_CLOSED: { status: 409, message: "Este mês não está fechado.", action: "VIEW_MONTH" },
  REOPEN_REASON_REQUIRED: { status: 400, message: "Informe uma justificativa para reabrir o mês.", action: "REVIEW_FIELDS" },
  LEGACY_CLOSING_REQUIRES_MANUAL_REVIEW: { status: 409, message: "Este fechamento antigo precisa de revisão manual antes da reabertura.", action: "CONTACT_SUPPORT" },
  OCCURRENCE_NOT_FOUND: { status: 404, message: "Ausência ou justificativa não encontrada.", action: "REFRESH" },
  OCCURRENCE_ALREADY_DECIDED: { status: 409, message: "Esta ausência ou justificativa já foi analisada.", action: "REFRESH" },
  AUTHORIZATION_NOT_FOUND: { status: 404, message: "Autorização não encontrada.", action: "REFRESH" },
  AUTHORIZATION_ALREADY_DECIDED: { status: 409, message: "Esta autorização já foi analisada.", action: "REFRESH" },
  TIME_ENTRY_NOT_FOUND: { status: 404, message: "O lançamento relacionado não foi encontrado.", action: "REFRESH" },
  INVALID_APPROVED_MINUTES: { status: 400, message: "Informe uma quantidade válida de horas aprovadas.", action: "REVIEW_FIELDS" },
  LEAVE_NOT_FOUND: { status: 404, message: "Solicitação de folga não encontrada.", action: "REFRESH" },
  LEAVE_ALREADY_DECIDED: { status: 409, message: "Esta solicitação de folga já foi analisada.", action: "REFRESH" },
  INSUFFICIENT_CREDIT_BALANCE: { status: 409, message: "O banco de horas não tem crédito suficiente para aprovar esta folga.", action: "VIEW_BALANCE" },
  LEAVE_CANNOT_BE_CANCELLED: { status: 409, message: "Esta folga não pode mais ser cancelada por este fluxo.", action: "CONTACT_HR" },
  USE_MONTH_CLOSING: { status: 409, message: "A folga aprovada será aplicada no fechamento do mês correspondente.", action: "VIEW_CLOSING" },
  INVALID_ACTION: { status: 400, message: "A ação informada não é válida.", action: "REVIEW_FIELDS" },
};

export function domainError(code: DomainErrorCode, field: string | null = null): DomainError {
  return { code, field };
}

export function isDomainError(error: unknown): error is DomainError {
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  return typeof value.code === "string" && value.code in definitions
    && (typeof value.field === "string" || value.field === null || value.field === undefined);
}

export function domainErrorFromUnknown(error: unknown, field: string | null = null): DomainError | null {
  if (isDomainError(error)) return error;
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string"
      ? String((error as Record<string, unknown>).message)
      : "";
  const code = message.match(/HORUS_DOMAIN:([A-Z_]+)/)?.[1];
  if (!code || !(code in definitions)) return null;
  return { code: code as DomainErrorCode, field };
}

export function domainErrorResponse(error: unknown) {
  if (isDomainError(error)) {
    const definition = definitions[error.code];
    return {
      status: definition.status,
      body: {
        error: {
          code: error.code,
          message: definition.message,
          field: error.field ?? null,
          action: definition.action,
        },
      },
    };
  }
  return {
    status: 502,
    body: {
      error: {
        code: "UNEXPECTED_ERROR",
        message: "Não foi possível concluir a operação.",
        field: null,
        action: "TRY_AGAIN",
      },
    },
  };
}

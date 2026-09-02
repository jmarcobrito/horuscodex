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
  | "ALREADY_CLOSED";

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
};

export function domainError(code: DomainErrorCode, field: string | null = null): DomainError {
  return { code, field };
}

function isDomainError(error: unknown): error is DomainError {
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  return typeof value.code === "string" && value.code in definitions
    && (typeof value.field === "string" || value.field === null || value.field === undefined);
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

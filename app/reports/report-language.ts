const ACTION_LABELS: Record<string, string> = {
  TIME_ENTRY_CREATED: "Criou um lançamento de horas",
  TIME_ENTRY_UPDATED: "Alterou um lançamento de horas",
  TIMESHEET_CLOSED: "Fechou o mês do colaborador",
  TIMESHEET_REOPENED: "Reabriu o mês do colaborador",
  NON_BUSINESS_AUTH_REQUESTED: "Solicitou autorização para trabalhar em dia não útil",
  NON_BUSINESS_AUTH_APPROVE: "Aprovou o trabalho em dia não útil",
  NON_BUSINESS_AUTH_REJECT: "Recusou o trabalho em dia não útil",
  NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT: "Solicitou ajuste na autorização de dia não útil",
  OCCURRENCE_CREATED_APPROVED: "Registrou e aprovou uma ocorrência",
  OCCURRENCE_REQUESTED: "Registrou uma ocorrência para análise",
  OCCURRENCE_APPROVE: "Aprovou uma ocorrência",
  OCCURRENCE_REJECT: "Recusou uma ocorrência",
  OCCURRENCE_CANCEL: "Cancelou uma ocorrência",
  LEAVE_REQUEST_CREATED: "Solicitou uma folga",
  LEAVE_REQUEST_APPROVE: "Aprovou uma folga",
  LEAVE_REQUEST_REJECT: "Recusou uma folga",
  LEAVE_REQUEST_CANCEL: "Cancelou uma folga",
  LEAVE_REQUEST_UTILIZE: "Registrou a utilização de uma folga",
  CONTRACTOR_CREATED: "Cadastrou um colaborador",
  CONTRACTOR_PASSWORD_SET: "Definiu a senha de um colaborador",
  CONTRACTOR_STATUS_CHANGED: "Alterou a situação de um colaborador",
  CONTRACTOR_SECTOR_CHANGED: "Alterou o setor de um colaborador",
  USER_PASSWORD_SET: "Redefiniu a senha de um usuário",
  USER_ROLE_CHANGED: "Alterou o perfil de um usuário",
  USER_STATUS_CHANGED: "Alterou a situação de um usuário",
  ORGANIZATION_POLICY_CHANGED: "Alterou uma política da organização",
  SECTOR_CREATED: "Criou um setor",
  SECTOR_UPDATED: "Alterou o nome de um setor",
  SECTOR_STATUS_CHANGED: "Alterou a situação de um setor",
};

const ENTITY_LABELS: Record<string, string> = {
  TimeEntry: "Lançamento de horas",
  Timesheet: "Fechamento mensal",
  MonthlyTimesheet: "Fechamento mensal",
  Occurrence: "Ocorrência",
  LeaveRequest: "Folga",
  Contractor: "Colaborador",
  User: "Usuário",
  OrganizationPolicy: "Política da organização",
  Sector: "Setor",
};

const BALANCE_MOVEMENT_LABELS: Record<string, string> = {
  CREDIT: "Crédito",
  DEBIT: "Débito",
  COMPENSATION: "Compensação",
  RESERVATION: "Reserva",
  RELEASE: "Liberação",
  CONSUMPTION: "Utilização",
  REVERSAL: "Estorno",
  EXPIRATION: "Expiração",
  ADJUSTMENT: "Ajuste",
};

const BALANCE_LOT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  CONSUMED: "Consumido",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  OVERDUE_AVAILABLE: "Disponível após vencimento",
  OVERDUE: "Vencido",
  PARTIALLY_COMPENSATED: "Parcialmente compensado",
  SETTLED: "Compensado",
  ADJUSTED: "Ajustado",
};

const ENTRY_SITUATION_LABELS: Record<string, string> = {
  NOT_APPLICABLE: "Dia útil",
  AUTHORIZED: "Autorizado",
  PENDING_AUTHORIZATION: "Aguardando autorização",
  REJECTED: "Recusado",
};

const REPORT_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  entries: {
    regular: "Lançamento regular",
    retroactive: "Lançamento retroativo",
    non_business: "Dia não útil",
    with_notes: "Com observação",
  },
  balances: BALANCE_MOVEMENT_LABELS,
  history: {
    entries: "Lançamentos",
    closing: "Fechamento mensal",
    approval: "Aprovações",
    request: "Solicitações",
    registration: "Cadastros",
    access: "Acessos",
    policy: "Políticas",
  },
};

const HISTORY_CATEGORIES: Record<string, string> = {
  TIME_ENTRY_CREATED: "entries",
  TIME_ENTRY_UPDATED: "entries",
  TIMESHEET_CLOSED: "closing",
  TIMESHEET_REOPENED: "closing",
  NON_BUSINESS_AUTH_REQUESTED: "request",
  NON_BUSINESS_AUTH_APPROVE: "approval",
  NON_BUSINESS_AUTH_REJECT: "approval",
  NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT: "approval",
  OCCURRENCE_CREATED_APPROVED: "approval",
  OCCURRENCE_REQUESTED: "request",
  OCCURRENCE_APPROVE: "approval",
  OCCURRENCE_REJECT: "approval",
  OCCURRENCE_CANCEL: "request",
  LEAVE_REQUEST_CREATED: "request",
  LEAVE_REQUEST_APPROVE: "approval",
  LEAVE_REQUEST_REJECT: "approval",
  LEAVE_REQUEST_CANCEL: "request",
  LEAVE_REQUEST_UTILIZE: "request",
  CONTRACTOR_CREATED: "registration",
  CONTRACTOR_PASSWORD_SET: "access",
  CONTRACTOR_STATUS_CHANGED: "access",
  CONTRACTOR_SECTOR_CHANGED: "registration",
  USER_PASSWORD_SET: "access",
  USER_ROLE_CHANGED: "access",
  USER_STATUS_CHANGED: "access",
  ORGANIZATION_POLICY_CHANGED: "policy",
  SECTOR_CREATED: "registration",
  SECTOR_UPDATED: "registration",
  SECTOR_STATUS_CHANGED: "registration",
};

export const safeUnknownActionLabel = "Registrou uma alteração no Horus";

export function actionLabel(action: string) { return ACTION_LABELS[action] ?? safeUnknownActionLabel; }
export function entityLabel(entity: string) { return ENTITY_LABELS[entity] ?? "Registro"; }
export function balanceMovementLabel(movement: string) { return BALANCE_MOVEMENT_LABELS[movement] ?? "Movimentação"; }
export function balanceLotStatusLabel(status: string) { return BALANCE_LOT_STATUS_LABELS[status] ?? "Situação não informada"; }
export function entrySituationLabel(status: string) { return ENTRY_SITUATION_LABELS[status] ?? "Situação não informada"; }
export function reportCategoryLabel(kind: string, category: string) { return REPORT_CATEGORY_LABELS[kind]?.[category] ?? "Categoria não informada"; }
export function historyCategory(action: string) { return HISTORY_CATEGORIES[action] ?? "unknown"; }

export function relatedRecordLabel(entity: string, date: string | null, person: string | null) {
  const detail = entity === "TimeEntry"
    ? date ? `Lançamento de ${formatDate(date)}` : "Lançamento de horas"
    : entity === "Timesheet" || entity === "MonthlyTimesheet"
      ? date ? `Fechamento de ${monthYear(date)}` : "Fechamento mensal"
      : "Registro relacionado";
  return [detail, person].filter(Boolean).join(" — ");
}

function formatDate(date: string | null) {
  if (!date) return "";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function monthYear(date: string | null) {
  if (!date) return "";
  const [year, month] = date.slice(0, 10).split("-");
  return `${new Date(Number(year), Number(month) - 1).toLocaleString("pt-BR", { month: "long" })} de ${year}`;
}

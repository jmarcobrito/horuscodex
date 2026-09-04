const ACTION_LABELS: Record<string,string> = {
TIME_ENTRY_CREATED:"Criou um lançamento de horas",TIME_ENTRY_UPDATED:"Alterou um lançamento de horas",TIMESHEET_CLOSED:"Fechou o mês do colaborador",TIMESHEET_REOPENED:"Reabriu o mês do colaborador",
NON_BUSINESS_AUTH_REQUESTED:"Solicitou autorização para trabalhar em dia não útil",NON_BUSINESS_AUTH_APPROVE:"Aprovou o trabalho em dia não útil",NON_BUSINESS_AUTH_REJECT:"Recusou o trabalho em dia não útil",NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT:"Solicitou ajuste na autorização de dia não útil",
OCCURRENCE_CREATED_APPROVED:"Registrou e aprovou uma ocorrência",OCCURRENCE_REQUESTED:"Registrou uma ocorrência para análise",OCCURRENCE_APPROVE:"Aprovou uma ocorrência",OCCURRENCE_REJECT:"Recusou uma ocorrência",OCCURRENCE_CANCEL:"Cancelou uma ocorrência",
LEAVE_REQUEST_CREATED:"Solicitou uma folga",LEAVE_REQUEST_APPROVE:"Aprovou uma folga",LEAVE_REQUEST_REJECT:"Recusou uma folga",LEAVE_REQUEST_CANCEL:"Cancelou uma folga",LEAVE_REQUEST_UTILIZE:"Registrou a utilização de uma folga",
CONTRACTOR_CREATED:"Cadastrou um colaborador",CONTRACTOR_PASSWORD_SET:"Definiu a senha de um colaborador",CONTRACTOR_STATUS_CHANGED:"Alterou a situação de um colaborador",CONTRACTOR_SECTOR_CHANGED:"Alterou o setor de um colaborador",USER_PASSWORD_SET:"Redefiniu a senha de um usuário",USER_ROLE_CHANGED:"Alterou o perfil de um usuário",USER_STATUS_CHANGED:"Alterou a situação de um usuário",ORGANIZATION_POLICY_CHANGED:"Alterou uma política da organização",SECTOR_CREATED:"Criou um setor",SECTOR_UPDATED:"Alterou o nome de um setor",SECTOR_STATUS_CHANGED:"Alterou a situação de um setor"};
export const safeUnknownActionLabel = "Registrou uma alteração no Horus";
export function actionLabel(action:string){return ACTION_LABELS[action]??safeUnknownActionLabel}
const ENTITY:Record<string,string>={TimeEntry:"Lançamento de horas",Timesheet:"Fechamento mensal",Occurrence:"Ocorrência",LeaveRequest:"Folga",Contractor:"Colaborador",User:"Usuário",OrganizationPolicy:"Política da organização",Sector:"Setor"};
export function entityLabel(entity:string){return ENTITY[entity]??"Registro"}
const MOVEMENT:Record<string,string>={CONSUMPTION:"Utilização",CREDIT:"Crédito",DEBIT:"Débito",RESERVATION:"Reserva",RELEASE:"Liberação"};
export function balanceMovementLabel(movement:string){return MOVEMENT[movement]??"Movimentação"}
export function entrySituationLabel(s:string){return ({APPROVED:"Aprovado",PENDING:"Pendente",REJECTED:"Recusado",CANCELLED:"Cancelado"} as Record<string,string>)[s]??"Situação não informada"}
const HISTORY_CATEGORIES: Record<string, string> = {
  TIME_ENTRY_CREATED: "entries", TIME_ENTRY_UPDATED: "entries", TIMESHEET_CLOSED: "closing", TIMESHEET_REOPENED: "closing",
  NON_BUSINESS_AUTH_REQUESTED: "request", NON_BUSINESS_AUTH_APPROVE: "approval", NON_BUSINESS_AUTH_REJECT: "approval", NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT: "approval",
  OCCURRENCE_CREATED_APPROVED: "approval", OCCURRENCE_REQUESTED: "request", OCCURRENCE_APPROVE: "approval", OCCURRENCE_REJECT: "approval", OCCURRENCE_CANCEL: "request",
  LEAVE_REQUEST_CREATED: "request", LEAVE_REQUEST_APPROVE: "approval", LEAVE_REQUEST_REJECT: "approval", LEAVE_REQUEST_CANCEL: "request", LEAVE_REQUEST_UTILIZE: "request",
  CONTRACTOR_CREATED: "registration", CONTRACTOR_PASSWORD_SET: "access", CONTRACTOR_STATUS_CHANGED: "access", CONTRACTOR_SECTOR_CHANGED: "registration",
  USER_PASSWORD_SET: "access", USER_ROLE_CHANGED: "access", USER_STATUS_CHANGED: "access", ORGANIZATION_POLICY_CHANGED: "policy",
  SECTOR_CREATED: "registration", SECTOR_UPDATED: "registration", SECTOR_STATUS_CHANGED: "registration",
};
export function historyCategory(a:string){return HISTORY_CATEGORIES[a]??"unknown"}
export function relatedRecordLabel(entity:string,date:string|null,person:string|null){const detail=entity==="TimeEntry"?(date?`Lançamento de ${formatDate(date)}`:"Lançamento de horas"):entity==="Timesheet"?(date?`Fechamento de ${monthYear(date)}`:"Fechamento mensal"):"Registro relacionado";return [detail,person].filter(Boolean).join(" — ")}
function formatDate(d:string|null){if(!d)return "";const [y,m,day]=d.slice(0,10).split("-");return `${day}/${m}/${y}`}
function monthYear(d:string|null){if(!d)return "";const [y,m]=d.slice(0,10).split("-");return `${new Date(Number(y),Number(m)-1).toLocaleString("pt-BR",{month:"long"})} de ${y}`}

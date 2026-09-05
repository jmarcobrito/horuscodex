import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";

const { module: language } = await runnerImport("./app/reports/report-language.ts", { configFile: false });

test("all actions currently produced by Horus have natural labels and categories", () => {
  const actions = [
    "TIME_ENTRY_CREATED", "TIME_ENTRY_UPDATED", "TIMESHEET_CLOSED", "TIMESHEET_REOPENED",
    "NON_BUSINESS_AUTH_REQUESTED", "NON_BUSINESS_AUTH_APPROVE", "NON_BUSINESS_AUTH_REJECT", "NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT",
    "OCCURRENCE_CREATED_APPROVED", "OCCURRENCE_REQUESTED", "OCCURRENCE_APPROVE", "OCCURRENCE_REJECT", "OCCURRENCE_CANCEL",
    "LEAVE_REQUEST_CREATED", "LEAVE_REQUEST_APPROVE", "LEAVE_REQUEST_REJECT", "LEAVE_REQUEST_CANCEL", "LEAVE_REQUEST_UTILIZE",
    "CONTRACTOR_CREATED", "CONTRACTOR_PASSWORD_SET", "CONTRACTOR_STATUS_CHANGED", "CONTRACTOR_SECTOR_CHANGED",
    "USER_PASSWORD_SET", "USER_ROLE_CHANGED", "USER_STATUS_CHANGED", "ORGANIZATION_POLICY_CHANGED",
    "SECTOR_CREATED", "SECTOR_UPDATED", "SECTOR_STATUS_CHANGED",
  ];
  for (const action of actions) {
    assert.doesNotMatch(language.actionLabel(action), /^[A-Z0-9_]+$/);
    assert.notEqual(language.historyCategory(action), "unknown");
  }
  assert.equal(language.actionLabel("UNRECOGNIZED_CODE"), "Registrou uma alteração no Horus");
  assert.equal(language.entityLabel("TimeEntry"), "Lançamento de horas");
  assert.equal(language.balanceMovementLabel("CONSUMPTION"), "Utilização");
  assert.deepEqual(Object.fromEntries([
    ["CONTRACTOR_SECTOR_CHANGED", "registration"], ["SECTOR_CREATED", "registration"],
    ["CONTRACTOR_STATUS_CHANGED", "access"], ["USER_ROLE_CHANGED", "access"],
    ["TIME_ENTRY_CREATED", "entries"], ["TIMESHEET_CLOSED", "closing"],
    ["NON_BUSINESS_AUTH_APPROVE", "approval"], ["OCCURRENCE_REQUESTED", "request"],
    ["ORGANIZATION_POLICY_CHANGED", "policy"], ["UNRECOGNIZED_CODE", "unknown"],
  ].map(([action]) => [action, language.historyCategory(action)])), {
    CONTRACTOR_SECTOR_CHANGED: "registration", SECTOR_CREATED: "registration", CONTRACTOR_STATUS_CHANGED: "access", USER_ROLE_CHANGED: "access",
    TIME_ENTRY_CREATED: "entries", TIMESHEET_CLOSED: "closing", NON_BUSINESS_AUTH_APPROVE: "approval", OCCURRENCE_REQUESTED: "request", ORGANIZATION_POLICY_CHANGED: "policy", UNRECOGNIZED_CODE: "unknown",
  });
  assert.equal(language.relatedRecordLabel("TimeEntry", "2026-08-18", "Ana Silva"), "Lançamento de 18/08/2026 — Ana Silva");
  assert.equal(language.relatedRecordLabel("Timesheet", "2026-08-01", "Ana Silva"), "Fechamento de agosto de 2026 — Ana Silva");
  assert.equal(language.relatedRecordLabel("NewEntity", null, null), "Registro relacionado");
  assert.equal(language.relatedRecordLabel("TimeEntry", null, "Ana Silva"), "Lançamento de horas — Ana Silva");
  assert.equal(language.entrySituationLabel("BOGUS"), "Situação não informada");
  assert.equal(language.entityLabel("Unknown"), "Registro");
  assert.equal(language.balanceMovementLabel("BOGUS"), "Movimentação");
});

test("every current action has its hand-derived history category", () => {
  const expected = {
    TIME_ENTRY_CREATED: "entries", TIME_ENTRY_UPDATED: "entries", TIMESHEET_CLOSED: "closing", TIMESHEET_REOPENED: "closing",
    NON_BUSINESS_AUTH_REQUESTED: "request", NON_BUSINESS_AUTH_APPROVE: "approval", NON_BUSINESS_AUTH_REJECT: "approval", NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT: "approval",
    OCCURRENCE_CREATED_APPROVED: "approval", OCCURRENCE_REQUESTED: "request", OCCURRENCE_APPROVE: "approval", OCCURRENCE_REJECT: "approval", OCCURRENCE_CANCEL: "request",
    LEAVE_REQUEST_CREATED: "request", LEAVE_REQUEST_APPROVE: "approval", LEAVE_REQUEST_REJECT: "approval", LEAVE_REQUEST_CANCEL: "request", LEAVE_REQUEST_UTILIZE: "request",
    CONTRACTOR_CREATED: "registration", CONTRACTOR_PASSWORD_SET: "access", CONTRACTOR_STATUS_CHANGED: "access", CONTRACTOR_SECTOR_CHANGED: "registration",
    USER_PASSWORD_SET: "access", USER_ROLE_CHANGED: "access", USER_STATUS_CHANGED: "access", ORGANIZATION_POLICY_CHANGED: "policy",
    SECTOR_CREATED: "registration", SECTOR_UPDATED: "registration", SECTOR_STATUS_CHANGED: "registration",
  };
  for (const [action, category] of Object.entries(expected)) assert.equal(language.historyCategory(action), category, action);
  assert.equal(language.historyCategory("UNRECOGNIZED_CODE"), "unknown");
});

test("every report code has a hand-derived Portuguese presentation label", () => {
  const categories = {
    entries: { regular: "Lançamento regular", retroactive: "Lançamento retroativo", non_business: "Dia não útil", with_notes: "Com observação" },
    balances: { CREDIT: "Crédito", DEBIT: "Débito", COMPENSATION: "Compensação", RESERVATION: "Reserva", RELEASE: "Liberação", CONSUMPTION: "Utilização", REVERSAL: "Estorno", EXPIRATION: "Expiração", ADJUSTMENT: "Ajuste" },
    history: { entries: "Lançamentos", closing: "Fechamento mensal", approval: "Aprovações", request: "Solicitações", registration: "Cadastros", access: "Acessos", policy: "Políticas" },
  };
  for (const [kind, labels] of Object.entries(categories)) {
    for (const [code, expected] of Object.entries(labels)) assert.equal(language.reportCategoryLabel(kind, code), expected, `${kind}:${code}`);
  }
  const movements = categories.balances;
  for (const [code, expected] of Object.entries(movements)) assert.equal(language.balanceMovementLabel(code), expected, code);
  const lotStatuses = {
    AVAILABLE: "Disponível", RESERVED: "Reservado", CONSUMED: "Consumido", EXPIRED: "Expirado", CANCELLED: "Cancelado",
    OVERDUE_AVAILABLE: "Disponível após vencimento", OVERDUE: "Vencido", PARTIALLY_COMPENSATED: "Parcialmente compensado", SETTLED: "Compensado", ADJUSTED: "Ajustado",
  };
  for (const [code, expected] of Object.entries(lotStatuses)) assert.equal(language.balanceLotStatusLabel(code), expected, code);
});

test("persisted entry situations and monthly timesheet history receive natural labels", () => {
  assert.deepEqual(Object.fromEntries([
    ["NOT_APPLICABLE", "Dia útil"], ["AUTHORIZED", "Autorizado"], ["PENDING_AUTHORIZATION", "Aguardando autorização"], ["REJECTED", "Recusado"],
  ].map(([code]) => [code, language.entrySituationLabel(code)])), {
    NOT_APPLICABLE: "Dia útil", AUTHORIZED: "Autorizado", PENDING_AUTHORIZATION: "Aguardando autorização", REJECTED: "Recusado",
  });
  assert.equal(language.relatedRecordLabel("MonthlyTimesheet", "2026-08-01", "Ana Silva"), "Fechamento de agosto de 2026 — Ana Silva");
});

test("every current and historical report entity has a natural related-record label", () => {
  const cases = [
    ["TimeEntry", "2026-08-18", "Ana Silva", "Lançamento de 18/08/2026 — Ana Silva"],
    ["MonthlyTimesheet", "2026-08-01", "Ana Silva", "Fechamento de agosto de 2026 — Ana Silva"],
    ["Timesheet", "2026-08-01", "Ana Silva", "Fechamento de agosto de 2026 — Ana Silva"],
    ["HourBalanceLot", "2026-08-31", "Ana Silva", "Saldo do banco de horas de 31/08/2026 — Ana Silva"],
    ["LeaveRequest", "2026-09-10", "Ana Silva", "Solicitação de folga de 10/09/2026 — Ana Silva"],
    ["Occurrence", "2026-08-05", "Ana Silva", "Ocorrência de 05/08/2026 — Ana Silva"],
    ["NonBusinessDayAuthorization", "2026-08-09", "Ana Silva", "Autorização de dia não útil de 09/08/2026 — Ana Silva"],
    ["NonBusinessAuthorization", "2026-08-09", "Ana Silva", "Autorização de dia não útil de 09/08/2026 — Ana Silva"],
    ["User", null, "Ana Silva", "Colaborador ou usuário — Ana Silva"],
    ["Contractor", null, "Ana Silva", "Colaborador — Ana Silva"],
    ["OrganizationPolicy", null, null, "Política da organização"],
    ["Sector", null, null, "Setor"],
  ];
  for (const [entity, date, person, expected] of cases) {
    assert.equal(language.relatedRecordLabel(entity, date, person), expected, entity);
    assert.doesNotMatch(language.relatedRecordLabel(entity, date, person), /Registro relacionado/, entity);
  }
});

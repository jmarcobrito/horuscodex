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
  ].map(([action, category]) => [action, language.historyCategory(action)])), {
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

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const fixture = fileURLToPath(new URL("./helpers/read-boundary.mjs", import.meta.url));
const { module: reports } = await runnerImport("./tests/helpers/read-harness.ts", {
  configFile: false,
  envDir: false,
  resolve: { alias: ["./supabase", "../../../db/supabase", "../../../../db/supabase"].map(find => ({ find, replacement: fixture })) },
});
const { boundary, getAllReportRows, getReportOptions, getReportPage, parseReportFilters } = reports;
const rh = { id: "test-rh", authUserId: "auth-rh", organizationId: "test-org", organizationName: "Fictícia", name: "RH", email: "rh@example.com", role: "RH" };

function filters(overrides = {}) {
  return {
    kind: "history", from: "2026-08-01", to: "2026-09-30", page: 1, pageSize: 50,
    personId: null, sectorId: null, category: null, actorId: null,
    ...overrides,
  };
}

beforeEach(() => boundary.reset());

test("report parser accepts only exact filters and fixes page size at 50", () => {
  const parsed = parseReportFilters(new URLSearchParams("kind=entries&from=2026-08-01&to=2026-08-31&page=2&personId=person-0001"));
  assert.deepEqual(parsed, {
    kind: "entries", from: "2026-08-01", to: "2026-08-31", page: 2, pageSize: 50,
    personId: "person-0001", sectorId: null, category: null, actorId: null,
  });
  assert.throws(() => parseReportFilters(new URLSearchParams("kind=entries&from=2026-09-31&to=2026-09-01")), /Período inválido/);
  assert.throws(() => parseReportFilters(new URLSearchParams("kind=entries&from=2026-08-01&to=2026-08-31&category=CREDIT")));
});

test("September entry report never returns August rows", async () => {
  boundary.tables.time_entries.push({ id: "entry-september", organization_id: "test-org", contractor_id: "person-0000", work_date: "2026-09-03", start_time: "08:00:00", end_time: "09:00:00", break_minutes: 0, calculated_minutes: 60, eligible_minutes: 60, non_business_day_status: "NOT_APPLICABLE", notes: "Setembro", created_at: "2026-09-03T12:00:00Z", updated_at: "2026-09-03T12:00:00Z" });
  const response = await getReportPage(rh, filters({ kind: "entries", from: "2026-09-01", to: "2026-09-30" }));
  assert.ok(response.rows.length > 0);
  assert.ok(response.rows.every(row => row.workDate.startsWith("2026-09-")));
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("person, sector, category and actor filters combine inside one organization", async () => {
  boundary.tables.sectors.push({ id: "sector-engineering", organization_id: "test-org", name: "Engenharia", status: "ACTIVE" });
  boundary.tables.users.find(user => user.id === "person-0001").sector_id = "sector-engineering";
  const response = await getReportPage(rh, filters({ kind: "history", personId: "person-0001", sectorId: "sector-engineering", category: "entries", actorId: "test-rh" }));
  assert.ok(response.rows.length > 0);
  assert.ok(response.rows.every(row => row.affectedPersonId === "person-0001" && row.actorId === "test-rh"));
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("report returns 50 newest rows and exact paging metadata", async () => {
  const response = await getReportPage(rh, filters({ kind: "history", page: 2 }));
  assert.equal(response.rows.length, 50);
  assert.deepEqual(response.pagination, { page: 2, pageSize: 50, total: 1105, pageCount: 23 });
  assert.equal(response.timezone, "America/Sao_Paulo");
  assert.equal(boundary.rangeCallsByTable.report_audit_events, 1);
  assert.equal(boundary.readRpcCalls.report_summary, 1);
});

test("entry summary covers every filtered row beyond the current 50-row page", async () => {
  boundary.tables.sectors.push({ id: "sector-summary-entries", organization_id: "test-org", name: "Resumo de lançamentos", status: "ACTIVE" });
  for (let index = 0; index < 75; index++) boundary.tables.users[index].sector_id = "sector-summary-entries";
  const response = await getReportPage(rh, filters({ kind: "entries", sectorId: "sector-summary-entries", page: 2 }));
  assert.equal(response.rows.length, 25);
  assert.deepEqual(response.pagination, { page: 2, pageSize: 50, total: 75, pageCount: 2 });
  assert.deepEqual(response.summary, { workedMinutes: 4500, consideredMinutes: 4500 });
  assert.equal(boundary.rangeCallsByTable.report_time_entries, 1);
  assert.equal(boundary.readRpcCalls.report_summary, 1);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("balance summary covers credit, debit, reservation and utilization across all filtered rows", async () => {
  boundary.tables.sectors.push({ id: "sector-summary-balances", organization_id: "test-org", name: "Resumo do banco", status: "ACTIVE" });
  boundary.tables.users.find(user => user.id === "person-0001").sector_id = "sector-summary-balances";
  boundary.tables.hour_balance_lots.push({ id: "lot-summary", organization_id: "test-org", contractor_id: "person-0001", type: "CREDIT", original_minutes: 9999, remaining_minutes: 9999, reserved_minutes: 0, origin_date: "2026-08-01", deadline_date: "2026-11-01", status: "AVAILABLE", created_at: "2026-08-01T12:00:00Z" });
  const movements = [
    ["CREDIT", 10], ["DEBIT", 20], ["RESERVATION", 30], ["CONSUMPTION", 40],
  ];
  for (const [movementIndex, [type, minutes]] of movements.entries()) {
    for (let index = 0; index < 15; index++) boundary.tables.hour_balance_transactions.push({
      id: `transaction-summary-${movementIndex}-${String(index).padStart(2, "0")}`,
      organization_id: "test-org", contractor_id: "person-0001", lot_id: "lot-summary", type, minutes,
      description: "Resumo filtrado", created_at: `2026-08-${String(10 + movementIndex).padStart(2, "0")}T12:${String(index).padStart(2, "0")}:00Z`,
    });
  }
  boundary.tables.hour_balance_transactions.push({ id: "transaction-outside-summary-sector", organization_id: "test-org", contractor_id: "person-0002", lot_id: "lot-credit", type: "CREDIT", minutes: 9999, description: "Fora do filtro", created_at: "2026-08-20T12:00:00Z" });
  const response = await getReportPage(rh, filters({ kind: "balances", sectorId: "sector-summary-balances", page: 2 }));
  assert.equal(response.rows.length, 10);
  assert.deepEqual(response.pagination, { page: 2, pageSize: 50, total: 60, pageCount: 2 });
  assert.deepEqual(response.summary, { creditMinutes: 150, debitMinutes: 900, reservationMinutes: 450, utilizationMinutes: 600 });
  assert.equal(boundary.rangeCallsByTable.report_balance_transactions, 1);
  assert.equal(boundary.readRpcCalls.report_summary, 1);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("history summary counts every filtered event and distinct affected person beyond one page", async () => {
  boundary.tables.sectors.push({ id: "sector-summary-history", organization_id: "test-org", name: "Resumo do histórico", status: "ACTIVE" });
  for (let index = 0; index < 75; index++) boundary.tables.users[index].sector_id = "sector-summary-history";
  boundary.tables.audit_logs.push({ id: "audit-summary-duplicate-person", organization_id: "test-org", user_id: "test-rh", action: "TIME_ENTRY_UPDATED", entity_type: "TimeEntry", entity_id: "entry-person-0000", reason: "Segundo evento", created_at: "2026-08-05T12:00:00Z", affected_user_id: "person-0000", related_date: "2026-08-03", category: "entries" });
  const response = await getReportPage(rh, filters({ kind: "history", sectorId: "sector-summary-history", actorId: "test-rh", category: "entries", page: 2 }));
  assert.equal(response.rows.length, 26);
  assert.deepEqual(response.pagination, { page: 2, pageSize: 50, total: 76, pageCount: 2 });
  assert.deepEqual(response.summary, { events: 76, affectedPeople: 75 });
  assert.equal(boundary.rangeCallsByTable.report_audit_events, 1);
  assert.equal(boundary.readRpcCalls.report_summary, 1);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("foreign filter identifiers are rejected instead of producing empty reports", async () => {
  await assert.rejects(() => getReportPage(rh, filters({ personId: "person-other-org" })), /Pessoa, setor ou responsável inválido para esta organização/);
});

test("actor filters are ignored outside history reports", async () => {
  const response = await getReportPage(rh, filters({ kind: "entries", actorId: "person-other-org" }));
  assert.ok(response.rows.length > 0);
});

test("report options preserve inactive historical people and sectors", async () => {
  boundary.tables.sectors.push({ id: "sector-legacy", organization_id: "test-org", name: "Legado", status: "INACTIVE" });
  const options = await getReportOptions(rh, "history");
  assert.ok(options.people.some(option => option.value === "person-1104" && option.description === "Inativo"));
  assert.ok(options.sectors.some(option => option.value === "sector-legacy" && option.description === "Inativo"));
  assert.deepEqual(options.sectors.find(option => option.value === "UNASSIGNED"), { value: "UNASSIGNED", label: "Sem setor definido" });
});

test("report options expose Portuguese labels for every allowed category", async () => {
  assert.deepEqual((await getReportOptions(rh, "entries")).categories, [
    { value: "regular", label: "Lançamento regular" }, { value: "retroactive", label: "Lançamento retroativo" }, { value: "non_business", label: "Dia não útil" }, { value: "with_notes", label: "Com observação" },
  ]);
  assert.deepEqual((await getReportOptions(rh, "balances")).categories, [
    { value: "CREDIT", label: "Crédito" }, { value: "DEBIT", label: "Débito" }, { value: "COMPENSATION", label: "Compensação" }, { value: "RESERVATION", label: "Reserva" }, { value: "RELEASE", label: "Liberação" }, { value: "CONSUMPTION", label: "Utilização" }, { value: "REVERSAL", label: "Estorno" }, { value: "EXPIRATION", label: "Expiração" }, { value: "ADJUSTMENT", label: "Ajuste" },
  ]);
  assert.deepEqual((await getReportOptions(rh, "history")).categories, [
    { value: "entries", label: "Lançamentos" }, { value: "closing", label: "Fechamento mensal" }, { value: "approval", label: "Aprovações" }, { value: "request", label: "Solicitações" }, { value: "registration", label: "Cadastros" }, { value: "access", label: "Acessos" }, { value: "policy", label: "Políticas" },
  ]);
});

test("entry rows translate every persisted non-business status", async () => {
  for (const [id, non_business_day_status] of [["entry-situation-na", "NOT_APPLICABLE"], ["entry-situation-authorized", "AUTHORIZED"], ["entry-situation-pending", "PENDING_AUTHORIZATION"], ["entry-situation-rejected", "REJECTED"]]) {
    boundary.tables.time_entries.push({ id, organization_id: "test-org", contractor_id: "person-0000", work_date: "2026-09-04", start_time: "08:00:00", end_time: "09:00:00", break_minutes: 0, calculated_minutes: 60, eligible_minutes: 60, non_business_day_status, notes: "Situação", created_at: "2026-09-04T12:00:00Z", updated_at: "2026-09-04T12:00:00Z" });
  }
  const response = await getReportPage(rh, filters({ kind: "entries" }));
  assert.deepEqual(Object.fromEntries(response.rows.filter(row => row.id.startsWith("entry-situation-")).map(row => [row.id, row.situation])), {
    "entry-situation-na": "Dia útil", "entry-situation-authorized": "Autorizado", "entry-situation-pending": "Aguardando autorização", "entry-situation-rejected": "Recusado",
  });
});

test("closing and reopening audit rows use the persisted MonthlyTimesheet entity label", async () => {
  boundary.tables.audit_logs.push(
    { id: "audit-closing", organization_id: "test-org", user_id: "test-rh", action: "TIMESHEET_CLOSED", entity_type: "MonthlyTimesheet", entity_id: "ts-person-0000", reason: "Fechamento", created_at: "2026-09-03T12:00:00Z", affected_user_id: "person-0000", related_date: "2026-08-01", category: "closing" },
    { id: "audit-reopening", organization_id: "test-org", user_id: "test-rh", action: "TIMESHEET_REOPENED", entity_type: "MonthlyTimesheet", entity_id: "ts-person-0000", reason: "Reabertura", created_at: "2026-09-04T12:00:00Z", affected_user_id: "person-0000", related_date: "2026-08-01", category: "closing" },
  );
  const response = await getReportPage(rh, filters({ kind: "history", category: "closing" }));
  assert.deepEqual(response.rows.map(row => [row.action, row.relatedRecord]), [
    ["Reabriu o mês do colaborador", "Fechamento de agosto de 2026 — person-0000"], ["Fechou o mês do colaborador", "Fechamento de agosto de 2026 — person-0000"],
  ]);
});

test("complete report reader uses stable 500-row batches without silent truncation", async () => {
  const rows = await getAllReportRows(rh, filters({ kind: "history" }));
  assert.equal(rows.length, 1105);
  assert.equal(new Set(rows.map(row => row.id)).size, 1105);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("balance direction follows the stored movement and lot type, never its description", async () => {
  boundary.tables.hour_balance_transactions.push(
    { id: "transaction-compensation-credit", organization_id: "test-org", contractor_id: "person-0000", lot_id: "lot-credit", type: "COMPENSATION", minutes: 30, description: "crédito em texto livre", created_at: "2026-08-04T12:00:00Z" },
    { id: "transaction-reversal", organization_id: "test-org", contractor_id: "person-0000", lot_id: "lot-credit", type: "REVERSAL", minutes: 30, description: "parece débito", created_at: "2026-08-05T12:00:00Z" },
  );
  const response = await getReportPage(rh, filters({ kind: "balances" }));
  assert.equal(response.rows.find(row => row.id === "transaction-compensation-credit").direction, "debit");
  assert.equal(response.rows.find(row => row.id === "transaction-reversal").direction, "neutral");
});

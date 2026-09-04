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

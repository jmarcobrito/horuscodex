import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const fixture = fileURLToPath(new URL("./helpers/read-boundary.mjs", import.meta.url));
const { module: { sectors, team, boundary } } = await runnerImport("./tests/helpers/sectors-route-harness.ts", {
  configFile: false,
  envDir: false,
  resolve: {
    alias: [
      "../../../db/supabase", "../../../db/supabase-auth", "../../../../db/supabase", "../../../../db/supabase-auth",
      "./supabase", "./supabase-auth",
    ].map(find => ({ find, replacement: fixture })),
  },
});

function request(method, body) {
  return new Request("http://127.0.0.1:4175/api/sectors", {
    method,
    headers: { origin: "http://127.0.0.1:4175", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  boundary.reset();
  boundary.allowWrites = true;
});

test("RH creates and inactivates sectors inside its organization", async () => {
  const created = await sectors.POST(request("POST", { name: "Engenharia" }));
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "private, no-store");
  assert.equal(boundary.tables.sectors.find(row => row.name === "Engenharia").organization_id, "test-org");
  assert.equal(boundary.tables.audit_logs.at(-1).action, "SECTOR_CREATED");

  const id = (await created.json()).id;
  const changed = await sectors.PATCH(request("PATCH", { id, name: "Engenharia", status: "INACTIVE", reason: "Reorganização interna" }));
  assert.equal(changed.status, 200);
  assert.equal(changed.headers.get("cache-control"), "private, no-store");
  assert.equal(boundary.tables.sectors.find(row => row.id === id).status, "INACTIVE");
  assert.equal(boundary.tables.audit_logs.at(-1).action, "SECTOR_STATUS_CHANGED");
});

test("PJ cannot list or mutate sectors", async () => {
  boundary.tables.users.find(row => row.id === "test-rh").role = "PJ";
  const list = await sectors.GET();
  const create = await sectors.POST(request("POST", { name: "Arquitetura" }));
  assert.equal(list.status, 403);
  assert.equal(create.status, 403);
  assert.equal(list.headers.get("cache-control"), "private, no-store");
  assert.equal(create.headers.get("cache-control"), "private, no-store");
});

test("sector assignment rejects another organization and preserves time data", async () => {
  boundary.tables.sectors.push({ id: "other-sector", organization_id: "other-org", name: "Operações", status: "ACTIVE" });
  const before = structuredClone(boundary.tables.time_entries);
  const response = await team.PATCH(request("PATCH", { id: "person-0000", action: "SET_SECTOR", sectorId: "other-sector", reason: "Classificação" }));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(boundary.tables.time_entries, before);
});

test("sector assignment changes only the contractor sector and its audit record", async () => {
  boundary.tables.sectors.push({ id: "engineering", organization_id: "test-org", name: "Engenharia", status: "ACTIVE" });
  const before = structuredClone({
    timeEntries: boundary.tables.time_entries,
    timesheets: boundary.tables.monthly_timesheets,
    lots: boundary.tables.hour_balance_lots,
    transactions: boundary.tables.hour_balance_transactions,
    audits: boundary.tables.audit_logs,
  });
  const response = await team.PATCH(request("PATCH", { id: "person-0000", action: "SET_SECTOR", sectorId: "engineering", reason: "Classificação inicial" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: "person-0000", sectorId: "engineering" });
  assert.equal(boundary.tables.users.find(row => row.id === "person-0000").sector_id, "engineering");
  assert.deepEqual(boundary.tables.time_entries, before.timeEntries);
  assert.deepEqual(boundary.tables.monthly_timesheets, before.timesheets);
  assert.deepEqual(boundary.tables.hour_balance_lots, before.lots);
  assert.deepEqual(boundary.tables.hour_balance_transactions, before.transactions);
  assert.deepEqual(boundary.tables.audit_logs.slice(0, -1), before.audits);
  assert.equal(boundary.tables.audit_logs.at(-1).action, "CONTRACTOR_SECTOR_CHANGED");
});

test("sector routes never cache validation, origin, duplicate, or actor failures", async () => {
  const invalid = await sectors.POST(request("POST", { name: "" }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("cache-control"), "private, no-store");

  const crossOrigin = await sectors.POST(new Request("http://127.0.0.1:4175/api/sectors", {
    method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ name: "Financeiro" }),
  }));
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.get("cache-control"), "private, no-store");

  const first = await sectors.POST(request("POST", { name: "Financeiro" }));
  assert.equal(first.status, 201);
  const duplicate = await sectors.POST(request("POST", { name: " financeiro " }));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await duplicate.json(), { error: "Já existe um setor com este nome." });
});

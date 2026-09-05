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
  boundary.rpcResult = { data: { id: "sec-engineering", name: "Engenharia", status: "ACTIVE" }, error: null };
  const created = await sectors.POST(request("POST", { name: "Engenharia" }));
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "private, no-store");
  assert.equal(boundary.rpcLog.length, 1, "create is a single database RPC");
  assert.match(boundary.rpcLog[0].args.p_sector_id, /^sec_/);
  assert.deepEqual({ ...boundary.rpcLog[0].args, p_sector_id: "generated" }, {
    p_organization_id: "test-org", p_actor_id: "test-rh", p_sector_id: "generated", p_name: "Engenharia",
  });

  const id = (await created.json()).id;
  boundary.rpcResult = { data: { id, name: "Engenharia", status: "INACTIVE" }, error: null };
  const changed = await sectors.PATCH(request("PATCH", { id, name: "Engenharia", status: "INACTIVE", reason: "Reorganização interna" }));
  assert.equal(changed.status, 200);
  assert.equal(changed.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(boundary.rpcLog[1], { name: "update_sector", args: {
    p_organization_id: "test-org", p_actor_id: "test-rh", p_sector_id: id,
    p_name: "Engenharia", p_status: "INACTIVE", p_reason: "Reorganização interna",
  } });
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
  boundary.rpcResult = { data: null, error: { message: "Invalid sector", code: "22023" } };
  const response = await team.PATCH(request("PATCH", { id: "person-0000", action: "SET_SECTOR", sectorId: "other-sector", reason: "Classificação" }));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(boundary.rpcLog, [{ name: "set_contractor_sector", args: {
    p_organization_id: "test-org", p_actor_id: "test-rh", p_contractor_id: "person-0000",
    p_sector_id: "other-sector", p_reason: "Classificação",
  } }]);
});

test("sector assignment changes only the contractor sector and its audit record", async () => {
  boundary.rpcResult = { data: { id: "person-0000", sectorId: "engineering" }, error: null };
  const response = await team.PATCH(request("PATCH", { id: "person-0000", action: "SET_SECTOR", sectorId: "engineering", reason: "Classificação inicial" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: "person-0000", sectorId: "engineering" });
  assert.equal(boundary.rpcCalls, 1);
  assert.equal(boundary.writes, 0, "route does not perform a second non-transactional write");
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

  boundary.rpcResult = { data: { id: "sec-finance", name: "Financeiro", status: "ACTIVE" }, error: null };
  const first = await sectors.POST(request("POST", { name: "Financeiro" }));
  assert.equal(first.status, 201);
  boundary.rpcResult = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"sectors_org_name_unique\"" } };
  const duplicate = await sectors.POST(request("POST", { name: " financeiro " }));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await duplicate.json(), { error: "Já existe um setor com este nome." });
});

test("unique-sector constraint failures are mapped to the required conflict response", async () => {
  boundary.rpcResult = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"sectors_org_name_unique\"" } };
  const create = await sectors.POST(request("POST", { name: "Duplicado" }));
  const rename = await sectors.PATCH(request("PATCH", { id: "sec-existing", name: "Duplicado", status: "ACTIVE", reason: "Renomeação válida" }));
  for (const response of [create, rename]) {
    assert.equal(response.status, 409);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { error: "Já existe um setor com este nome." });
  }
  assert.deepEqual(boundary.rpcLog.map(call => call.name), ["create_sector", "update_sector"]);
});

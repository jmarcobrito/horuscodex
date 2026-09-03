import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const fixture = fileURLToPath(new URL("./helpers/write-route-fixtures.ts", import.meta.url));
const { module: { authorization, occurrence, leave, apiFailure, boundary } } = await runnerImport("./tests/helpers/write-route-harness.ts", {
  configFile: false, envDir: false,
  resolve: { alias: ["../../../db/actor", "../../../db/supabase", "./actor", "./supabase"].map(find => ({ find, replacement: fixture })) },
});
const origin = "http://127.0.0.1:4175";
const request = (method, body, originHeader = origin) => new Request(origin + "/api/test", {
  method, headers: { origin: originHeader, "content-type": "application/json" }, body: JSON.stringify(body),
});
const silence = test.mock.method(console, "error", () => {});
const network = test.mock.method(globalThis, "fetch", () => { throw Error("Network forbidden in route test"); });
after(() => { silence.mock.restore(); network.mock.restore(); });
beforeEach(() => boundary.reset());

test("leave creation uses one atomic RPC and the signed-in person's identity", async () => {
  boundary.reset("PJ"); boundary.result.data.status = "REQUESTED";
  const response = await leave.POST(request("POST", { contractorId: "other", startDate: "2026-10-12", endDate: "2026-10-12", requestedMinutes: 60, reason: "Folga" }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), boundary.result.data);
  assert.deepEqual(boundary.calls, [{ name: "create_leave_request", args: {
    p_organization_id: "test-org", p_actor_id: "test-actor", p_contractor_id: "test-actor",
    p_start_date: "2026-10-12", p_end_date: "2026-10-12", p_requested_minutes: 60, p_reason: "Folga",
  } }]);
});

test("leave decisions delegate authorization and audit to one database transaction", async () => {
  for (const [role, action] of [["PJ", "CANCEL"], ["RH", "APPROVE"], ["DEV", "UTILIZE"]]) {
    boundary.reset(role);
    assert.equal((await leave.PATCH(request("PATCH", { id: "leave-1", action, notes: "Conferido" }))).status, 200);
    assert.deepEqual(boundary.calls, [{ name: "decide_leave_request", args: {
      p_organization_id: "test-org", p_actor_id: "test-actor", p_request_id: "leave-1", p_action: action, p_notes: "Conferido",
    } }]);
  }
});

test("authorization request uses one atomic RPC and scopes collaborator to session", async () => {
  boundary.reset("PJ"); boundary.result.data.status = "REQUESTED";
  const response = await authorization.POST(request("POST", { contractorId: "another-person", workDate: "2026-08-09", estimatedMinutes: 60, reason: "Pedido" }));
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), boundary.result.data);
  assert.deepEqual(boundary.calls, [{ name: "request_non_business_authorization", args: {
    p_organization_id: "test-org", p_actor_id: "test-actor", p_contractor_id: "test-actor",
    p_work_date: "2026-08-09", p_estimated_minutes: 60, p_reason: "Pedido",
  } }]);
});
test("authorization decision delegates calculation and audit to one RPC", async () => {
  const response = await authorization.PATCH(request("PATCH", { id: "auth-1", action: "APPROVE", approvedMinutes: 240, notes: "Conferido" }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), boundary.result.data);
  assert.deepEqual(boundary.calls, [{ name: "decide_non_business_authorization", args: {
    p_organization_id: "test-org", p_actor_id: "test-actor", p_authorization_id: "auth-1",
    p_action: "APPROVE", p_approved_minutes: 240, p_notes: "Conferido",
  } }]);
});
test("approval rejects invalid minutes before any database call", async () => {
  for (const approvedMinutes of [-1, 0, 1441, 1.5, "60", null]) {
    assert.equal((await authorization.PATCH(request("PATCH", { id: "auth-1", action: "APPROVE", approvedMinutes }))).status, 400);
  }
  assert.equal(boundary.calls.length, 0);
});
test("omitted approval minutes use the server-side estimate, never client coercion", async () => {
  assert.equal((await authorization.PATCH(request("PATCH", { id: "auth-1", action: "APPROVE" }))).status, 200);
  assert.equal(boundary.calls[0].args.p_approved_minutes, null);
});
test("collaborator cannot approve authorizations or occurrences", async () => {
  boundary.reset("PJ");
  for (const route of [authorization, occurrence, leave]) assert.equal((await route.PATCH(request("PATCH", { id: "x", action: "APPROVE" }))).status, 403);
  assert.equal(boundary.calls.length, 0);
});
test("occurrence creation uses an atomic RPC with current default calculation effect", async () => {
  boundary.reset("PJ"); boundary.result.data.status = "REQUESTED";
  const response = await occurrence.POST(request("POST", { contractorId: "other", type: "MEDICAL_CERTIFICATE", startDate: "2026-08-03", endDate: "2026-08-03", minutes: 60, calculationEffect: "CONSUMES_BALANCE", description: "Atestado" }));
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), boundary.result.data);
  assert.deepEqual(boundary.calls, [{ name: "create_occurrence", args: {
    p_organization_id: "test-org", p_actor_id: "test-actor", p_contractor_id: "test-actor",
    p_type: "MEDICAL_CERTIFICATE", p_start_date: "2026-08-03", p_end_date: "2026-08-03",
    p_minutes: 60, p_calculation_effect: "CREDITS_HOURS", p_description: "Atestado",
  } }]);
});
test("collaborator cancellation and RH decision use one occurrence RPC", async () => {
  for (const [role, action] of [["PJ", "CANCEL"], ["RH", "APPROVE"], ["DEV", "REJECT"]]) {
    boundary.reset(role);
    assert.equal((await occurrence.PATCH(request("PATCH", { id: "occ-1", action, notes: "Motivo" }))).status, 200);
    assert.deepEqual(boundary.calls, [{ name: "decide_occurrence", args: {
      p_organization_id: "test-org", p_actor_id: "test-actor", p_occurrence_id: "occ-1", p_action: action, p_notes: "Motivo",
    } }]);
  }
});
test("same-origin protection runs before authentication and persistence on every write handler", async () => {
  for (const route of [authorization, occurrence, leave]) for (const method of ["POST", "PATCH"]) {
    assert.equal((await route[method](request(method, {}, "https://untrusted.invalid"))).status, 403);
  }
  assert.equal(boundary.actorCalls, 0); assert.equal(boundary.calls.length, 0);
});
test("plain PostgREST errors retain useful safe Portuguese messages and HTTP statuses", async () => {
  for (const [message, code, status, text] of [
    ["Timesheet is closed", "P0001", 409, /mês.*fechado/i],
    ["Pending non-business day authorization", "P0001", 409, /autoriza/i],
    ["Pending occurrence", "P0001", 409, /ocorrências/i],
    ["Forbidden operation", "42501", 403, /permissão/i],
    ["Invalid authorization values", "22023", 400, /inválid/i],
    ["Request not found", "P0001", 404, /encontrada/i],
    ["Request is not pending", "P0001", 409, /solicitação/i],
  ]) {
    const response = apiFailure({ message, code }, "test");
    assert.equal(response.status, status); assert.match((await response.json()).error, text);
  }
  const response = apiFailure({ message: "secret-data-from-database", code: "XX000", details: "private" }, "test");
  assert.equal(response.status, 502); assert.doesNotMatch(JSON.stringify(await response.json()), /secret|private/);
});
test("closed RPC error becomes a conflict without retrying or issuing fallback writes", async () => {
  boundary.result.error = { message: "Timesheet is closed", code: "P0001" };
  const response = await authorization.PATCH(request("PATCH", { id: "x", action: "APPROVE" }));
  assert.equal(response.status, 409); assert.equal(boundary.calls.length, 1);
});

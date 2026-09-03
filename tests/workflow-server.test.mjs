import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
const { module: { createWorkflowServer } } = await runnerImport("./tests/helpers/workflow-server.ts", { configFile: false, envDir: false });
test("isolated server never reaches external or unknown routes and scopes PJ data", async () => {
  const server = createWorkflowServer("pj");
  await assert.rejects(server.request("https://horuscodex.vercel.app/api/dashboard"), /externo/);
  await assert.rejects(server.request("/api/unmapped"), /não simulada/);
  const data = await (await server.request("/api/dashboard?year=2026&month=8&viewAs=person-2")).json();
  assert.deepEqual(data.contractors.map(p => p.id), ["person-1"]);
  assert.ok(data.entries.every(e => e.contractorId === "person-1"));
});
test("consultation, history and fictitious closing preserve days and versions", async () => {
  const server = createWorkflowServer();
  const before = server.snapshot();
  await server.request("/api/dashboard?year=2026&month=8");
  await server.request("/api/time-entries/entry-1/history");
  const output = await server.closingSubmit({ year: 2026, month: 8, contractorIds: ["person-1", "person-2"] });
  assert.deepEqual(output.map(r => r.status), ["closed", "closed"]);
  const after = server.snapshot();
  assert.deepEqual(after.entries, before.entries);
  assert.deepEqual(after.versions, before.versions);
  assert.equal((await server.closingSubmit({ year: 2026, month: 8, contractorIds: ["person-1"] }))[0].status, "already-closed");
});
test("daily fixture correction changes only target day and keeps previous version", async () => {
  const server = createWorkflowServer();
  const before = server.snapshot();
  const response = await server.request("/api/time-entries", { method: "POST", body: JSON.stringify({ contractorId: "person-1", workDate: "2026-08-03", startTime: "08:00", endTime: "17:00", breakMinutes: 90, notes: "Correção fictícia", changeReason: "Intervalo correto" }) });
  assert.equal(response.status, 200);
  const after = server.snapshot();
  assert.deepEqual(after.entries.filter(e => e.workDate !== "2026-08-03"), before.entries.filter(e => e.workDate !== "2026-08-03"));
  assert.equal(after.entries.find(e => e.workDate === "2026-08-03").calculatedMinutes, 450);
  assert.deepEqual(after.versions["entry-1"].slice(0, -1), before.versions["entry-1"]);
  assert.equal(after.versions["entry-1"].at(-1).previous_data.break_minutes, 60);
});
test("fixture partial and uncertain results are isolated, and empty-month review is not a daily write", async () => {
  const server = createWorkflowServer("rh", "empty");
  server.controls.closingMode = "partial";
  const before = server.snapshot();
  assert.deepEqual((await server.closingSubmit({ year: 2026, month: 8, contractorIds: ["person-1", "person-2"] })).map(r => r.status), ["closed", "failed"]);
  assert.deepEqual(server.snapshot().entries, before.entries);
  server.controls.closingMode = "uncertain";
  await assert.rejects(server.closingSubmit({ year: 2026, month: 8, contractorIds: ["person-3"] }), /fictícia/);
});

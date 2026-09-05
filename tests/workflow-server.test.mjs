import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
const { module: { createWorkflowServer } } = await runnerImport("./tests/helpers/workflow-server.ts", { configFile: false, envDir: false });

test("fixture registration indicators are scoped to the consulted entries", async () => {
  const server = createWorkflowServer();
  const before = server.snapshot();
  const data = await (await server.request("/api/dashboard?from=2026-08-10&to=2026-08-10")).json();
  assert.equal(data.timezone,"America/Sao_Paulo");
  assert.equal(data.contractors[0].lastEntryAt,null);
  assert.equal(data.contractors[0].lastEntryDate,null);
  assert.equal(data.contractors[0].averageDelayDays,null);
  assert.equal(data.contractors[0].unavailableRegistrationDates,0);
  assert.deepEqual(server.snapshot(),before);
});
test("fixture uses the same missing-month estimates and never invents inactive requirements", async () => {
  const server = createWorkflowServer();
  const before = server.snapshot();
  const data = await (await server.request("/api/dashboard?from=2026-09-01&to=2026-10-31")).json();
  assert.equal(data.contractors.find(p=>p.id==="person-1").requiredMinutes,960);
  assert.equal(data.contractors.find(p=>p.id==="person-1").estimatedRequiredMonths,1);
  assert.equal(data.contractors.find(p=>p.id==="person-2").requiredMinutes,0);
  assert.equal(data.metrics.requiredMinutes,1920);
  assert.equal(data.metrics.estimatedRequiredPersonMonths,3);
  assert.deepEqual(server.snapshot(),before);
});

test("fixture all-date leave read includes August from September without touching daily history", async () => {
  const server=createWorkflowServer("rh");
  const before=server.snapshot();
  await server.request("/api/leave-requests",{method:"POST",body:JSON.stringify({contractorId:"person-1",startDate:"2026-08-12",endDate:"2026-08-12",requestedMinutes:60,reason:"Fictício"})});
  const all=await (await server.request("/api/dashboard?year=2026&month=9&approvalsScope=all")).json();
  const period=await (await server.request("/api/dashboard?year=2026&month=9&approvalsScope=period")).json();
  assert.equal(all.approvalsScope,"all"); assert.equal(all.requests.length,1);
  assert.equal(period.requests.length,0);
  assert.deepEqual(server.snapshot(),before);
});
test("isolated server never reaches external or unknown routes and scopes PJ data", async () => {
  const server = createWorkflowServer("pj");
  await assert.rejects(server.request("https://horuscodex.vercel.app/api/dashboard"), /externo/);
  await assert.rejects(server.request("/api/unmapped"), /não simulada/);
  const data = await (await server.request("/api/dashboard?year=2026&month=8&viewAs=person-2")).json();
  assert.deepEqual(data.contractors.map(p => p.id), ["person-1"]);
  assert.ok(data.entries.every(e => e.contractorId === "person-1"));
});
test("fictitious leave submission is scoped and never changes daily history", async () => {
  const server = createWorkflowServer("pj");
  const before = server.snapshot();
  const response = await server.request("/api/leave-requests", { method: "POST", body: JSON.stringify({
    contractorId: "person-2", startDate: "2026-08-12", endDate: "2026-08-12",
    requestedMinutes: 120, reason: "Ensaio fictício",
  }) });
  assert.equal(response.status, 201);
  const data = await (await server.request("/api/dashboard?year=2026&month=8")).json();
  assert.equal(data.requests[0].contractorId, "person-1");
  assert.equal(data.requests[0].requestedMinutes, 120);
  assert.equal(data.requests[0].status, "REQUESTED");
  assert.deepEqual(server.snapshot(), before);
});
test("fictitious insufficient leave balance returns a conflict", async () => {
  const server = createWorkflowServer();
  const response = await server.request("/api/leave-requests", { method: "POST", body: JSON.stringify({
    contractorId: "person-1", startDate: "2026-08-12", endDate: "2026-08-12",
    requestedMinutes: 600, reason: "Ensaio fictício",
  }) });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Saldo fictício insuficiente/);
  const data = await (await server.request("/api/dashboard?year=2026&month=8")).json();
  assert.equal(data.requests.length, 0);
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

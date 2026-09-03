import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
const options = { configFile: false, envDir: false };
const command = { year: 2026, month: 8, contractorIds: ["person-1", "person-2"] };
const success = id => Response.json({ action: "CLOSE", result: { timesheetId: `ts_${id}_2026_8`, alreadyClosed: false } });

test("monthly API adapter sends each selected person once and validates the response identity", async () => {
  const { module: client } = await runnerImport("./app/closing-client.ts", options);
  const calls = [];
  const submit = client.createClosingSubmit(async (path, init) => {
    calls.push({ path, method: init.method, body: JSON.parse(init.body) });
    return calls.length === 1 ? success("person-1") : Response.json({ action: "CLOSE", result: { timesheetId: "ts_person-2_2026_8", alreadyClosed: true } });
  });
  const before = structuredClone(command);
  const result = await submit({ ...command, contractorIds: ["person-1", "person-1", "person-2"] });
  assert.deepEqual(calls, ["person-1", "person-2"].map(contractorId => ({ path: "/api/timesheets", method: "POST", body: { action: "CLOSE", contractorId, year: 2026, month: 8 } })));
  assert.deepEqual(result.map(r => r.status), ["closed", "already-closed"]);
  assert.deepEqual(command, before);
});

test("invalid monthly selections never send a request", async () => {
  const { module: client } = await runnerImport("./app/closing-client.ts", options);
  let calls = 0;
  const submit = client.createClosingSubmit(async () => { calls++; return success("person-1"); });
  for (const invalid of [{ ...command, month: 13 }, { ...command, year: 1999 }, { ...command, contractorIds: [] }, { ...command, contractorIds: [""] }, { ...command, contractorIds: [null] }]) await assert.rejects(submit(invalid));
  assert.equal(calls, 0);
});

test("transport or malformed success stops the queue and never retries an uncertain write", async () => {
  const { module: client } = await runnerImport("./app/closing-client.ts", options);
  for (const response of [() => { throw Error("timeout"); }, () => Response.json({ action: "CLOSE", result: { timesheetId: "someone-else", alreadyClosed: false } }), () => Response.json({ action: "REOPEN", result: { timesheetId: "ts_person-1_2026_8", alreadyClosed: false } }), () => new Response("not-json"), () => new Response("unavailable", { status: 500 })]) {
    let calls = 0;
    const result = await client.createClosingSubmit(async () => { calls++; return response(); })(command);
    assert.equal(calls, 1);
    assert.deepEqual(result.map(r => r.status), ["uncertain", "blocked"]);
  }
});

test("a confirmed rejection reports the person and continues with the remaining selection", async () => {
  const { module: client } = await runnerImport("./app/closing-client.ts", options);
  let calls = 0;
  const result = await client.createClosingSubmit(async () => ++calls === 1 ? Response.json({ error: "Há pendência" }, { status: 409 }) : success("person-2"))(command);
  assert.deepEqual(result.map(r => r.status), ["blocked", "closed"]);
  assert.equal(result[0].message, "Há pendência");
});

test("a second simultaneous confirmation cannot duplicate the first request", async () => {
  const { module: client } = await runnerImport("./app/closing-client.ts", options);
  let release;
  let calls = 0;
  const submit = client.createClosingSubmit(async () => { calls++; await new Promise(resolve => { release = resolve; }); return success("person-1"); });
  const first = submit({ ...command, contractorIds: ["person-1"] });
  await assert.rejects(submit({ ...command, contractorIds: ["person-1"] }));
  release();
  assert.equal((await first)[0].status, "closed");
  assert.equal(calls, 1);
});

test("a real confirmation is not mislabeled as a fictitious test", async () => {
  const { module: view } = await runnerImport("./app/ClosingConfirmation.tsx", options);
  const { module: model } = await runnerImport("./app/closing-model.ts", options);
  const props = { command: { ...command, contractorIds: ["person-1"] }, rows: model.buildClosingRows(makeWorkflowDashboard()), submit: async () => [], onClose() {}, onSettled() {} };
  const real = renderToStaticMarkup(createElement(view.ClosingConfirmation, props));
  assert.doesNotMatch(real, /TESTE — DADOS FICTÍCIOS/);
  assert.match(real, /Fechar mês de Ana Exemplo/);
  const fixture = renderToStaticMarkup(createElement(view.ClosingConfirmation, { ...props, testMode: true }));
  assert.match(fixture, /TESTE — DADOS FICTÍCIOS/);
});

test("the monthly screen explains whether confirmation can close the month", async () => {
  const { module: view } = await runnerImport("./app/ClosingOverview.tsx", options);
  const props = { data: makeWorkflowDashboard(), onReview() {}, onIssue() {} };
  const enabled = renderToStaticMarkup(createElement(view.ClosingOverview, { ...props, closingEnabled: true }));
  assert.match(enabled, /O mês só será fechado após sua confirmação/);
  assert.doesNotMatch(enabled, /SOMENTE CONFERÊNCIA|Nenhum dado será alterado nesta tela/);
  const disabled = renderToStaticMarkup(createElement(view.ClosingOverview, props));
  assert.match(disabled, /SOMENTE CONFERÊNCIA/);
  assert.match(disabled, /Fechamento temporariamente indisponível/);
});

test("a request that does not return is aborted and remains uncertain", async t => {
  const { module: client } = await runnerImport("./app/closing-client.ts", options);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal;
  const submit = client.createClosingSubmit(async (_path, init) => { signal = init.signal; return new Promise(() => {}); });
  const pending = submit(command);
  t.mock.timers.tick(15_000);
  const result = await pending;
  assert.equal(signal.aborted, true);
  assert.deepEqual(result.map(r => r.status), ["uncertain", "blocked"]);
});

test("the actual monthly adapter works through the isolated HTTP contract and preserves daily history", async () => {
  const { module: client } = await runnerImport("./app/closing-client.ts", options);
  const { module: fixture } = await runnerImport("./tests/helpers/workflow-server.ts", options);
  const server = fixture.createWorkflowServer("rh");
  const before = server.snapshot();
  const output = await client.createClosingSubmit(server.request)(command);
  assert.deepEqual(output.map(r => r.status), ["closed", "closed"]);
  assert.equal(server.calls.filter(c => c.method === "POST" && c.path === "/api/timesheets").length, 2);
  assert.deepEqual(server.snapshot(), before);
  const data = await (await server.request("/api/dashboard?year=2026&month=8")).json();
  assert.ok(data.monthlyTimesheets.every(s => s.status === "CLOSED"));
  const pj = fixture.createWorkflowServer("pj");
  const blocked = await client.createClosingSubmit(pj.request)(command);
  assert.deepEqual(blocked.map(r => r.status), ["blocked", "blocked"]);
  assert.equal(pj.closingCalls.length, 0);
});

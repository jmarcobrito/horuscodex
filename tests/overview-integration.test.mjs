import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
test("real RH shell mounts the monthly overview once and collaborator shell never receives it", async () => {
  const { module: { HorusApp } } = await runnerImport("./app/HorusApp.tsx", { configFile: false, envDir: false });
  const calls = [], props = { user: { name: "Pessoa fictícia", email: "test@example.com" }, organizationName: "Teste local", initialDashboard: makeWorkflowDashboard(), request(...args) { calls.push(args); throw Error("SSR must not request"); } };
  const rh = renderToStaticMarkup(createElement(HorusApp, { ...props, accountRole: "rh" }));
  assert.match(rh, /Ir para fechamento/);
  assert.equal((rh.match(/aria-label="Mês de consulta"/g) ?? []).length, 1);
  const pj = renderToStaticMarkup(createElement(HorusApp, { ...props, accountRole: "pj" }));
  assert.doesNotMatch(pj, /Ir para fechamento|Conferência da equipe|Filtrar painel por pessoa/);
  const dev = renderToStaticMarkup(createElement(HorusApp, { ...props, accountRole: "dev" }));
  assert.match(dev, /MODO DEV/); assert.match(dev, /Visualizar como colaborador/); assert.match(dev, /Ir para fechamento/);
  assert.equal(calls.length, 0);
});

test("fictional full snapshot covers all records and read navigation leaves every collection untouched", async () => {
  const { module: { createWorkflowServer } } = await runnerImport("./tests/helpers/workflow-server.ts", { configFile: false, envDir: false });
  const { module: { buildOverviewModel, defaultOverviewFilters } } = await runnerImport("./app/overview-model.ts", { configFile: false, envDir: false });
  const server = createWorkflowServer("rh", "overview");
  const before = server.fullSnapshot();
  assert.equal(before.dashboards.length, 2);
  assert.ok(before.versions["entry-1"].length);
  for (const path of ["/api/dashboard?year=2026&month=8", "/api/dashboard?year=2026&month=9", "/api/dashboard?from=2026-08-03&to=2026-08-15", "/api/time-entries/entry-1/history"]) {
    const data = await (await server.request(path)).json();
    if (data.period) buildOverviewModel(data, defaultOverviewFilters);
  }
  assert.deepEqual(server.fullSnapshot(), before);
  assert.ok(server.calls.every(call => call.method === "GET"));
  assert.equal(server.closingCalls.length, 0);
  const result = buildOverviewModel(server.initialDashboard, defaultOverviewFilters);
  assert.deepEqual(result.counts, { UNKNOWN:1, NO_RECORD:1, NO_ENTRIES:1, PENDING:1, READY:1, CLOSED:1 });
});

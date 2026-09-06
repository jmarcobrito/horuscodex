import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
const options = { configFile: false, envDir: false };

test("only the accepted response stamps the workspace; stale, invalid and failed reads never retain a timestamp", async () => {
  const { module: w } = await runnerImport("./app/workspace-state.ts", options);
  const data = makeWorkflowDashboard(), key = "rh:self:overview";
  let state = w.initialWorkspace(key, data);
  assert.equal(state[key].receivedAt, null);
  for (const requestId of [10, 11]) state = w.workspaceReducer(state, { type: "start", key, period: data.period, requestId });
  state = w.workspaceReducer(state, { type: "success", key, requestId: 10, data, receivedAt: "2026-09-05T10:00:00Z" });
  assert.equal(state[key].receivedAt, null);
  state = w.workspaceReducer(state, { type: "success", key, requestId: 11, data, receivedAt: "2026-09-05T11:00:00Z" });
  assert.equal(state[key].receivedAt, "2026-09-05T11:00:00Z");
  for (const action of [
    { type: "failure", key, requestId: 11, message: "offline" },
    { type: "success", key, requestId: 11, data: makeWorkflowDashboard(2026, 9), receivedAt: "2026-09-05T12:00:00Z" },
    { type: "success", key, requestId: 11, data: { ...data, approvalsScope: "all" }, receivedAt: "2026-09-05T12:00:00Z" },
    { type: "success", key, requestId: 11, data, receivedAt: "invalid" },
    { type: "success", key, requestId: 11, data },
    { type: "invalidate" },
  ]) assert.equal(w.workspaceReducer(state, action)[key].receivedAt, null);
});

test("approval scopes have separate slots and reject responses from another scope", async () => {
  const {module:w} = await runnerImport("./app/workspace-state.ts", options);
  const allKey=w.workspaceKey("rh","requests","","all"), periodKey=w.workspaceKey("rh","requests","","period");
  assert.notEqual(allKey,periodKey);
  assert.equal(w.workspaceKey("rh","entries","","all"),w.workspaceKey("rh","entries","","period"));
  assert.notEqual(allKey,w.workspaceKey("pj","requests","person-1","all"));
  const august=makeWorkflowDashboard(), september=makeWorkflowDashboard(2026,9);
  let state=w.initialWorkspace(w.workspaceKey("rh","overview"),august);
  state=w.workspaceReducer(state,{type:"start",key:allKey,period:august.period,requestId:1});
  state=w.workspaceReducer(state,{type:"success",key:allKey,requestId:1,data:august});
  assert.ok(state[allKey].error); assert.equal(state[allKey].data,null);
  state=w.workspaceReducer(state,{type:"start",key:allKey,period:august.period,requestId:2});
  state=w.workspaceReducer(state,{type:"start",key:periodKey,period:september.period,requestId:3});
  state=w.workspaceReducer(state,{type:"success",key:periodKey,requestId:3,data:september});
  state=w.workspaceReducer(state,{type:"success",key:allKey,requestId:2,data:{...august,approvalsScope:"all"}});
  assert.equal(state[periodKey].data.period.month,9);
  assert.equal(state[allKey].data.approvalsScope,"all");
  assert.equal(state[w.workspaceKey("rh","overview")].period.month,8);
});

test("leaving an unselected monthly screen does not strand approvals without a picker", async () => {
  const { module: w } = await runnerImport("./app/workspace-state.ts", options);
  const initial = makeWorkflowDashboard().period;
  const partial = { from: "2026-08-03", to: "2026-08-15", year: null, month: null };
  assert.equal(w.firstVisitPeriod("entries", partial, initial), null);
  assert.equal(w.firstVisitPeriod("closing", null, initial), null);
  assert.deepEqual(w.firstVisitPeriod("requests", null, partial), partial);
  assert.deepEqual(w.firstVisitPeriod("team", null, initial), initial);
  assert.deepEqual(w.firstVisitPeriod("reports", initial, partial), initial);
});

test("tabs keep independent months and reject late responses", async () => {
  const { module: w } = await runnerImport("./app/workspace-state.ts", options);
  const august = makeWorkflowDashboard(2026, 8), september = makeWorkflowDashboard(2026, 9);
  let state = w.initialWorkspace("rh:self:overview", august);
  state = w.workspaceReducer(state, { type: "open", key: "rh:self:entries", period: august.period });
  state = w.workspaceReducer(state, { type: "start", key: "rh:self:entries", period: august.period, requestId: 1 });
  state = w.workspaceReducer(state, { type: "start", key: "rh:self:entries", period: september.period, requestId: 2 });
  state = w.workspaceReducer(state, { type: "success", key: "rh:self:entries", requestId: 1, data: august });
  assert.equal(state["rh:self:entries"].data, null);
  state = w.workspaceReducer(state, { type: "success", key: "rh:self:entries", requestId: 2, data: september });
  assert.equal(state["rh:self:entries"].data.period.month, 9);
  assert.equal(state["rh:self:overview"].period.month, 8);
  state = w.workspaceReducer(state, { type: "open", key: "rh:self:entries", period: august.period });
  assert.equal(state["rh:self:entries"].period.month, 9);
  assert.notEqual(w.workspaceKey("pj", "entries", "person-1"), w.workspaceKey("pj", "entries", "person-2"));
});
test("wrong-period data and failures cannot look like empty successful months", async () => {
  const { module: w } = await runnerImport("./app/workspace-state.ts", options);
  const august = makeWorkflowDashboard(), september = makeWorkflowDashboard(2026, 9);
  let state = w.initialWorkspace("rh:self:entries", august);
  state = w.workspaceReducer(state, { type: "start", key: "rh:self:entries", period: september.period, requestId: 1 });
  state = w.workspaceReducer(state, { type: "success", key: "rh:self:entries", requestId: 1, data: august });
  assert.equal(state["rh:self:entries"].data, null);
  assert.ok(state["rh:self:entries"].error);
  assert.equal(state["rh:self:entries"].loading, false);
  state = w.workspaceReducer(state, { type: "start", key: "rh:self:entries", period: september.period, requestId: 2 });
  state = w.workspaceReducer(state, { type: "invalidate" });
  state = w.workspaceReducer(state, { type: "success", key: "rh:self:entries", requestId: 2, data: september });
  assert.equal(state["rh:self:entries"].data, null);
  assert.equal(state["rh:self:entries"].period.month, 9);
});
test("an unselected screen stays unselected instead of guessing the current month", async () => {
  const { module: w } = await runnerImport("./app/workspace-state.ts", options);
  const state = w.workspaceReducer({}, { type: "open", key: "rh:self:closing", period: null });
  assert.equal(state["rh:self:closing"].period, null);
  assert.equal(state["rh:self:closing"].data, null);
  assert.equal(state["rh:self:closing"].loading, false);
});

test("reports keep a period independent from the other RH workspaces", async () => {
  const { module: w } = await runnerImport("./app/workspace-state.ts", options);
  const august = makeWorkflowDashboard(2026, 8), september = makeWorkflowDashboard(2026, 9);
  let state = w.initialWorkspace("rh:self:overview", august);
  state = w.workspaceReducer(state, { type: "open", key: "rh:self:reports", period: september.period });
  state = w.workspaceReducer(state, { type: "start", key: "rh:self:reports", period: september.period, requestId: 7 });
  state = w.workspaceReducer(state, { type: "success", key: "rh:self:reports", requestId: 7, data: september });
  assert.equal(state["rh:self:overview"].period.month, 8);
  assert.equal(state["rh:self:reports"].period.month, 9);
  assert.notEqual(w.workspaceKey("rh", "reports"), w.workspaceKey("rh", "overview"));
});

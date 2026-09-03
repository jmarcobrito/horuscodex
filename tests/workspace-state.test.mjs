import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
const options = { configFile: false, envDir: false };

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

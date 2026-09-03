import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
const options = { configFile: false, envDir: false };
test("filtered entries and totals stay scoped to the same inactive person", async () => {
  const { module: e } = await runnerImport("./app/entries-model.ts", options);
  const data = makeWorkflowDashboard();
  const filtered = e.selectEntries(data, "person-2");
  assert.equal(filtered.entries.length, 1);
  assert.equal(filtered.entries[0].contractorId, "person-2");
  assert.equal(filtered.summary.workedMinutes, 300);
  assert.equal(filtered.summary.requiredMinutes, 480);
  assert.equal(filtered.title, "Resumo de Bruno Teste");
  assert.equal(e.selectEntries(data, null).summary.workedMinutes, 780);
  assert.throws(() => e.selectEntries(data, "unavailable-person"));
});
test("daily edit checks that person's month rather than the team's mixed status", async () => {
  const { module: e } = await runnerImport("./app/entries-model.ts", options);
  const data = makeWorkflowDashboard();
  data.timesheet.status = "MIXED";
  const entry = data.entries.find(item => item.id === "entry-1");
  assert.equal(e.entryEditBlockReason(data, entry, false), null);
  data.monthlyTimesheets.find(item => item.contractorId === "person-1").status = "CLOSED";
  assert.match(e.entryEditBlockReason(data, entry, false), /fechado/i);
  assert.match(e.entryEditBlockReason(data, entry, true), /consulta/i);
  delete data.monthlyTimesheets;
  assert.match(e.entryEditBlockReason(data, entry, false), /disponível/i);
});
test("missing or duplicated monthly records never enable edits", async () => {
  const { module: e } = await runnerImport("./app/entries-model.ts", options);
  const data = makeWorkflowDashboard(), entry = data.entries[0];
  const monthly = data.monthlyTimesheets;
  data.monthlyTimesheets = [];
  assert.ok(e.entryEditBlockReason(data, entry, false));
  data.monthlyTimesheets = [...monthly, monthly[0]];
  assert.ok(e.entryEditBlockReason(data, entry, false));
});
test("a saved day is not saved twice when only the refresh fails", async () => {
  const { module: e } = await runnerImport("./app/entries-model.ts", options);
  let saves = 0;
  assert.equal(await e.saveThenRefresh(async () => { saves++; }, async () => { throw Error("offline"); }), "saved-refresh-failed");
  assert.equal(saves, 1);
  assert.equal(await e.saveThenRefresh(async () => {}, async () => {}), "saved");
  await assert.rejects(e.saveThenRefresh(async () => { throw Error("denied"); }, async () => { throw Error("must not refresh"); }), /denied/);
});

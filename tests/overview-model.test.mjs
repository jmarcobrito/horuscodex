import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
const load = async () => (await runnerImport("./app/overview-model.ts", { configFile: false, envDir: false })).module;

test("overview preserves inactive history, known hours without a sheet, and source data", async () => {
  const m = await load(), data = makeWorkflowDashboard(), before = structuredClone(data);
  const result = m.buildOverviewModel(data, m.defaultOverviewFilters);
  assert.equal(result.totalPeople, 3);
  assert.deepEqual(result.counts, { UNKNOWN: 0, NO_RECORD: 1, NO_ENTRIES: 0, PENDING: 0, READY: 2, CLOSED: 0 });
  assert.equal(result.rows[1].person.status, "INACTIVE");
  assert.deepEqual(data, before);
  data.monthlyTimesheets = [];
  const noSheets = m.buildOverviewModel(data, m.defaultOverviewFilters);
  assert.equal(noSheets.counts.NO_RECORD, 3);
  assert.equal(noSheets.rows[0].workedMinutes, 480);
});

test("partial periods cannot infer monthly readiness and dates count distinct work days", async () => {
  const m = await load(), data = makeWorkflowDashboard();
  data.entries.push({ ...data.entries[0], id: "second", calculatedMinutes: 60 });
  data.period = { from: "2026-08-03", to: "2026-08-05", year: null, month: null };
  const result = m.buildOverviewModel(data, { ...m.defaultOverviewFilters, status: "READY" });
  assert.equal(result.fullMonth, false);
  assert.equal(result.counts, null);
  assert.ok(result.rows.every(r => r.closing === null));
  assert.equal(result.rows[0].days, 1);
  assert.equal(result.rows[0].workedMinutes, 540);
});

test("all monthly states remain distinct, including unknown and duplicate metadata", async () => {
  const m = await load();
  for (const [change, expected] of [
    [d => { d.monthlyTimesheets = undefined; }, "UNKNOWN"],
    [d => { d.monthlyTimesheets.push({ ...d.monthlyTimesheets[0] }); }, "UNKNOWN"],
    [d => { d.monthlyTimesheets = []; }, "NO_RECORD"],
    [d => { d.entries = []; }, "NO_ENTRIES"],
    [d => { d.entries[0].nonBusinessDayStatus = "PENDING_AUTHORIZATION"; }, "PENDING"],
    [d => { d.monthlyTimesheets[0].status = "CLOSED"; }, "CLOSED"],
  ]) {
    const data = makeWorkflowDashboard(); change(data);
    const before = structuredClone(data), result = m.buildOverviewModel(data, m.defaultOverviewFilters);
    assert.equal(result.rows[0].closing.status, expected);
    assert.equal(Object.values(result.counts).reduce((a,b) => a+b, 0), result.totalPeople);
    assert.deepEqual(data, before);
  }
});

test("combined scope filters every person collection and recalculates summaries without status leaking into bank", async () => {
  const m = await load(), data = makeWorkflowDashboard();
  data.contractors[0].sectorId = null;
  data.balanceLots = [
    { contractorId: "person-1", type: "CREDIT", remainingMinutes: 100, reservedMinutes: 30, status: "ACTIVE" },
    { contractorId: "person-1", type: "CREDIT", remainingMinutes: 200, reservedMinutes: 0, status: "EXPIRED" },
    { contractorId: "person-1", type: "DEBIT", remainingMinutes: 40, reservedMinutes: 0, status: "OPEN" },
    { contractorId: "person-2", type: "DEBIT", remainingMinutes: 500, reservedMinutes: 0, status: "OPEN" },
  ];
  for (const key of ["requests", "occurrences", "authorizations", "balanceTransactions"]) data[key] = [{ contractorId: "person-1", status: "REQUESTED" }, { contractorId: "person-2", status: "REQUESTED" }];
  const before = structuredClone(data);
  const filters = { personId: null, sectorId: "__unassigned__", status: "CLOSED" };
  const result = m.buildOverviewModel(data, filters);
  assert.equal(result.rows.length, 0);
  assert.equal(result.totalPeople, 1);
  assert.deepEqual(result.bank, { availableMinutes: 70, reservedMinutes: 30, debitMinutes: 40 });
  const scoped = result.scopedData;
  assert.equal(scoped.metrics.requiredMinutes, 480);
  assert.equal(scoped.metrics.workedMinutes, 480);
  assert.equal(scoped.timesheet.consideredMinutes, 480);
  for (const key of ["requests", "occurrences", "authorizations", "balanceTransactions"]) assert.equal(scoped[key].length, 1);
  assert.deepEqual(data, before);
  data.monthlyTimesheets = undefined;
  assert.equal(m.scopeDashboard(data, filters).monthlyTimesheets, undefined);
  assert.equal(m.resolveReviewIds(data, { personId: "person-2", sectorId: "__unassigned__" }).size, 0);
});

test("normalization clears unavailable choices with notice, but keeps valid empty status filters", async () => {
  const m = await load(), data = makeWorkflowDashboard();
  data.contractors[0].sectorId = null;
  const result = m.normalizeOverviewFilters(data, { personId: "person-2", sectorId: "__unassigned__", status: "CLOSED" });
  assert.deepEqual(result.filters, { personId: null, sectorId: "__unassigned__", status: "CLOSED" });
  assert.ok(result.notice);
  assert.deepEqual(m.normalizeOverviewFilters(data, m.defaultOverviewFilters), { filters: m.defaultOverviewFilters, notice: null });
  data.period.to = "2026-08-05";
  assert.equal(m.normalizeOverviewFilters(data, { ...result.filters, status: "READY" }).filters.status, "all");
  assert.deepEqual(m.normalizeOverviewFilters(data, { personId: "missing", sectorId: "missing", status: "all" }).filters, m.defaultOverviewFilters);
});

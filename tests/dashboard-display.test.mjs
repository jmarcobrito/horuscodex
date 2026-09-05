import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";

const loadDisplay = async () => (await runnerImport("./app/dashboard-display.ts", { configFile: false, envDir: false })).module;
const credit = { id: "lot-1", contractorId: "person-1", contractorName: "Pessoa fictícia",
  type: "CREDIT", originalMinutes: 600, remainingMinutes: 600, reservedMinutes: 480,
  originDate: "2026-08-31", deadlineDate: "2099-12-31", status: "RESERVED" };

test("available credit excludes reservations and unusable lots without changing source data", async () => {
  const { dashboardDisplay } = await loadDisplay();
  const data = makeWorkflowDashboard();
  data.balanceLots = [credit, { ...credit, id: "overdue", remainingMinutes: 90, reservedMinutes: 30, status: "OVERDUE_AVAILABLE" },
    ...["EXPIRED", "CONSUMED", "CANCELLED", "SETTLED"].map(status => ({ ...credit, id: status, status })),
    { ...credit, id: "debit", type: "DEBIT" }];
  const before = structuredClone(data);
  const result = dashboardDisplay(data);
  assert.equal(result.validCreditMinutes, 690);
  assert.equal(result.reservedCreditMinutes, 510);
  assert.equal(result.availableCreditMinutes, 180);
  assert.deepEqual(data, before);
});

test("an over-reserved lot cannot cancel another lot's available credit", async () => {
  const { dashboardDisplay } = await loadDisplay();
  const data = makeWorkflowDashboard();
  data.balanceLots = [credit, { ...credit, id: "over-reserved", remainingMinutes: 60, reservedMinutes: 90 }];
  assert.equal(dashboardDisplay(data).availableCreditMinutes, 120);
});

test("one day without entries does not inherit the complete month's credits or projection", async () => {
  const { dashboardDisplay } = await loadDisplay();
  const data = makeWorkflowDashboard();
  data.period = { from: "2026-08-10", to: "2026-08-10", year: null, month: null };
  data.entries = [];
  data.monthlyTimesheets = [{ ...data.monthlyTimesheets[0], status: "CLOSED", creditedMinutes: 480, consideredMinutes: 900 }];
  data.metrics.requiredMinutes = 600;
  // The previous mixed-scope projection must never become the monthly context.
  data.timesheet = { ...data.timesheet, workedMinutes: 0, consideredMinutes: 480, projectedBalanceMinutes: -120 };
  const before = structuredClone(data);
  const result = dashboardDisplay(data);
  assert.equal(result.fullMonth, false);
  assert.equal(result.workedMinutes, 0);
  assert.equal(result.entryEligibleMinutes, 0);
  assert.deepEqual(result.monthlyContext, { creditedMinutes: 480, requiredMinutes: 600, projectedBalanceMinutes: 300 });
  assert.deepEqual(data, before);
});

test("days with entries count distinct dates for each person, not entries or hours", async () => {
  const { dashboardDisplay } = await loadDisplay();
  const data = makeWorkflowDashboard();
  data.entries.push({ ...data.entries[0], id: "same-day" }, { ...data.entries[0], id: "other-day", workDate: "2026-08-05", eligibleMinutes: 0 });
  const result = dashboardDisplay(data);
  assert.deepEqual(result.daysByPerson, { "person-1": 2, "person-2": 1, "person-3": 0 });
  assert.equal(result.workedMinutes, 1740);
  assert.equal(result.entryEligibleMinutes, 1260);
});

test("full-month recognition uses actual dates including leap years, not optional month metadata", async () => {
  const { dashboardDisplay } = await loadDisplay();
  const data = makeWorkflowDashboard();
  for (const [from, to, fullMonth] of [
    ["2024-02-01", "2024-02-29", true],
    ["2024-02-01", "2024-02-28", false],
    ["2026-08-01", "2026-08-31", true],
    ["2026-08-01", "2026-09-30", false],
  ]) {
    data.period = { from, to, year: null, month: null };
    assert.equal(dashboardDisplay(data).fullMonth, fullMonth);
  }
});

test("missing monthly metadata is unavailable rather than an empty monthly result", async () => {
  const { dashboardDisplay } = await loadDisplay();
  const data = makeWorkflowDashboard();
  data.monthlyTimesheets = undefined;
  assert.equal(dashboardDisplay(data).monthlyContext, null);
  data.monthlyTimesheets = [];
  data.entries = [];
  data.metrics.requiredMinutes = 0;
  const result = dashboardDisplay(data);
  assert.deepEqual(result.monthlyContext, { creditedMinutes: 0, requiredMinutes: 0, projectedBalanceMinutes: 0 });
  assert.equal(result.availableCreditMinutes, 0);
  assert.equal(result.workedMinutes, 0);
});

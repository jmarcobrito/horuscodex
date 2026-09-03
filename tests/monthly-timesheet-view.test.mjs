import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
test("monthly projection preserves source and never guesses closing identity", async () => {
  const { module: m } = await runnerImport("./db/monthly-timesheet-view.ts", { configFile: false, envDir: false });
  const row = { id: "month-1", contractor_id: "person-1", year: 2026, month: 8, status: "CLOSED", worked_minutes: 480, credited_minutes: 30, considered_minutes: 510, required_minutes: 480, closed_at: "2026-09-01T12:00:00Z", closed_by: "rh-test" };
  const before = structuredClone(row);
  const projected = m.projectMonthlyTimesheet(row, new Map([["rh-test", "RH Exemplo"]]));
  assert.equal(projected.closedByName, "RH Exemplo");
  assert.equal(projected.consideredMinutes, 510);
  assert.equal(projected.closedAt, "2026-09-01T12:00:00Z");
  assert.equal(m.projectMonthlyTimesheet(row, new Map()).closedByName, null);
  assert.equal(m.projectMonthlyTimesheet({ ...row, status: "OPEN", closed_at: null, closed_by: null }, new Map()).closedAt, null);
  assert.deepEqual(row, before);
});

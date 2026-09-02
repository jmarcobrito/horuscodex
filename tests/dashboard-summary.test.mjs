import assert from "node:assert/strict";
import test from "node:test";

import { buildPeriodSummary } from "../db/dashboard-summary.ts";

test("historical totals keep entries and timesheets from inactive people", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }, { id: "former", status: "INACTIVE" }],
    entries: [
      { contractorId: "active", calculatedMinutes: 480, eligibleMinutes: 480 },
      { contractorId: "former", calculatedMinutes: 420, eligibleMinutes: 420 },
    ],
    timesheets: [
      { contractorId: "active", requiredMinutes: 9720, creditedMinutes: 0 },
      { contractorId: "former", requiredMinutes: 9720, creditedMinutes: 60 },
    ],
    requiredPerMonth: 9720,
    monthCount: 1,
  });

  assert.deepEqual(result, {
    activeContractors: 1,
    workedMinutes: 900,
    creditedMinutes: 60,
    consideredMinutes: 960,
    requiredMinutes: 19440,
    includedContractorIds: ["active", "former"],
  });
});

test("an active person without a timesheet contributes the fallback requirement", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }],
    entries: [],
    timesheets: [],
    requiredPerMonth: 9720,
    monthCount: 2,
  });

  assert.equal(result.requiredMinutes, 19440);
  assert.deepEqual(result.includedContractorIds, ["active"]);
});

test("fallback requirement is added only for active people missing a timesheet", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }, { id: "former", status: "INACTIVE" }],
    entries: [],
    timesheets: [{ contractorId: "former", requiredMinutes: 9000, creditedMinutes: 0 }],
    requiredPerMonth: 9720,
    monthCount: 1,
  });

  assert.equal(result.requiredMinutes, 18720);
});

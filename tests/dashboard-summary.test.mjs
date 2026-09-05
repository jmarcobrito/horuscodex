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
      { contractorId: "active", year: 2026, month: 8, requiredMinutes: 9720, creditedMinutes: 0 },
      { contractorId: "former", year: 2026, month: 8, requiredMinutes: 9720, creditedMinutes: 60 },
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
    estimatedRequiredPersonMonths: 0,
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
  assert.equal(result.estimatedRequiredPersonMonths, 2);
  assert.deepEqual(result.includedContractorIds, ["active"]);
});

test("two months with one stored month include the missing month without changing history", () => {
  const input = {
    users: [{ id: "active", status: "ACTIVE" }], entries: [],
    timesheets: [{ contractorId: "active", year: 2026, month: 8, requiredMinutes: 60, creditedMinutes: 0 }],
    requiredPerMonth: 60, monthCount: 2,
  };
  const before = structuredClone(input);
  const result = buildPeriodSummary(input);
  assert.equal(result.requiredMinutes, 120);
  assert.equal(result.estimatedRequiredPersonMonths, 1);
  assert.deepEqual(input, before);
});

test("different historical requirements including zero are preserved without estimates", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }], entries: [],
    timesheets: [
      { contractorId: "active", year: 2025, month: 12, requiredMinutes: 90, creditedMinutes: 0 },
      { contractorId: "active", year: 2026, month: 1, requiredMinutes: 0, creditedMinutes: 0 },
    ],
    requiredPerMonth: 120, monthCount: 2,
  });
  assert.equal(result.requiredMinutes, 90);
  assert.equal(result.estimatedRequiredPersonMonths, 0);
});

test("inactive people retain stored requirements but do not receive missing-month estimates", () => {
  const result = buildPeriodSummary({
    users: [{ id: "former", status: "INACTIVE" }], entries: [],
    timesheets: [{ contractorId: "former", year: 2026, month: 8, requiredMinutes: 60, creditedMinutes: 0 }],
    requiredPerMonth: 120, monthCount: 2,
  });
  assert.equal(result.requiredMinutes, 60);
  assert.equal(result.estimatedRequiredPersonMonths, 0);
});

test("duplicate months for the same person fail the consultation without changing history", () => {
  const sheet = { contractorId: "active", year: 2026, month: 8, requiredMinutes: 60, creditedMinutes: 0 };
  const input = { users: [{ id: "active", status: "ACTIVE" }], entries: [], timesheets: [sheet, { ...sheet }], requiredPerMonth: 60, monthCount: 2 };
  const before = structuredClone(input);
  assert.throws(() => buildPeriodSummary(input), /registro mensal duplicado/i);
  assert.deepEqual(input, before);
});

test("fallback requirement is added only for active people missing a timesheet", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }, { id: "former", status: "INACTIVE" }],
    entries: [],
    timesheets: [{ contractorId: "former", year: 2026, month: 8, requiredMinutes: 9000, creditedMinutes: 0 }],
    requiredPerMonth: 9720,
    monthCount: 1,
  });

  assert.equal(result.requiredMinutes, 18720);
});

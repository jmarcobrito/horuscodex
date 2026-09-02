import assert from "node:assert/strict";
import test from "node:test";

import { validateDailyAllocation } from "../db/daily-allocation.ts";

test("accepts explicit daily hours when dates and total match", () => {
  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    totalMinutes: 720,
    days: [
      { date: "2026-09-02", minutes: 240 },
      { date: "2026-09-01", minutes: 480 },
    ],
  }), {
    ok: true,
    days: [
      { date: "2026-09-01", minutes: 480 },
      { date: "2026-09-02", minutes: 240 },
    ],
  });
});

test("rejects a daily sum that differs from the request total", () => {
  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    totalMinutes: 720,
    days: [{ date: "2026-09-01", minutes: 480 }],
  }), { ok: false, code: "DAILY_TOTAL_MISMATCH", field: "days" });
});

test("rejects duplicate days", () => {
  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    totalMinutes: 960,
    days: [
      { date: "2026-09-01", minutes: 480 },
      { date: "2026-09-01", minutes: 480 },
    ],
  }), { ok: false, code: "DUPLICATE_DAY", field: "days" });
});

test("rejects a day outside the selected period", () => {
  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    totalMinutes: 480,
    days: [{ date: "2026-09-03", minutes: 480 }],
  }), { ok: false, code: "DAY_OUTSIDE_PERIOD", field: "days" });
});

test("rejects invalid dates and minute limits", () => {
  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-31",
    endDate: "2026-09-31",
    totalMinutes: 480,
    days: [{ date: "2026-09-31", minutes: 480 }],
  }), { ok: false, code: "INVALID_DAILY_ALLOCATION", field: "days" });

  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    totalMinutes: 1441,
    days: [{ date: "2026-09-01", minutes: 1441 }],
  }), { ok: false, code: "INVALID_DAILY_ALLOCATION", field: "days" });
});

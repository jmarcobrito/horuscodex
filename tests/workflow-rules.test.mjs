import assert from "node:assert/strict";
import test from "node:test";

import { allocateFifo, balanceDeadline, deadlineStatus } from "../db/workflow-rules.ts";

test("counts the 90-day deadline from the last day of the competence", () => {
  assert.equal(balanceDeadline(2026, 7), "2026-10-29");
  assert.equal(balanceDeadline(2026, 13), null);
});

test("allocates credits from the oldest eligible lot first", () => {
  assert.deepEqual(allocateFifo([
    { id: "aug", originDate: "2026-08-31", remainingMinutes: 240 },
    { id: "jul", originDate: "2026-07-31", remainingMinutes: 180 },
  ], 300), {
    allocations: [{ lotId: "jul", minutes: 180 }, { lotId: "aug", minutes: 120 }],
    remainingMinutes: 0,
    fullyAllocated: true,
  });
});

test("does not allocate minutes already reserved", () => {
  assert.deepEqual(allocateFifo([
    { id: "jul", originDate: "2026-07-31", remainingMinutes: 180, reservedMinutes: 120 },
  ], 90), {
    allocations: [{ lotId: "jul", minutes: 60 }],
    remainingMinutes: 30,
    fullyAllocated: false,
  });
});

test("applies deadline policy without deleting history", () => {
  assert.equal(deadlineStatus("CREDIT", "2026-10-29", "ALLOW_AFTER_DEADLINE", "2026-10-30"), "OVERDUE_AVAILABLE");
  assert.equal(deadlineStatus("CREDIT", "2026-10-29", "BLOCK_AFTER_DEADLINE", "2026-10-30"), "EXPIRED");
  assert.equal(deadlineStatus("DEBIT", "2026-10-29", "ALLOW_AFTER_DEADLINE", "2026-10-30"), "OVERDUE");
});


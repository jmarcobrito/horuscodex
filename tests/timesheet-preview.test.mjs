import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTimesheetPreview } from "../db/timesheet-preview.ts";

const base = {
  organizationId: "org_1",
  contractorId: "usr_1",
  year: 2026,
  month: 9,
  workedMinutes: 9_240,
  occurrenceMinutes: 0,
  leaveMinutes: 480,
  creditedMinutes: 480,
  consideredMinutes: 9_720,
  requiredMinutes: 9_720,
  projectedBalanceMinutes: 0,
  bankImpact: { direction: "NONE", minutes: 0 },
  blockers: [],
  warnings: [{ code: "APPROVED_LEAVE", message: "Há uma folga aprovada neste mês." }],
  reviewVersion: "review-1",
};

test("normalizes a month that is ready to close", () => {
  assert.deepEqual(normalizeTimesheetPreview({ ...base, state: "READY" }), {
    ...base,
    state: "READY",
  });
});

test("normalizes blockers without losing their suggested action", () => {
  const blockers = [{
    code: "PENDING_LEAVE",
    message: "Há uma folga aguardando análise.",
    action: "REVIEW_LEAVE",
  }];

  assert.deepEqual(normalizeTimesheetPreview({
    ...base,
    state: "NEEDS_REVIEW",
    blockers,
  }), {
    ...base,
    state: "NEEDS_REVIEW",
    blockers,
  });
});

test("normalizes a closed month and keeps its opaque review version", () => {
  const preview = normalizeTimesheetPreview({
    ...base,
    state: "CLOSED",
    blockers: [{
      code: "ALREADY_CLOSED",
      message: "Este mês já está fechado.",
      action: "VIEW_CLOSING",
    }],
    reviewVersion: "closed-review",
  });

  assert.equal(preview.state, "CLOSED");
  assert.equal(preview.reviewVersion, "closed-review");
});

test("rejects malformed database responses", () => {
  assert.throws(
    () => normalizeTimesheetPreview({ ...base, state: "OPEN" }),
    /Invalid timesheet preview/,
  );
});

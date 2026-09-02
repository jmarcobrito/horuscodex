import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { domainErrorFromUnknown, domainErrorResponse } from "../db/domain-errors.ts";

test("turns database domain errors into a stable UI contract", async () => {
  const translated = domainErrorResponse(
    domainErrorFromUnknown(new Error("HORUS_DOMAIN:REVIEW_OUTDATED")),
  );

  assert.deepEqual(translated, {
    status: 409,
    body: {
      error: {
        code: "REVIEW_OUTDATED",
        message: "Os dados deste mês mudaram. Revise novamente antes de fechar.",
        field: null,
        action: "REVIEW_AGAIN",
      },
    },
  });
});

test("uses daily allocations and atomic request operations", async () => {
  const [leave, occurrence, authorization] = await Promise.all([
    readFile(new URL("../app/api/leave-requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/occurrences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/non-business-authorizations/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(leave, /validateDailyAllocation/);
  assert.match(leave, /create_leave_request_v2/);
  assert.doesNotMatch(leave, /"UTILIZE"/);
  assert.match(occurrence, /validateDailyAllocation/);
  assert.match(occurrence, /create_occurrence_v2/);
  assert.match(occurrence, /decide_occurrence_v2/);
  assert.doesNotMatch(occurrence, /BANK_LEAVE/);
  assert.match(authorization, /create_non_business_authorization_v2/);
  assert.match(authorization, /decide_non_business_authorization_v2/);
});

test("exposes official preview, individual close, batch close and reopen preview", async () => {
  const [timesheets, preview, batch, reopenPreview] = await Promise.all([
    readFile(new URL("../app/api/timesheets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/timesheets/preview/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/timesheets/close-batch/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/timesheets/reopen-preview/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(timesheets, /close_timesheet_v2/);
  assert.match(timesheets, /reopen_timesheet_v2/);
  assert.match(preview, /preview_timesheet_v2/);
  assert.match(batch, /closed/);
  assert.match(batch, /alreadyClosed/);
  assert.match(batch, /needsReview/);
  assert.match(batch, /failed/);
  assert.match(reopenPreview, /reopen_timesheet_preview_v2/);
});

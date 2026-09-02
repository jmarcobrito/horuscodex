import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildApprovalInbox } from "../db/approval-inbox.ts";

test("keeps monthly approval items in pending and paginated history groups", () => {
  const inbox = buildApprovalInbox({
    from: "2026-09-01",
    to: "2026-09-30",
    page: 1,
    pageSize: 2,
    requests: [
      { id: "leave_pending", contractorId: "pj", startDate: "2026-09-29", endDate: "2026-10-02", status: "REQUESTED", requestedAt: "2026-09-20T10:00:00Z" },
      { id: "leave_outside", contractorId: "pj", startDate: "2026-10-10", endDate: "2026-10-10", status: "REQUESTED", requestedAt: "2026-09-21T10:00:00Z" },
      { id: "leave_done", contractorId: "pj", startDate: "2026-09-05", endDate: "2026-09-05", status: "APPROVED", requestedAt: "2026-09-05T10:00:00Z" },
    ],
    occurrences: [
      { id: "occ_done", contractorId: "pj", startDate: "2026-09-06", endDate: "2026-09-06", status: "REJECTED", createdAt: "2026-09-06T10:00:00Z" },
    ],
    authorizations: [
      { id: "auth_done", contractorId: "pj", workDate: "2026-09-07", status: "APPROVED", requestedAt: "2026-09-07T10:00:00Z" },
    ],
  });

  assert.deepEqual(inbox.pending.map((item) => item.id), ["leave_pending"]);
  assert.equal(inbox.history.total, 3);
  assert.equal(inbox.history.items.length, 2);
  assert.equal(inbox.history.hasNext, true);
  assert.equal(inbox.pending.some((item) => item.id === "leave_outside"), false);
});

test("dashboard reads official previews without mutating balance statuses", async () => {
  const [dashboard, types] = await Promise.all([
    readFile(new URL("../db/dashboard.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-types.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(dashboard, /refresh_hour_balance_statuses/);
  assert.match(dashboard, /preview_timesheet_v2/);
  assert.match(dashboard, /requestsQuery.*\.lte\("start_date", period\.to\).*\.gte\("end_date", period\.from\)/s);
  assert.match(dashboard, /timesheetStatus:.*"NOT_STARTED"/s);
  assert.match(types, /"NOT_STARTED"/);
  assert.match(types, /closingPreview/);
  assert.match(types, /approvalInbox/);
});

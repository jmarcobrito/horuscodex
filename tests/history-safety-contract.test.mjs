import assert from "node:assert/strict";
import test from "node:test";

import { historyBaselineSql } from "../db/history-baseline.ts";

test("history baseline is read-only and covers every protected dataset", () => {
  const sql = historyBaselineSql();
  assert.match(sql, /begin transaction read only/i);
  for (const table of ["time_entries", "time_entry_versions", "monthly_timesheets", "audit_logs"]) {
    assert.match(sql, new RegExp(`public\\.${table}`, "i"));
  }
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  assert.match(sql, /rollback/i);
});

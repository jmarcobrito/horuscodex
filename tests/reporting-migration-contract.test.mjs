import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("reporting foundation is additive and service-role only", async () => {
  const name = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
    .find(file => file.endsWith("_reporting_foundation.sql"));
  assert.ok(name);
  const sql = await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.sectors/i);
  assert.match(sql, /add column if not exists sector_id/i);
  assert.match(sql, /security_invoker\s*=\s*true/i);
  assert.match(sql, /grant select, insert, update on table public\.sectors to service_role/i);
  assert.match(sql, /revoke all on table public\.sectors from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
  for (const table of ["time_entries", "time_entry_versions", "monthly_timesheets", "hour_balance_lots", "hour_balance_transactions", "leave_requests", "occurrences", "non_business_day_authorizations", "audit_logs"]) {
    assert.doesNotMatch(sql, new RegExp(`\\b(insert into|update)\\s+public\\.${table}\\b`, "i"));
  }
});

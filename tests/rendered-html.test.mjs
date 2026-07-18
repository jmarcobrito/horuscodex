import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships protected Horus workflows backed by server data", async () => {
  const [app, views, page, actor, entries, dashboard] = await Promise.all([
    readFile(new URL("../app/HorusApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HorusViews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/actor.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/time-entries/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /initialDashboard/);
  assert.match(views, /Intervalo de datas/);
  assert.match(app, /\/api\/dashboard/);
  assert.match(app, /\/api\/time-entries/);
  assert.match(page, /getOptionalActor/);
  assert.match(page, /getDashboardData/);
  assert.match(actor, /auth_user_id/);
  assert.match(entries, /calculateWorkedMinutes/);
  assert.match(entries, /save_time_entry/);
  assert.match(entries, /changeReason/);
  assert.match(dashboard, /requireActor/);
  assert.doesNotMatch(app, /Beatriz Lima|Caio Martins|1\.284:30/);
});

test("ships metadata and all database migrations", async () => {
  const [layout, hosting, initialMigration, authMigration, workflowsMigration] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260716120000_initial_horus_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260717120000_auth_identity.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260717180000_operational_workflows.sql", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Horus — Controle de horas técnicas/);
  assert.match(layout, /og\.png/);
  assert.match(hosting, /"d1": null/);
  assert.match(initialMigration, /create table if not exists public\.time_entries/i);
  assert.match(initialMigration, /create or replace function public\.upsert_time_entry/i);
  assert.match(initialMigration, /enable row level security/i);
  assert.match(authMigration, /auth_user_id uuid/i);
  assert.match(workflowsMigration, /create table if not exists public\.occurrences/i);
  assert.match(workflowsMigration, /create or replace function public\.close_timesheet/i);
  assert.match(workflowsMigration, /create or replace function public\.decide_leave_request/i);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

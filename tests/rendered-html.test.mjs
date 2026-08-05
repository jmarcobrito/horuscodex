import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships protected Horus workflows backed by server data", async () => {
  const [app, views, page, actor, entries, dashboard, team, adminRoute, adminView, signIn, google, signInScreen] = await Promise.all([
    readFile(new URL("../app/HorusApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HorusViews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/actor.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/time-entries/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/team/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/sign-in/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/google/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SignInScreen.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /initialDashboard/);
  assert.match(views, /INTERVALO DE DATAS/);
  assert.match(views, /Voltar para o mês anterior/);
  assert.match(views, /Avançar para o próximo mês/);
  assert.match(views, /moveMonth\(-1\)/);
  assert.match(views, /moveMonth\(1\)/);
  assert.match(app, /\/api\/dashboard/);
  assert.match(app, /\/api\/time-entries/);
  assert.match(page, /getOptionalActor/);
  assert.match(page, /getDashboardData/);
  assert.match(actor, /auth_user_id/);
  assert.match(entries, /calculateWorkedMinutes/);
  assert.match(entries, /save_time_entry/);
  assert.match(entries, /changeReason/);
  assert.match(dashboard, /requireActor/);
  assert.match(dashboard, /resolveViewActor/);
  assert.match(team, /admin\.auth\.admin\.createUser/);
  assert.match(team, /admin\.auth\.admin\.updateUserById/);
  assert.match(team, /CONTRACTOR_PASSWORD_SET/);
  assert.match(team, /export async function DELETE/);
  assert.match(team, /CONTRACTOR_DELETED/);
  assert.doesNotMatch(team, /signInWithOtp/);
  assert.match(signIn, /signInWithPassword/);
  assert.doesNotMatch(signIn, /signInWithOtp/);
  assert.match(google, /signInWithOAuth/);
  assert.match(google, /provider:\s*"google"/);
  assert.match(signInScreen, /Continuar com Google/);
  assert.match(signInScreen, /type="password"/);
  assert.match(app, /result\.message \|\| success/);
  assert.match(app, /Cadastrar prestador/);
  assert.match(app, /Definir senha/);
  assert.match(app, /Excluir permanentemente/);
  assert.match(views, /onDelete/);
  assert.match(views, />Excluir</);
  assert.match(actor, /"DEV"/);
  assert.match(actor, /resolveViewActor/);
  assert.match(app, /MODO DEV/);
  assert.match(app, /somente leitura/);
  assert.match(app, /Administração/);
  assert.match(adminRoute, /actor\.role !== "DEV"/);
  assert.match(adminRoute, /USER_ROLE_CHANGED/);
  assert.match(adminRoute, /USER_STATUS_CHANGED/);
  assert.match(adminView, /Visualizar como/);
  assert.match(adminView, /Este perfil não pode ser rebaixado/);
  assert.doesNotMatch(app, /Beatriz Lima|Caio Martins|1\.284:30/);
});

test("ships metadata and all database migrations", async () => {
  const [layout, hosting, initialMigration, authMigration, workflowsMigration, devMigration] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260716120000_initial_horus_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260717120000_auth_identity.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260717180000_operational_workflows.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260805130000_dev_administration.sql", import.meta.url), "utf8"),
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
  assert.match(devMigration, /'DEV'/);
  assert.match(devMigration, /britojoaomarco@gmail\.com/i);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

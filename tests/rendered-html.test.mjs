import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";

const views = async () => (await runnerImport("./app/HorusViews.tsx", { configFile: false, envDir: false })).module;
const renderView = (view, data, extra = {}) => renderToStaticMarkup(createElement(view, { data, onNavigate() {}, onNew() {}, onEdit() {}, onStatus() {}, onSetPassword() {}, ...extra }));
const plain = html => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("partial-period dashboard separates empty daily totals from complete monthly credits", async () => {
  const { Overview } = await views();
  const data = makeWorkflowDashboard();
  data.period = { from: "2026-08-10", to: "2026-08-10", year: null, month: null };
  data.entries = [];
  data.metrics.workedMinutes = 0;
  data.metrics.requiredMinutes = 600;
  data.monthlyTimesheets = [{ ...data.monthlyTimesheets[0], status: "CLOSED", creditedMinutes: 480, consideredMinutes: 900 }];
  data.timesheet = { ...data.timesheet, workedMinutes: 0, consideredMinutes: 480, projectedBalanceMinutes: -120 };
  const html = renderView(Overview, data);
  const text = plain(html);
  assert.match(text, /HORAS TRABALHADAS 00:00/);
  assert.match(text, /Consideradas nos lançamentos: 00:00/);
  assert.match(text, /Contexto dos meses consultados/);
  assert.match(text, /valores mensais completos, sem rateio/i);
  assert.match(text, /Abonos dos meses 08:00/);
  assert.match(text, /Projeção dos meses \+05:00/);
  assert.doesNotMatch(text, /−02:00|100%|Preenchimento/);
  assert.match(text, /Consulte um mês completo/);
});

test("unavailable monthly context is explicit rather than a zero or hybrid monthly result", async () => {
  const { Overview } = await views();
  const data = makeWorkflowDashboard();
  data.period.to = "2026-08-15";
  data.monthlyTimesheets = undefined;
  const text = plain(renderView(Overview, data));
  assert.match(text, /Contexto mensal indisponível/);
  assert.doesNotMatch(text, /Abonos dos meses|Projeção dos meses/);
});

test("dashboard and people distinguish recorded days from the monthly hours ratio", async () => {
  const { Overview, TeamView } = await views();
  const data = makeWorkflowDashboard();
  data.entries.push({ ...data.entries[0], id: "same-day" });
  for (const view of [Overview, TeamView]) {
    const html = renderView(view, data);
    assert.match(plain(html), /Dias com lançamento/);
    assert.match(plain(html), /Horas em relação à carga mensal/);
    assert.match(plain(html), /100\s*%/);
    data.period.to = "2026-08-15";
    const partial = plain(renderView(view, data));
    assert.match(partial, /Consulte um mês completo/);
    assert.doesNotMatch(partial, /100\s*%/);
    data.period.to = "2026-08-31";
  }
});

test("bank and dashboard display free credit separately from reserved credit and deficit", async () => {
  const { Overview, BalanceView } = await views();
  const data = makeWorkflowDashboard();
  data.balanceLots = [{ id: "credit", contractorId: "person-1", contractorName: "Pessoa fictícia",
    type: "CREDIT", originalMinutes: 600, remainingMinutes: 600, reservedMinutes: 480,
    originDate: "2026-08-31", deadlineDate: "2099-12-31", status: "RESERVED" }];
  data.metrics.positiveBalanceMinutes = 600;
  data.metrics.negativeBalanceMinutes = 60;
  const before = structuredClone(data);
  const bank = plain(renderView(BalanceView, data));
  assert.match(bank, /Disponível para usar 02:00/);
  assert.match(bank, /Créditos válidos 10:00/);
  assert.match(bank, /Reservado para folgas 08:00/);
  assert.match(bank, /Déficits pendentes 01:00/);
  assert.match(bank, /Saldo atual do banco; não é uma posição histórica do mês selecionado/);
  const overview = plain(renderView(Overview, data));
  assert.match(overview, /DISPONÍVEL PARA USAR 02:00/);
  assert.match(overview, /Saldo atual do banco; não é uma posição histórica do mês selecionado/);
  assert.deepEqual(data, before);
});

test("ships protected Horus workflows backed by server data", async () => {
  const [app, page, actor, entries, dashboard, team, adminRoute, adminView, administrationView, sectorsPanel, selectMenu, signIn, google, signInScreen] = await Promise.all([
    readFile(new URL("../app/HorusApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/actor.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/time-entries/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/team/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AdministrationView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SectorsPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SelectMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/sign-in/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/google/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SignInScreen.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /initialDashboard/);
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
  assert.doesNotMatch(team, /signInWithOtp/);
  assert.match(signIn, /signInWithPassword/);
  assert.doesNotMatch(signIn, /signInWithOtp/);
  assert.match(google, /signInWithOAuth/);
  assert.match(google, /provider:\s*"google"/);
  assert.match(signInScreen, /Continuar com Google/);
  assert.match(signInScreen, /type="password"/);
  assert.match(app, /result\.message \|\| success/);
  assert.match(app, /Cadastrar colaborador/);
  assert.doesNotMatch(app, /prestador/i);
  assert.match(app, /Definir senha/);
  assert.match(actor, /"DEV"/);
  assert.match(actor, /resolveViewActor/);
  assert.match(app, /MODO DEV/);
  assert.match(app, /Administração/);
  assert.match(app, /\/api\/sectors/);
  assert.match(app, /SET_SECTOR/);
  assert.match(adminRoute, /actor\.role !== "DEV"/);
  assert.match(adminRoute, /USER_ROLE_CHANGED/);
  assert.match(adminRoute, /USER_STATUS_CHANGED/);
  assert.match(adminView, /Visualizar como/);
  assert.match(adminView, /Este perfil não pode ser rebaixado/);
  assert.match(administrationView, /Configurar políticas/);
  assert.match(sectorsPanel, /Novo setor/);
  assert.doesNotMatch(sectorsPanel, /Excluir setor/);
  assert.match(selectMenu, /role="listbox"/);
  assert.match(selectMenu, /aria-selected/);
  assert.doesNotMatch(app, /<select/);
  assert.doesNotMatch(adminView, /<select/);
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

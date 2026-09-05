import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";

const options = { configFile: false, envDir: false };
const period = { from: "2026-09-01", to: "2026-09-30", year: 2026, month: 9 };

function report(kind, overrides = {}) {
  const filters = { kind, from: period.from, to: period.to, personId: null, sectorId: null, category: null, actorId: null, page: 1, pageSize: 50 };
  return {
    kind, timezone: "America/Sao_Paulo", filters, columns: [], rows: [], summary: {},
    options: {
      people: [{ value: "person-1", label: "Ana Exemplo", description: "Ativo" }],
      sectors: [{ value: "UNASSIGNED", label: "Sem setor definido" }],
      actors: [{ value: "rh-1", label: "João RH", description: "Ativo" }],
      categories: [{ value: "entries", label: "Lançamentos" }],
    },
    pagination: { page: 1, pageSize: 50, total: 0, pageCount: 0 },
    ...overrides,
  };
}

test("report center renders natural accessible navigation, filters, exports and loading", async () => {
  const { module: view } = await runnerImport("./app/reports/ReportsView.tsx", options);
  const html = renderToStaticMarkup(createElement(view.ReportsView, {
    period, onPeriodChange() {}, request: async () => new Promise(() => {}), isDev: false,
  }));
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
  assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 1);
  for (const label of [
    "Lançamentos de horas", "Banco de horas", "Histórico de alterações",
    "Pessoa", "Setor", "Tipo", "Excel — relatório atual", "Excel — pacote completo",
    "CSV — relatório atual", "PDF — resumo", "Carregando relatório…",
  ]) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /TIME_ENTRY_CREATED|TimeEntry|>Auditoria</);
});

test("table renders only server columns, natural paging and DEV-only technical details", async () => {
  const { module: table } = await runnerImport("./app/reports/ReportTable.tsx", options);
  const history = report("history", {
    columns: [
      { key: "createdAt", label: "Data" }, { key: "actorName", label: "Responsável" },
      { key: "action", label: "Ação" }, { key: "technical", label: "Dados técnicos", technical: true },
    ],
    rows: [{
      id: "event-1", createdAt: "2026-09-04T12:30:00Z", actorId: "rh-1", actorName: "João RH",
      action: "Criou um lançamento de horas", affectedPersonId: "person-1", affectedPersonName: "Ana Exemplo",
      relatedRecord: "Lançamento de 04/09/2026 — Ana Exemplo", reason: "Ajuste conferido",
      technical: { actionCode: "TIME_ENTRY_CREATED", entityType: "TimeEntry", entityId: "entry-1" },
    }],
    summary: { events: 1, affectedPeople: 1 },
    pagination: { page: 2, pageSize: 50, total: 125, pageCount: 3 },
  });
  const regular = renderToStaticMarkup(createElement(table.ReportTable, { report: history, isDev: false, onPageChange() {} }));
  assert.match(regular, /Data|Responsável|Ação/);
  assert.doesNotMatch(regular, /Dados técnicos|TIME_ENTRY_CREATED|TimeEntry/);
  assert.match(regular, /Resultados 51–100 de 125/);
  assert.match(regular, /aria-label="Página anterior"/);
  assert.match(regular, /aria-label="Próxima página"/);

  const developer = renderToStaticMarkup(createElement(table.ReportTable, { report: history, isDev: true, onPageChange() {} }));
  assert.match(developer, /<details/);
  assert.match(developer, /Dados técnicos|TIME_ENTRY_CREATED|TimeEntry/);
});

test("contextual summaries use natural hour labels", async () => {
  const { module: table } = await runnerImport("./app/reports/ReportTable.tsx", options);
  const entries = report("entries", { summary: { workedMinutes: 480, consideredMinutes: 450 } });
  const balances = report("balances", { summary: { creditMinutes: 120, debitMinutes: 60, reservationMinutes: 30, utilizationMinutes: 15 } });
  const entriesHtml = renderToStaticMarkup(createElement(table.ReportTable, { report: entries, isDev: false, onPageChange() {} }));
  const balancesHtml = renderToStaticMarkup(createElement(table.ReportTable, { report: balances, isDev: false, onPageChange() {} }));
  for (const label of ["Horas trabalhadas", "Horas consideradas", "08:00", "07:30"]) assert.match(entriesHtml, new RegExp(label));
  for (const label of ["Créditos", "Débitos", "Reservas", "Utilizações"]) assert.match(balancesHtml, new RegExp(label));
  assert.doesNotMatch(entriesHtml + balancesHtml, /Não informado/);
});

test("history timestamps render in the organization timezone across midnight", async () => {
  const { module: table } = await runnerImport("./app/reports/ReportTable.tsx", options);
  const history = report("history", {
    timezone: "Pacific/Kiritimati",
    columns: [{ key: "createdAt", label: "Data e hora" }],
    rows: [{
      id: "event-midnight", createdAt: "2026-09-04T12:30:00Z", actorId: "rh-1", actorName: "João RH",
      action: "Criou um lançamento de horas", affectedPersonId: "person-1", affectedPersonName: "Ana Exemplo",
      relatedRecord: "Lançamento de 05/09/2026 — Ana Exemplo", reason: "Conferência",
      technical: { actionCode: "TIME_ENTRY_CREATED", entityType: "TimeEntry", entityId: "entry-1" },
    }],
    summary: { events: 1, affectedPeople: 1 },
    pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 },
  });
  const html = renderToStaticMarkup(createElement(table.ReportTable, { report: history, isDev: false, onPageChange() {} }));
  assert.match(html, /05\/09\/2026[^<]*02:30/);
  assert.doesNotMatch(html, /04\/09\/2026[^<]*09:30/);
});

test("actual report responses render every required operational column", async () => {
  const fixture = fileURLToPath(new URL("./helpers/read-boundary.mjs", import.meta.url));
  const [{ module: harness }, { module: table }] = await Promise.all([
    runnerImport("./tests/helpers/read-harness.ts", {
      configFile: false,
      envDir: false,
      resolve: { alias: ["./supabase", "../../../db/supabase", "../../../../db/supabase"].map(find => ({ find, replacement: fixture })) },
    }),
    runnerImport("./app/reports/ReportTable.tsx", options),
  ]);
  harness.boundary.reset();
  const actor = { id: "test-rh", authUserId: "auth-rh", organizationId: "test-org", organizationName: "Fictícia", name: "RH", email: "rh@example.com", role: "RH" };
  const base = { from: "2026-08-01", to: "2026-08-31", page: 1, pageSize: 50, personId: null, sectorId: null, category: null, actorId: null };
  const expectations = {
    entries: ["Data trabalhada", "Colaborador", "Setor", "Entrada", "Saída", "Intervalo", "Horas trabalhadas", "Horas consideradas", "Situação do dia", "Observação"],
    balances: ["Data", "Colaborador", "Setor", "Tipo de movimentação", "Crédito ou débito", "Quantidade de horas", "Origem ou descrição", "Situação relacionada"],
    history: ["Data e hora", "Quem realizou", "O que aconteceu", "Pessoa afetada", "Registro relacionado", "Motivo"],
  };
  for (const [kind, labels] of Object.entries(expectations)) {
    const response = await harness.getReportPage(actor, { ...base, kind });
    const html = renderToStaticMarkup(createElement(table.ReportTable, { report: response, isDev: false, onPageChange() {} }));
    for (const label of labels) assert.match(html, new RegExp(`>${label}<`), `${kind}: ${label}`);
  }
});

test("the old report cards are replaced at the app integration boundary", async () => {
  const [views, app] = await Promise.all([
    readFile(new URL("../app/HorusViews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HorusApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(views, /export function ReportsView|function ReportCard/);
  assert.match(app, /from "\.\/reports\/ReportsView"/);
  assert.doesNotMatch(app, /\["overview", "entries", "closing", "reports"\]/);
  assert.match(app, /<ReportsView[^>]+period=/s);
  assert.match(app, /onPeriodChange=\{changePeriod\}/);
});

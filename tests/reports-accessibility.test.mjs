import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";

const importOptions = { configFile: false, envDir: false };
const period = { from: "2026-09-01", to: "2026-09-30", year: 2026, month: 9 };

function historyReport() {
  return {
    kind: "history",
    filters: { kind: "history", from: period.from, to: period.to, personId: null, sectorId: null, category: null, actorId: null, page: 1, pageSize: 50 },
    columns: [
      { key: "createdAt", label: "Data e hora" },
      { key: "actorName", label: "Quem realizou" },
      { key: "action", label: "O que aconteceu" },
      { key: "affectedPersonName", label: "Pessoa afetada" },
      { key: "relatedRecord", label: "Registro relacionado" },
      { key: "reason", label: "Motivo" },
      { key: "technical", label: "Dados técnicos", technical: true },
    ],
    rows: [{
      id: "history-1", createdAt: "2026-09-04T12:30:00Z", actorId: "rh-1", actorName: "Marina Exemplo",
      action: "Alterou um lançamento de horas", affectedPersonId: "person-1", affectedPersonName: "Ana Exemplo",
      relatedRecord: "Lançamento de 03/09/2026 — Ana Exemplo", reason: "Correção conferida",
      technical: { actionCode: "TIME_ENTRY_UPDATED", entityType: "TimeEntry", entityId: "entry-fictitious-1" },
    }],
    summary: { events: 1, affectedPeople: 1 },
    options: { people: [], sectors: [], actors: [], categories: [] },
    pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 },
  };
}

test("report controls retain keyboard semantics, accessible names and live feedback", async () => {
  const { module: { ReportsView } } = await runnerImport("./app/reports/ReportsView.tsx", importOptions);
  const html = renderToStaticMarkup(createElement(ReportsView, {
    period, onPeriodChange() {}, request: async () => new Promise(() => {}), isDev: true,
  }));

  const tabs = html.match(/<button[^>]+role="tab"[^>]*>/g) ?? [];
  assert.equal(tabs.length, 3);
  for (const tab of tabs) {
    assert.match(tab, /type="button"/);
    assert.match(tab, /aria-controls="report-panel"/);
    assert.match(tab, /aria-selected="(?:true|false)"/);
  }
  for (const label of ["Pessoa", "Setor", "Tipo"]) assert.match(html, new RegExp(`aria-label="${label}"`));
  for (const label of ["Excel — relatório atual", "Excel — pacote completo", "CSV — relatório atual", "PDF — resumo"]) {
    assert.match(html, new RegExp(`<button[^>]+type="button"[^>]*>${label}</button>`));
  }
  assert.match(html, /role="status" aria-live="polite"/);
});

test("report table associates headers, exposes DEV details and keeps paging operable", async () => {
  const { module: { ReportTable } } = await runnerImport("./app/reports/ReportTable.tsx", importOptions);
  const html = renderToStaticMarkup(createElement(ReportTable, { report: historyReport(), isDev: true, onPageChange() {} }));

  assert.equal((html.match(/<th scope="col">/g) ?? []).length, 6);
  assert.match(html, /<details><summary>Dados técnicos<\/summary>/);
  assert.match(html, /<span aria-live="polite">Resultados 1–1 de 1<\/span>/);
  assert.match(html, /<button[^>]+type="button"[^>]+aria-label="Página anterior"/);
  assert.match(html, /<button[^>]+type="button"[^>]+aria-label="Próxima página"/);
});

test("administration tabs and sector actions remain native keyboard controls", async () => {
  const [{ module: { AdministrationView } }, { makeAdminData, makeDashboard }] = await Promise.all([
    runnerImport("./app/AdministrationView.tsx", importOptions),
    import("./fixtures/dashboard.mjs"),
  ]);
  const html = renderToStaticMarkup(createElement(AdministrationView, {
    isDev: true,
    sectors: [
      { id: "sector-product", name: "Produto", status: "ACTIVE", memberCount: 2 },
      { id: "sector-legacy", name: "Operação antiga", status: "INACTIVE", memberCount: 0 },
    ],
    adminData: makeAdminData(), policy: makeDashboard().policy, loading: false,
    onCreateSector() {}, onUpdateSector() {}, onPolicy() {}, onRole() {}, onStatus() {}, onPassword() {}, onViewAs() {},
  }));

  assert.equal((html.match(/<button[^>]+role="tab"[^>]*>/g) ?? []).length, 3);
  assert.match(html, /<button[^>]*>\+ Novo setor<\/button>/);
  for (const label of ["Renomear", "Inativar", "Reativar"]) assert.match(html, new RegExp(`<button[^>]*>${label}</button>`));
  assert.match(html, /role="status" aria-live="polite"/);
});

test("filter and export controls stay outside the table-only horizontal scroller", async () => {
  const [viewSource, tableSource, styles] = await Promise.all([
    readFile(new URL("../app/reports/ReportsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/reports/ReportTable.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(viewSource, /<ReportFilters[\s\S]*<ExportMenu[\s\S]*<ReportTable/);
  assert.doesNotMatch(viewSource, /table-scroll/);
  assert.match(tableSource, /<div className="table-scroll"><table>[\s\S]*<\/table><\/div>/);
  assert.match(styles, /\.table-scroll\s*\{[^}]*overflow-x\s*:\s*auto/);
  assert.match(styles, /body\s*\{[^}]*overflow-x\s*:\s*hidden/);
});

test("preview declares every required fictitious report state without an external fallback", async () => {
  const source = await readFile(new URL("./browser/main.tsx", import.meta.url), "utf8");

  for (const marker of [
    "createPreviewRequest", "entries", "balances", "history", "person-1", "person-2",
    "ACTIVE", "INACTIVE", "normal", "empty", "loading", "error",
    '"GET /api/reports"', '"GET /api/reports/export"', '"GET /api/sectors"',
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /startsWith\("\/api\/"\)[\s\S]*Endereço externo proibido no ensaio/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

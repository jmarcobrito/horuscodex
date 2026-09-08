import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";

const options = { configFile: false, envDir: false };
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));

test("duration presentation preserves values, zero, negatives, text and column order", async () => {
  const { module: { ReportTable } } = await runnerImport("./app/reports/ReportTable.tsx", options);
  const report = {
    kind: "balances", timezone: "America/Sao_Paulo",
    filters: { kind: "balances", from: "2026-08-01", to: "2026-08-31", personId: null, sectorId: null, category: null, actorId: null, page: 1, pageSize: 50 },
    options: { people: [], sectors: [], actors: [], categories: [] },
    columns: [{ key: "personName", label: "Colaborador" }, { key: "minutes", label: "Quantidade de horas" }, { key: "description", label: "Descrição" }],
    rows: [487, 0, -42].map((minutes, i) => ({ id: "visual-" + i, createdAt: "2026-08-01T12:00:00Z", personId: "person-1", personName: "Ana Exemplo", sectorName: "Produto", movement: "Crédito", direction: "credit", directionLabel: "Crédito", minutes, description: "Texto preservado", status: "Disponível" })),
    summary: { creditMinutes: 487, debitMinutes: 42, reservationMinutes: 0, utilizationMinutes: 0 },
    pagination: { page: 1, pageSize: 50, total: 3, pageCount: 1 },
  };
  const before = structuredClone(report);
  const html = render(ReportTable, { report, isDev: false, onPageChange() {} });
  for (const value of ["08:07", "00:00", "−00:42"]) assert.match(html, new RegExp('<td[^>]*data-numeric="true"[^>]*>' + value + '</td>'));
  assert.match(html, /<td>Ana Exemplo<\/td>/);
  assert.match(html, /<td>Texto preservado<\/td>/);
  assert.match(html, /Colaborador<\/th><th[^>]*scope="col"[^>]*data-numeric="true"[^>]*>Quantidade de horas<\/th><th[^>]*>Descrição/);
  assert.deepEqual(report, before);
});

test("period arrows use decorative icons while retaining labels and busy protection", async () => {
  const { module: { PeriodPicker } } = await runnerImport("./app/PeriodPicker.tsx", options);
  const html = render(PeriodPicker, { value: makeWorkflowDashboard().period, busy: true, allowRange: true, variant: "compact", onChange() {} });
  for (const label of ["Voltar para o mês anterior", "Avançar para o próximo mês"]) {
    assert.match(html, new RegExp('aria-label="' + label + '"[^>]*disabled=""[^>]*><svg[^>]*aria-hidden="true"'));
  }
  assert.match(html, /Outro intervalo/);
  assert.match(html, /min="2000-01" max="2200-12"/);
});

test("closed select keeps its accessible name and selected text without a text-glyph arrow", async () => {
  const { module: { SelectMenu } } = await runnerImport("./app/SelectMenu.tsx", options);
  const html = render(SelectMenu, { value: "one", options: [{ value: "one", label: "Setor fictício" }], ariaLabel: "Filtrar setor", disabled: true, onChange() {} });
  assert.match(html, /aria-label="Filtrar setor"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Setor fictício/);
  assert.match(html, /class="select-menu-chevron"[^>]*><svg[^>]*aria-hidden="true"/);
});

test("compact empty presentation preserves context and does not change other empty states", async () => {
  const { module: { Empty } } = await runnerImport("./app/HorusViews.tsx", options);
  const html = render(Empty, { text: "Nenhuma ocorrência com estes filtros.", compact: true });
  assert.match(html, /empty-state-compact/);
  assert.match(html, /Sem resultados nesta consulta/);
  assert.match(html, /Nenhuma ocorrência com estes filtros/);
  const regular = render(Empty, { text: "Outra consulta" });
  assert.doesNotMatch(regular, /empty-state-compact/);
  assert.match(regular, /Sem dados/);
});

test("pending indicator exposes zero and positive counts without changing selection or source", async () => {
  const { module: { Overview } } = await runnerImport("./app/Overview.tsx", options);
  for (const [entryStatus, expected] of [["NOT_APPLICABLE", 0], ["PENDING_AUTHORIZATION", 1]]) {
    const data = makeWorkflowDashboard();
    data.requests = []; data.occurrences = []; data.authorizations = [];
    data.entries[0].nonBusinessDayStatus = entryStatus;
    const before = structuredClone(data);
    const html = render(Overview, { data, filters: { personId: null, sectorId: null, status: "PENDING" }, busy: false, receivedAt: null, onFiltersChange() {}, onPeriodChange() {}, onRefresh() {}, onIntent() {} });
    assert.match(html, new RegExp('data-count="' + expected + '"[^>]*class="overview-status overview-status-PENDING"[^>]*aria-pressed="true"'));
    assert.deepEqual(data, before);
  }
});

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { runnerImport } from "vite";

const serverOnly = fileURLToPath(new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url));
const readBoundary = fileURLToPath(new URL("./helpers/read-boundary.mjs", import.meta.url));
const baseOptions = { configFile: false, envDir: false, resolve: { alias: [{ find: "next/dist/compiled/server-only", replacement: serverOnly }] } };
const routeOptions = {
  ...baseOptions,
  resolve: {
    alias: [
      { find: "next/dist/compiled/server-only", replacement: serverOnly },
      ...["./supabase", "./supabase-auth", "../../../db/supabase", "../../../../db/supabase", "../../../../../db/supabase"].map(find => ({ find, replacement: readBoundary })),
    ],
  },
};

const [{ module: model }, { module: csv }, { module: excel }, { module: pdf }, { module: boundaryModule }] = await Promise.all([
  runnerImport("./db/report-export-model.ts", baseOptions),
  runnerImport("./db/report-csv.ts", baseOptions),
  runnerImport("./db/report-excel.ts", baseOptions),
  runnerImport("./db/report-pdf.ts", baseOptions),
  runnerImport("./tests/helpers/read-harness.ts", routeOptions),
]);

const { buildBalanceLotsExportModel, buildExportModel, safeSpreadsheetText } = model;
const { buildCsv } = csv;
const { buildCompleteWorkbook, buildCurrentWorkbook } = excel;
const { buildSummaryPdf } = pdf;
const { boundary, reportsRoute: route } = boundaryModule;

const organization = { name: "Organização Fictícia", timezone: "America/Sao_Paulo" };
const actor = { id: "rh-1", authUserId: "auth-rh-1", organizationId: "org-1", organizationName: organization.name, name: "Renata RH", email: "renata@example.invalid", role: "RH" };
const generatedAt = new Date("2026-09-04T15:30:00.000Z");

function filters(kind, overrides = {}) {
  return { kind, from: "2026-08-01", to: "2026-08-31", personId: null, sectorId: null, category: null, actorId: null, page: 1, pageSize: 50, ...overrides };
}

function entryExportFixture(overrides = {}) {
  const reportFilters = filters("entries");
  return buildExportModel({
    organization, actor, filters: reportFilters, generatedAt,
    report: { kind: "entries", filters: reportFilters, rows: [{
      id: "entry-1", workDate: "2026-08-03", personId: "person-1", personName: "Ana Souza", sectorName: "Engenharia",
      startTime: "08:00", endTime: "17:30", breakMinutes: 60, workedMinutes: 510, consideredMinutes: 480,
      situation: "Dia útil", notes: "Entrega concluída", ...overrides,
    }] },
  });
}

function balanceExportFixture(overrides = {}) {
  const reportFilters = filters("balances");
  return buildExportModel({
    organization, actor, filters: reportFilters, generatedAt,
    report: { kind: "balances", filters: reportFilters, rows: [{
      id: "movement-1", createdAt: "2026-08-03T18:15:00.000Z", personId: "person-1", personName: "Ana Souza", sectorName: "Engenharia",
      movement: "Crédito", direction: "credit", minutes: 90, description: "Crédito do fechamento", status: "Disponível", ...overrides,
    }] },
  });
}

function lotExportFixture(overrides = {}) {
  const reportFilters = filters("balances");
  return buildBalanceLotsExportModel({
    organization, actor, filters: reportFilters, generatedAt,
    rows: [{
      id: "lot-1", personId: "person-1", personName: "Ana Souza", sectorName: "Engenharia", type: "CREDIT",
      originalMinutes: 90, remainingMinutes: 60, reservedMinutes: 30, originDate: "2026-08-03", deadlineDate: "2026-11-01", status: "AVAILABLE", ...overrides,
    }],
  });
}

function historyExportFixture(overrides = {}) {
  const reportFilters = filters("history");
  return buildExportModel({
    organization, actor, filters: reportFilters, generatedAt,
    report: { kind: "history", filters: reportFilters, rows: [{
      id: "audit-1", createdAt: "2026-08-04T12:00:00.000Z", actorId: "rh-1", actorName: "Renata RH",
      affectedPersonId: "person-1", affectedPersonName: "Ana Souza", action: "Criou um lançamento de horas",
      relatedRecord: "Lançamento de 03/08/2026 — Ana Souza", reason: "Correção solicitada",
      technical: { actionCode: "TIME_ENTRY_CREATED", entityType: "TimeEntry", entityId: "entry-1" }, ...overrides,
    }] },
  });
}

function cellValues(sheet) {
  return sheet.getSheetValues().flatMap(row => Array.isArray(row) ? row.slice(1) : []).filter(value => value !== undefined && value !== null);
}

function assertNoExecutableStrings(workbook) {
  for (const sheet of workbook.worksheets) {
    sheet.eachRow(row => row.eachCell(cell => {
      if (typeof cell.value === "string") assert.doesNotMatch(cell.value, /^[=+\-@\t\r]/, `${sheet.name}!${cell.address}`);
      assert.equal(typeof cell.value === "object" && cell.value !== null && ("formula" in cell.value || "hyperlink" in cell.value), false, `${sheet.name}!${cell.address}`);
    }));
  }
}

test("spreadsheet text neutralization covers every executable prefix", () => {
  for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) assert.equal(safeSpreadsheetText(prefix + "payload"), "'" + prefix + "payload");
  assert.equal(safeSpreadsheetText("texto normal"), "texto normal");
});

test("CSV uses natural headers, UTF-8 BOM, CRLF and neutralizes formulas", () => {
  const bytes = buildCsv(entryExportFixture({ notes: "=HYPERLINK(\"https://example.invalid\")" }));
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  assert.ok(text.startsWith("\uFEFF"));
  assert.match(text, /Data trabalhada;Colaborador;Setor/);
  assert.match(text, /03\/08\/2026;Ana Souza;Engenharia;08:00;17:30;01:00;08:30;08:00/);
  assert.match(text, /'\=HYPERLINK\(""https:\/\/example\.invalid""\)/);
  assert.ok(text.split("\r\n").length === 2);
  assert.doesNotMatch(text, /TIME_ENTRY_|TimeEntry|NOT_APPLICABLE|entry-1|person-1/);
});

test("current Excel report has exact sheets, typed values, filters and frozen headers", async () => {
  const buffer = await buildCurrentWorkbook(entryExportFixture({ id: "=entry", personId: "\tperson", personName: "+Ana", notes: "@observação" }));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ["Resumo", "Dados", "Rastreabilidade"]);
  assert.equal(workbook.properties.date1904, true);
  const data = workbook.getWorksheet("Dados");
  assert.ok(data.getCell("A2").value instanceof Date);
  assert.ok(data.getCell("F2").value instanceof Date);
  assert.ok(data.getCell("G2").value instanceof Date);
  assert.equal(data.getCell("G2").value.toISOString(), "1904-01-01T08:30:00.000Z");
  assert.equal(data.getCell("G2").numFmt, "[h]:mm;-[h]:mm");
  assert.equal(data.views[0].state, "frozen");
  assert.equal(data.autoFilter, "A1:J1");
  assert.equal(cellValues(data).some(value => value === "=entry" || value === "\tperson"), false);
  assert.match(String(workbook.getWorksheet("Rastreabilidade").getCell("A2").value), /^'=/);
  assertNoExecutableStrings(workbook);
});

test("complete Excel package opens every required sheet and preserves representative types and totals", async () => {
  const buffer = await buildCompleteWorkbook({ entries: entryExportFixture(), balances: balanceExportFixture(), lots: lotExportFixture(), history: historyExportFixture() });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ["Resumo geral", "Lançamentos", "Banco de horas", "Lotes e saldos", "Histórico de alterações", "Rastreabilidade"]);
  assert.ok(workbook.getWorksheet("Lançamentos").getCell("A2").value instanceof Date);
  assert.ok(workbook.getWorksheet("Lançamentos").getCell("G2").value instanceof Date);
  assert.ok(workbook.getWorksheet("Banco de horas").getCell("A2").value instanceof Date);
  assert.ok(workbook.getWorksheet("Banco de horas").getCell("F2").value instanceof Date);
  assert.ok(workbook.getWorksheet("Lotes e saldos").getCell("F2").value instanceof Date);
  assert.ok(workbook.getWorksheet("Histórico de alterações").getCell("A2").value instanceof Date);
  const summary = workbook.getWorksheet("Resumo geral");
  const values = cellValues(summary).map(String);
  assert.ok(values.includes("Totais por pessoa"));
  assert.ok(values.includes("Totais por setor"));
  const personRow = summary.getRows(1, summary.rowCount).find(row => row.getCell(1).value === "Ana Souza");
  assert.ok(personRow.getCell(4).value instanceof Date);
  assert.equal(personRow.getCell(4).numFmt, "[h]:mm;-[h]:mm");
  for (const name of ["Lançamentos", "Banco de horas", "Lotes e saldos", "Histórico de alterações", "Rastreabilidade"]) {
    const sheet = workbook.getWorksheet(name);
    assert.equal(sheet.views[0].state, "frozen", name);
    assert.ok(sheet.autoFilter, name);
  }
  assertNoExecutableStrings(workbook);
});

test("PDF opens, has pages and its normalized content excludes technical codes", async () => {
  const fixture = historyExportFixture();
  assert.doesNotMatch(JSON.stringify(fixture.operationalRows), /TIME_ENTRY_CREATED|TimeEntry|audit-1|entry-1|person-1/);
  const bytes = await buildSummaryPdf(fixture);
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1);
  assert.equal(document.getTitle(), "Histórico de alterações");
  const raw = Buffer.from(bytes).toString("latin1");
  assert.doesNotMatch(raw, /TIME_ENTRY_CREATED|TimeEntry|audit-1|entry-1|person-1/);
});

beforeEach(() => boundary.reset());

test("export route returns a private natural CSV without writes or mutation RPCs", async () => {
  boundary.tables.users.filter(row => row.organization_id === "test-org" && row.role === "PJ").forEach(row => { row.name = `Pessoa ${row.id.slice(-4)}`; });
  const response = await route.GET(new Request("https://horus.invalid/api/reports/export?kind=entries&from=2026-08-01&to=2026-08-31&page=1&format=csv"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(response.headers.get("content-disposition"), /^attachment; filename="horus-lancamentos-/);
  const text = await response.text();
  assert.match(text, /Data trabalhada;Colaborador;Setor/);
  assert.doesNotMatch(text, /NOT_APPLICABLE|entry-person-|person-\d{4}/);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("complete package ignores contextual type and actor while keeping common filters", async () => {
  boundary.tables.time_entries = boundary.tables.time_entries.slice(0, 1);
  boundary.tables.audit_logs = boundary.tables.audit_logs.slice(0, 1);
  boundary.tables.users = boundary.tables.users.filter(row => ["person-0000", "test-rh", "person-other-org"].includes(row.id));
  const response = await route.GET(new Request("https://horus.invalid/api/reports/export?kind=history&from=2026-08-01&to=2026-08-31&page=1&category=closing&actorId=person-0000&format=package"));
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  assert.equal(workbook.getWorksheet("Lançamentos").rowCount, 2);
  assert.equal(workbook.getWorksheet("Histórico de alterações").rowCount, 2);
  assert.equal(workbook.getWorksheet("Lotes e saldos").rowCount, 2);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("export route defaults only the format, supports the legacy kind alias and rejects unsafe requests privately", async () => {
  const legacy = await route.GET(new Request("https://horus.invalid/api/reports/export?type=entries&from=2026-08-01&to=2026-08-31"));
  assert.equal(legacy.status, 200);
  assert.equal(legacy.headers.get("content-type"), "text/csv; charset=utf-8");

  const invalid = await route.GET(new Request("https://horus.invalid/api/reports/export?kind=entries&from=2026-08-01&to=2026-08-31&format=zip"));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("cache-control"), "private, no-store");

  const reportReads = boundary.readsByTable.report_time_entries ?? 0;
  boundary.tables.users.find(row => row.id === "test-rh").role = "PJ";
  const forbidden = await route.GET(new Request("https://horus.invalid/api/reports/export?kind=entries&from=2026-08-01&to=2026-08-31&format=csv"));
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("cache-control"), "private, no-store");
  assert.equal(boundary.readsByTable.report_time_entries ?? 0, reportReads);
});

test("export route returns private 422 before generating an empty artifact", async () => {
  boundary.tables.time_entries = [];
  const response = await route.GET(new Request("https://horus.invalid/api/reports/export?kind=entries&from=2026-08-01&to=2026-08-31&format=xlsx"));
  assert.equal(response.status, 422);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match((await response.json()).error, /Nenhum registro/);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

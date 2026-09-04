import "next/headers";

import ExcelJS from "exceljs";

import type { ExportCell, ExportColumn, ExportRow, ReportExportModel } from "./report-export-model";
import { safeSpreadsheetText } from "./report-export-model";

export type CompleteWorkbookInput = {
  entries: ReportExportModel;
  balances: ReportExportModel;
  lots: ReportExportModel;
  history: ReportExportModel;
};

const DURATION_FORMAT = "[h]:mm;-[h]:mm";

function dateValue(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function timestampValue(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value ?? 0);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")));
}

function setCellValue(cell: ExcelJS.Cell, value: ExportCell | undefined, timezone: string) {
  if (!value) { cell.value = null; return; }
  if (value.type === "text") cell.value = safeSpreadsheetText(value.value);
  else if (value.type === "date") {
    cell.value = dateValue(value.value);
    cell.numFmt = "dd/mm/yyyy";
  } else if (value.type === "timestamp") {
    cell.value = timestampValue(value.value, timezone);
    cell.numFmt = "dd/mm/yyyy hh:mm";
  } else if (value.type === "duration") {
    cell.value = value.value / 1440;
    cell.numFmt = DURATION_FORMAT;
  } else cell.value = value.value;
}

function setString(cell: ExcelJS.Cell, value: string) {
  cell.value = safeSpreadsheetText(value);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16324F" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 30;
}

function addDataSheet(workbook: ExcelJS.Workbook, name: string, columns: ExportColumn[], rows: ExportRow[], timezone: string) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const header = sheet.addRow(columns.map(column => safeSpreadsheetText(column.label)));
  styleHeader(header);
  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
    sheet.getColumn(index + 1).alignment = { vertical: "top", wrapText: column.wrap ?? false };
  });
  for (const row of rows) {
    const excelRow = sheet.addRow([]);
    columns.forEach((column, index) => setCellValue(excelRow.getCell(index + 1), row[column.key], timezone));
  }
  const lastColumn = sheet.getColumn(columns.length).letter;
  sheet.autoFilter = { from: "A1", to: `${lastColumn}1` };
  return sheet;
}

function createWorkbook(model: ReportExportModel) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Horus";
  workbook.lastModifiedBy = safeSpreadsheetText(model.generatedBy);
  workbook.created = new Date(model.generatedAt.getTime());
  workbook.modified = new Date(model.generatedAt.getTime());
  workbook.properties.date1904 = true;
  return workbook;
}

function addMetadata(sheet: ExcelJS.Worksheet, model: ReportExportModel, titleLabel = "Relatório") {
  const values: [string, ExportCell][] = [
    [titleLabel, { type: "text", value: model.title }],
    ["Organização", { type: "text", value: model.organization.name }],
    ...model.filters.map(filter => [filter.label, { type: "text", value: filter.value }] as [string, ExportCell]),
    ["Gerado em", { type: "timestamp", value: model.generatedAt.toISOString() }],
    ["Gerado por", { type: "text", value: model.generatedBy }],
  ];
  for (const [label, value] of values) {
    const row = sheet.addRow([]);
    setString(row.getCell(1), label);
    setCellValue(row.getCell(2), value, model.organization.timezone);
  }
  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 52;
  sheet.getColumn(1).font = { bold: true };
}

function addCurrentSummary(workbook: ExcelJS.Workbook, model: ReportExportModel) {
  const sheet = workbook.addWorksheet("Resumo");
  addMetadata(sheet, model);
  sheet.addRow([]);
  const header = sheet.addRow(["Total", "Valor"]);
  styleHeader(header);
  for (const item of model.summaryItems) {
    const row = sheet.addRow([]);
    setString(row.getCell(1), item.label);
    setCellValue(row.getCell(2), item.value, model.organization.timezone);
  }
}

function textFrom(row: ExportRow, key: string) {
  const cell = row[key];
  return cell?.type === "text" ? cell.value : "";
}

function minutesFrom(row: ExportRow, key: string) {
  const cell = row[key];
  return cell?.type === "duration" ? cell.value : 0;
}

type Aggregate = { label: string; sector: string; entries: number; worked: number; considered: number; balance: number; movements: number };

function aggregateComplete(input: CompleteWorkbookInput, key: "person" | "sector") {
  const totals = new Map<string, Aggregate>();
  const get = (label: string, sector: string, stablePersonId: string) => {
    const mapKey = key === "person" ? stablePersonId : label;
    const current = totals.get(mapKey) ?? { label, sector: key === "person" ? sector : "", entries: 0, worked: 0, considered: 0, balance: 0, movements: 0 };
    totals.set(mapKey, current);
    return current;
  };
  input.entries.operationalRows.forEach((row, index) => {
    const person = textFrom(row, "personName"), sector = textFrom(row, "sectorName");
    const personId = textFrom(input.entries.technicalRows[index] ?? {}, "personId");
    const current = get(key === "person" ? person : sector, sector, personId ? `person:${personId}` : `entry-row:${index}`);
    current.entries += 1;
    current.worked += minutesFrom(row, "workedMinutes");
    current.considered += minutesFrom(row, "consideredMinutes");
  });
  input.balances.operationalRows.forEach((row, index) => {
    const person = textFrom(row, "personName"), sector = textFrom(row, "sectorName");
    const personId = textFrom(input.balances.technicalRows[index] ?? {}, "personId");
    const current = get(key === "person" ? person : sector, sector, personId ? `person:${personId}` : `balance-row:${index}`);
    const direction = textFrom(row, "direction");
    current.movements += 1;
    current.balance += direction === "Crédito" ? minutesFrom(row, "minutes") : direction === "Débito" ? -minutesFrom(row, "minutes") : 0;
  });
  return [...totals.values()].sort((left, right) => left.label.localeCompare(right.label, "pt-BR") || left.sector.localeCompare(right.sector, "pt-BR"));
}

function addAggregateSection(sheet: ExcelJS.Worksheet, title: string, values: Aggregate[], includeSector: boolean) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([]);
  setString(titleRow.getCell(1), title);
  titleRow.font = { bold: true, size: 13 };
  const headers = includeSector
    ? ["Pessoa", "Setor", "Lançamentos", "Horas trabalhadas", "Horas consideradas", "Saldo líquido", "Movimentações"]
    : ["Setor", "Lançamentos", "Horas trabalhadas", "Horas consideradas", "Saldo líquido", "Movimentações"];
  const header = sheet.addRow(headers.map(safeSpreadsheetText));
  styleHeader(header);
  for (const value of values) {
    const row = sheet.addRow([]);
    let column = 1;
    setString(row.getCell(column++), value.label);
    if (includeSector) setString(row.getCell(column++), value.sector);
    row.getCell(column++).value = value.entries;
    for (const minutes of [value.worked, value.considered, value.balance]) {
      row.getCell(column).value = minutes / 1440;
      row.getCell(column++).numFmt = DURATION_FORMAT;
    }
    row.getCell(column).value = value.movements;
  }
}

function addCompleteSummary(workbook: ExcelJS.Workbook, input: CompleteWorkbookInput) {
  const sheet = workbook.addWorksheet("Resumo geral");
  addMetadata(sheet, input.entries, "Pacote");
  addAggregateSection(sheet, "Totais por pessoa", aggregateComplete(input, "person"), true);
  addAggregateSection(sheet, "Totais por setor", aggregateComplete(input, "sector"), false);
  const widths = [30, 24, 15, 20, 21, 17, 16];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
}

function combinedTraceability(input: CompleteWorkbookInput) {
  const columns: ExportColumn[] = [
    { key: "dataset", label: "Conjunto", width: 26 }, { key: "recordId", label: "ID do registro", width: 30 },
    { key: "personId", label: "ID da pessoa", width: 30 }, { key: "actorId", label: "ID do responsável", width: 30 },
    { key: "actionCode", label: "Código da ação", width: 34 }, { key: "entityType", label: "Tipo da entidade", width: 28 },
    { key: "entityId", label: "ID da entidade", width: 30 }, { key: "typeCode", label: "Código do tipo", width: 24 },
    { key: "statusCode", label: "Código da situação", width: 30 },
  ];
  const sources: [string, ReportExportModel][] = [
    ["Lançamentos", input.entries], ["Banco de horas", input.balances], ["Lotes e saldos", input.lots], ["Histórico de alterações", input.history],
  ];
  const rows = sources.flatMap(([name, model]) => model.technicalRows.map(row => ({ dataset: { type: "text", value: name } as ExportCell, ...row })));
  return { columns, rows };
}

async function workbookBytes(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function buildCurrentWorkbook(model: ReportExportModel) {
  const workbook = createWorkbook(model);
  addCurrentSummary(workbook, model);
  addDataSheet(workbook, "Dados", model.operationalColumns, model.operationalRows, model.organization.timezone);
  addDataSheet(workbook, "Rastreabilidade", model.technicalColumns, model.technicalRows, model.organization.timezone);
  return workbookBytes(workbook);
}

export async function buildCompleteWorkbook(input: CompleteWorkbookInput) {
  const workbook = createWorkbook(input.entries);
  addCompleteSummary(workbook, input);
  addDataSheet(workbook, "Lançamentos", input.entries.operationalColumns, input.entries.operationalRows, input.entries.organization.timezone);
  addDataSheet(workbook, "Banco de horas", input.balances.operationalColumns, input.balances.operationalRows, input.entries.organization.timezone);
  addDataSheet(workbook, "Lotes e saldos", input.lots.operationalColumns, input.lots.operationalRows, input.entries.organization.timezone);
  addDataSheet(workbook, "Histórico de alterações", input.history.operationalColumns, input.history.operationalRows, input.entries.organization.timezone);
  const trace = combinedTraceability(input);
  addDataSheet(workbook, "Rastreabilidade", trace.columns, trace.rows, input.entries.organization.timezone);
  return workbookBytes(workbook);
}

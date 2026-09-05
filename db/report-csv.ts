import type { ExportCell, ReportExportModel } from "./report-export-model";
import { safeSpreadsheetText } from "./report-export-model";

function displayDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function displayTimestamp(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

function displayDuration(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function displayCell(cell: ExportCell, timezone: string) {
  if (cell.type === "date") return displayDate(cell.value);
  if (cell.type === "timestamp") return displayTimestamp(cell.value, timezone);
  if (cell.type === "duration") return displayDuration(cell.value);
  return String(cell.value);
}

function csvCell(value: string) {
  const content = safeSpreadsheetText(value);
  return /[;"\n\r]/.test(content) ? `"${content.replaceAll('"', '""')}"` : content;
}

export function buildCsv(model: ReportExportModel) {
  const rows = [
    model.operationalColumns.map(column => column.label),
    ...model.operationalRows.map(row => model.operationalColumns.map(column => displayCell(row[column.key], model.organization.timezone))),
  ];
  return new TextEncoder().encode("\uFEFF" + rows.map(row => row.map(value => csvCell(value)).join(";")).join("\r\n"));
}

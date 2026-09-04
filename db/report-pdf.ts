import "next/headers";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { ExportCell, ReportExportModel } from "./report-export-model";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function displayTimestamp(value: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(typeof value === "string" ? new Date(value) : value).replace(",", "");
}

function displayCell(cell: ExportCell, timezone: string) {
  if (cell.type === "duration") {
    const sign = cell.value < 0 ? "-" : "";
    const absolute = Math.abs(cell.value);
    return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  }
  if (cell.type === "timestamp") return displayTimestamp(cell.value, timezone);
  if (cell.type === "date") {
    const [year, month, day] = cell.value.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return String(cell.value);
}

function splitWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  const parts: string[] = [];
  let current = "";
  for (const character of word) {
    if (current && font.widthOfTextAtSize(current + character, size) > maxWidth) {
      parts.push(current);
      current = character;
    } else current += character;
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth = TEXT_WIDTH) {
  const words = value.trim().split(/\s+/).filter(Boolean).flatMap(word => font.widthOfTextAtSize(word, size) > maxWidth ? splitWord(word, font, size, maxWidth) : [word]);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else { lines.push(current); current = word; }
  }
  lines.push(current);
  return lines;
}

export async function buildSummaryPdf(model: ReportExportModel) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  document.setTitle(model.title);
  document.setAuthor(model.organization.name);
  document.setSubject("Resumo de relatório do Horus");
  document.setCreator("Horus");
  document.setProducer("Horus");
  document.setCreationDate(new Date(model.generatedAt.getTime()));
  document.setModificationDate(new Date(model.generatedAt.getTime()));

  let page: PDFPage;
  let y: number;
  const newPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText("HORUS", { x: MARGIN, y: PAGE_HEIGHT - 42, size: 10, font: bold, color: rgb(0.08, 0.2, 0.31) });
    page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 49 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 49 }, thickness: 1, color: rgb(0.75, 0.79, 0.82) });
    y = PAGE_HEIGHT - 78;
  };
  const ensure = (height: number) => { if (y - height < 58) newPage(); };
  const drawLines = (lines: string[], options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = options.size ?? 10;
    const lineHeight = size + (options.gap ?? 4);
    ensure(lines.length * lineHeight);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size, font: options.font ?? regular, color: options.color ?? rgb(0.12, 0.15, 0.18) });
      y -= lineHeight;
    }
  };
  const paragraph = (value: string, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const font = options.font ?? regular, size = options.size ?? 10;
    drawLines(wrapText(value, font, size), { ...options, font, size });
  };
  const section = (title: string) => {
    ensure(32);
    y -= 8;
    paragraph(title, { font: bold, size: 12, color: rgb(0.08, 0.2, 0.31), gap: 5 });
  };

  newPage();
  paragraph(model.title, { font: bold, size: 20, color: rgb(0.08, 0.2, 0.31), gap: 7 });
  paragraph(model.organization.name, { font: bold, size: 11 });
  paragraph(`Gerado em ${displayTimestamp(model.generatedAt, model.organization.timezone)} por ${model.generatedBy}`, { size: 9, color: rgb(0.35, 0.4, 0.45) });

  section("Filtros aplicados");
  for (const filter of model.filters) paragraph(`${filter.label}: ${filter.value}`);

  section("Totais");
  for (const item of model.summaryItems) paragraph(`${item.label}: ${displayCell(item.value, model.organization.timezone)}`);

  for (const grouping of model.groupings) {
    section(grouping.title);
    if (!grouping.items.length) paragraph("Nenhum agrupamento disponível.", { color: rgb(0.35, 0.4, 0.45) });
    for (const item of grouping.items) paragraph(`${item.label}: ${item.detail}`);
  }

  const pages = document.getPages();
  pages.forEach((item, index) => {
    const label = `Página ${index + 1} de ${pages.length}`;
    const width = regular.widthOfTextAtSize(label, 8);
    item.drawLine({ start: { x: MARGIN, y: 43 }, end: { x: PAGE_WIDTH - MARGIN, y: 43 }, thickness: 0.5, color: rgb(0.75, 0.79, 0.82) });
    item.drawText(label, { x: PAGE_WIDTH - MARGIN - width, y: 28, size: 8, font: regular, color: rgb(0.35, 0.4, 0.45) });
  });

  return document.save({ useObjectStreams: false });
}

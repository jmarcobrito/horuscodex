import type { HorusActor } from "./actor";
import type { BalanceReportRow, EntryReportRow, HistoryReportRow, ReportFilters, ReportKind, ReportOptions, ReportRow } from "../app/reports/report-types";
import { balanceLotStatusLabel, balanceMovementLabel, reportCategoryLabel } from "../app/reports/report-language";

export type ExportCell =
  | { type: "text" | "date" | "timestamp"; value: string }
  | { type: "duration" | "number"; value: number };

export type ExportColumn = { key: string; label: string; width: number; wrap?: boolean };
export type ExportRow = Record<string, ExportCell>;
export type ExportSummaryItem = { label: string; value: ExportCell };
export type ExportGrouping = { title: string; items: { label: string; detail: string }[] };
export type ExportOrganization = { name: string; timezone: string };

export type ReportExportModel = {
  kind: ReportKind | "lots";
  title: string;
  organization: ExportOrganization;
  generatedAt: Date;
  generatedBy: string;
  filters: { label: string; value: string }[];
  summaryItems: ExportSummaryItem[];
  groupings: ExportGrouping[];
  operationalColumns: ExportColumn[];
  operationalRows: ExportRow[];
  technicalColumns: ExportColumn[];
  technicalRows: ExportRow[];
};

type MinimalReport = { kind: ReportKind; rows: ReportRow[]; filters?: ReportFilters; options?: ReportOptions };
type BuildExportInput = { organization: ExportOrganization; actor: HorusActor; filters: ReportFilters; report: MinimalReport; generatedAt: Date };

export type BalanceLotExportRow = {
  id: string;
  personId: string;
  personName: string;
  sectorName: string;
  type: string;
  originalMinutes: number;
  remainingMinutes: number;
  reservedMinutes: number;
  originDate: string;
  deadlineDate: string;
  status: string;
};

type BuildLotInput = Omit<BuildExportInput, "report"> & { rows: BalanceLotExportRow[] };

const text = (value: string): ExportCell => ({ type: "text", value });
const date = (value: string): ExportCell => ({ type: "date", value });
const timestamp = (value: string): ExportCell => ({ type: "timestamp", value });
const duration = (value: number): ExportCell => ({ type: "duration", value });
const number = (value: number): ExportCell => ({ type: "number", value });

export function safeSpreadsheetText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function naturalDirection(direction: BalanceReportRow["direction"]) {
  return ({ credit: "Crédito", debit: "Débito", reservation: "Reserva", release: "Liberação", neutral: "Neutro" } as const)[direction];
}

function signedBalanceMinutes(rows: BalanceReportRow[]) {
  return rows.reduce((total, row) => total + (row.direction === "credit" ? row.minutes : row.direction === "debit" ? -row.minutes : 0), 0);
}

function optionLabel(options: ReportOptions | undefined, group: "people" | "sectors" | "actors", value: string | null) {
  if (!value) return null;
  return options?.[group].find(option => option.value === value)?.label ?? null;
}

function affectedPersonName(row: ReportRow) {
  return "affectedPersonName" in row ? row.affectedPersonName : row.personName;
}

function sectorName(row: ReportRow) {
  return "sectorName" in row ? row.sectorName : "Setor não identificado";
}

function filterLabels(filters: ReportFilters, report: MinimalReport) {
  const first = report.rows[0];
  const person = optionLabel(report.options, "people", filters.personId)
    ?? (filters.personId && first ? affectedPersonName(first) : filters.personId ? "Pessoa selecionada" : "Todas as pessoas");
  const sector = filters.sectorId === "UNASSIGNED"
    ? "Sem setor definido"
    : optionLabel(report.options, "sectors", filters.sectorId)
      ?? (filters.sectorId && first ? sectorName(first) : filters.sectorId ? "Setor selecionado" : "Todos os setores");
  const result = [
    { label: "Período", value: `${formatDate(filters.from)} a ${formatDate(filters.to)}` },
    { label: "Pessoa", value: person },
    { label: "Setor", value: sector },
    { label: "Tipo", value: filters.category ? reportCategoryLabel(filters.kind, filters.category) : "Todos os tipos" },
  ];
  if (filters.kind === "history") {
    result.push({
      label: "Quem realizou a ação",
      value: optionLabel(report.options, "actors", filters.actorId)
        ?? (filters.actorId && first && "actorName" in first ? first.actorName : filters.actorId ? "Responsável selecionado" : "Todos os responsáveis"),
    });
  }
  return result;
}

function grouping(rows: ReportRow[], title: string, label: (row: ReportRow) => string, minutes?: (row: ReportRow) => number) {
  const totals = new Map<string, { count: number; minutes: number }>();
  for (const row of rows) {
    const key = label(row);
    const current = totals.get(key) ?? { count: 0, minutes: 0 };
    current.count += 1;
    current.minutes += minutes?.(row) ?? 0;
    totals.set(key, current);
  }
  const values = [...totals].sort(([left], [right]) => left.localeCompare(right, "pt-BR"));
  const visible = values.slice(0, 10).map(([labelValue, value]) => ({
    label: labelValue,
    detail: minutes ? `${value.count} registro(s), ${formatSignedMinutes(value.minutes)}` : `${value.count} registro(s)`,
  }));
  if (values.length > visible.length) visible.push({ label: "Outros grupos", detail: `${values.length - visible.length} grupo(s)` });
  return { title, items: visible };
}

export function formatSignedMinutes(value: number) {
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  const absolute = Math.abs(value);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function entryModel(input: BuildExportInput): Pick<ReportExportModel, "title" | "summaryItems" | "groupings" | "operationalColumns" | "operationalRows" | "technicalColumns" | "technicalRows"> {
  const rows = input.report.rows as EntryReportRow[];
  return {
    title: "Lançamentos de horas",
    summaryItems: [
      { label: "Lançamentos", value: number(rows.length) },
      { label: "Horas trabalhadas", value: duration(rows.reduce((total, row) => total + row.workedMinutes, 0)) },
      { label: "Horas consideradas", value: duration(rows.reduce((total, row) => total + row.consideredMinutes, 0)) },
    ],
    groupings: [grouping(rows, "Por pessoa", row => affectedPersonName(row), row => (row as EntryReportRow).consideredMinutes), grouping(rows, "Por setor", row => sectorName(row), row => (row as EntryReportRow).consideredMinutes)],
    operationalColumns: [
      { key: "workDate", label: "Data trabalhada", width: 15 }, { key: "personName", label: "Colaborador", width: 28 },
      { key: "sectorName", label: "Setor", width: 24 }, { key: "startTime", label: "Entrada", width: 12 },
      { key: "endTime", label: "Saída", width: 12 }, { key: "breakMinutes", label: "Intervalo", width: 14 },
      { key: "workedMinutes", label: "Horas trabalhadas", width: 18 }, { key: "consideredMinutes", label: "Horas consideradas", width: 19 },
      { key: "situation", label: "Situação", width: 24 }, { key: "notes", label: "Observação", width: 42, wrap: true },
    ],
    operationalRows: rows.map(row => ({
      workDate: date(row.workDate), personName: text(row.personName), sectorName: text(row.sectorName), startTime: text(row.startTime), endTime: text(row.endTime),
      breakMinutes: duration(row.breakMinutes), workedMinutes: duration(row.workedMinutes), consideredMinutes: duration(row.consideredMinutes), situation: text(row.situation), notes: text(row.notes),
    })),
    technicalColumns: [{ key: "recordId", label: "ID do lançamento", width: 30 }, { key: "personId", label: "ID do colaborador", width: 30 }],
    technicalRows: rows.map(row => ({ recordId: text(row.id), personId: text(row.personId) })),
  };
}

function balanceModel(input: BuildExportInput): Pick<ReportExportModel, "title" | "summaryItems" | "groupings" | "operationalColumns" | "operationalRows" | "technicalColumns" | "technicalRows"> {
  const rows = input.report.rows as BalanceReportRow[];
  const total = (direction: BalanceReportRow["direction"]) => rows.filter(row => row.direction === direction).reduce((sum, row) => sum + row.minutes, 0);
  return {
    title: "Banco de horas",
    summaryItems: [
      { label: "Movimentações", value: number(rows.length) }, { label: "Saldo líquido", value: duration(signedBalanceMinutes(rows)) },
      { label: "Créditos", value: duration(total("credit")) }, { label: "Débitos", value: duration(total("debit")) },
      { label: "Reservas", value: duration(total("reservation")) }, { label: "Liberações", value: duration(total("release")) },
    ],
    groupings: [grouping(rows, "Por pessoa", row => affectedPersonName(row), row => {
      const balance = row as BalanceReportRow;
      return balance.direction === "credit" ? balance.minutes : balance.direction === "debit" ? -balance.minutes : 0;
    }), grouping(rows, "Por setor", row => sectorName(row), row => {
      const balance = row as BalanceReportRow;
      return balance.direction === "credit" ? balance.minutes : balance.direction === "debit" ? -balance.minutes : 0;
    })],
    operationalColumns: [
      { key: "createdAt", label: "Data e hora", width: 21 }, { key: "personName", label: "Colaborador", width: 28 },
      { key: "sectorName", label: "Setor", width: 24 }, { key: "movement", label: "Movimentação", width: 18 },
      { key: "direction", label: "Direção", width: 14 }, { key: "minutes", label: "Duração", width: 15 },
      { key: "description", label: "Descrição", width: 42, wrap: true }, { key: "status", label: "Situação", width: 24 },
    ],
    operationalRows: rows.map(row => ({
      createdAt: timestamp(row.createdAt), personName: text(row.personName), sectorName: text(row.sectorName), movement: text(row.movement),
      direction: text(naturalDirection(row.direction)), minutes: duration(row.minutes), description: text(row.description), status: text(row.status),
    })),
    technicalColumns: [{ key: "recordId", label: "ID da movimentação", width: 30 }, { key: "personId", label: "ID do colaborador", width: 30 }],
    technicalRows: rows.map(row => ({ recordId: text(row.id), personId: text(row.personId) })),
  };
}

function historyModel(input: BuildExportInput): Pick<ReportExportModel, "title" | "summaryItems" | "groupings" | "operationalColumns" | "operationalRows" | "technicalColumns" | "technicalRows"> {
  const rows = input.report.rows as HistoryReportRow[];
  return {
    title: "Histórico de alterações",
    summaryItems: [{ label: "Alterações", value: number(rows.length) }, { label: "Pessoas afetadas", value: number(new Set(rows.map(row => row.affectedPersonId).filter(Boolean)).size) }],
    groupings: [grouping(rows, "Por responsável", row => (row as HistoryReportRow).actorName), grouping(rows, "Por pessoa afetada", row => affectedPersonName(row))],
    operationalColumns: [
      { key: "createdAt", label: "Data e hora", width: 21 }, { key: "actorName", label: "Responsável", width: 28 },
      { key: "affectedPersonName", label: "Pessoa afetada", width: 28 }, { key: "relatedRecord", label: "Registro relacionado", width: 38, wrap: true },
      { key: "action", label: "Ação", width: 38, wrap: true }, { key: "reason", label: "Justificativa", width: 42, wrap: true },
    ],
    operationalRows: rows.map(row => ({
      createdAt: timestamp(row.createdAt), actorName: text(row.actorName), affectedPersonName: text(row.affectedPersonName), relatedRecord: text(row.relatedRecord), action: text(row.action), reason: text(row.reason),
    })),
    technicalColumns: [
      { key: "recordId", label: "ID do evento", width: 30 }, { key: "actorId", label: "ID do responsável", width: 30 },
      { key: "personId", label: "ID da pessoa afetada", width: 30 }, { key: "actionCode", label: "Código da ação", width: 34 },
      { key: "entityType", label: "Tipo da entidade", width: 28 }, { key: "entityId", label: "ID da entidade", width: 30 },
    ],
    technicalRows: rows.map(row => ({
      recordId: text(row.id), actorId: text(row.actorId), personId: text(row.affectedPersonId ?? ""), actionCode: text(row.technical.actionCode), entityType: text(row.technical.entityType), entityId: text(row.technical.entityId),
    })),
  };
}

export function buildExportModel(input: BuildExportInput): ReportExportModel {
  if (input.report.kind !== input.filters.kind) throw new Error("Report kind does not match export filters");
  const content = input.report.kind === "entries" ? entryModel(input) : input.report.kind === "balances" ? balanceModel(input) : historyModel(input);
  return {
    kind: input.report.kind,
    organization: { ...input.organization },
    generatedAt: new Date(input.generatedAt),
    generatedBy: input.actor.name,
    filters: filterLabels(input.filters, input.report),
    ...content,
  };
}

export function buildBalanceLotsExportModel(input: BuildLotInput): ReportExportModel {
  const fakeReport: MinimalReport = { kind: "balances", rows: [] };
  return {
    kind: "lots",
    title: "Lotes e saldos",
    organization: { ...input.organization }, generatedAt: new Date(input.generatedAt), generatedBy: input.actor.name,
    filters: filterLabels(input.filters, fakeReport),
    summaryItems: [
      { label: "Lotes", value: number(input.rows.length) },
      { label: "Saldo original", value: duration(input.rows.reduce((total, row) => total + row.originalMinutes, 0)) },
      { label: "Saldo restante", value: duration(input.rows.reduce((total, row) => total + row.remainingMinutes, 0)) },
      { label: "Saldo reservado", value: duration(input.rows.reduce((total, row) => total + row.reservedMinutes, 0)) },
    ],
    groupings: [],
    operationalColumns: [
      { key: "personName", label: "Colaborador", width: 28 }, { key: "sectorName", label: "Setor", width: 24 },
      { key: "type", label: "Tipo", width: 16 }, { key: "originalMinutes", label: "Saldo original", width: 17 },
      { key: "remainingMinutes", label: "Saldo restante", width: 17 }, { key: "originDate", label: "Origem", width: 15 },
      { key: "deadlineDate", label: "Prazo", width: 15 }, { key: "reservedMinutes", label: "Saldo reservado", width: 17 },
      { key: "status", label: "Situação", width: 25 },
    ],
    operationalRows: input.rows.map(row => ({
      personName: text(row.personName), sectorName: text(row.sectorName), type: text(balanceMovementLabel(row.type)),
      originalMinutes: duration(row.originalMinutes), remainingMinutes: duration(row.remainingMinutes), originDate: date(row.originDate),
      deadlineDate: date(row.deadlineDate), reservedMinutes: duration(row.reservedMinutes), status: text(balanceLotStatusLabel(row.status)),
    })),
    technicalColumns: [
      { key: "recordId", label: "ID do lote", width: 30 }, { key: "personId", label: "ID do colaborador", width: 30 },
      { key: "typeCode", label: "Código do tipo", width: 24 }, { key: "statusCode", label: "Código da situação", width: 30 },
    ],
    technicalRows: input.rows.map(row => ({ recordId: text(row.id), personId: text(row.personId), typeCode: text(row.type), statusCode: text(row.status) })),
  };
}

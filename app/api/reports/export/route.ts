import { requireActor, type HorusActor } from "../../../../db/actor";
import { apiFailure, privateJson } from "../../../../db/http";
import { ReadLimitExceededError, readAllRows } from "../../../../db/read-all";
import { buildCsv } from "../../../../db/report-csv";
import { buildCompleteWorkbook, buildCurrentWorkbook } from "../../../../db/report-excel";
import { buildBalanceLotsExportModel, buildExportModel, type BalanceLotExportRow, type ExportOrganization } from "../../../../db/report-export-model";
import { buildSummaryPdf } from "../../../../db/report-pdf";
import { getAllReportRows, getReportOptions, parseReportFilters, ReportInputError } from "../../../../db/reports";
import { getSupabaseAdmin } from "../../../../db/supabase";
import type { ReportFilters, ReportKind, ReportRow } from "../../../reports/report-types";

export const dynamic = "force-dynamic";

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  package: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

const MAX_EXPORT_ROWS = 20_000;

type ExportFormat = keyof typeof CONTENT_TYPES;
type BalanceLotViewRow = {
  id: string; person_id: string; person_name: string | null; sector_name: string | null; type: string;
  original_minutes: number; remaining_minutes: number; reserved_minutes: number; origin_date: string; deadline_date: string; status: string;
};

function one(params: URLSearchParams, key: string) {
  const values = params.getAll(key);
  if (values.length > 1) throw new ReportInputError("Filtro inválido.");
  return values[0] ?? null;
}

function exportFormat(params: URLSearchParams): ExportFormat {
  const value = one(params, "format") ?? "csv";
  if (!Object.hasOwn(CONTENT_TYPES, value)) throw new ReportInputError("Formato de exportação inválido.");
  return value as ExportFormat;
}

function normalizedFilterParams(source: URLSearchParams) {
  const params = new URLSearchParams(source);
  params.delete("format");
  const legacyType = one(params, "type");
  if (legacyType !== null) {
    if (params.has("kind")) throw new ReportInputError("Filtro inválido.");
    const kind = legacyType === "audit" ? "history" : legacyType;
    if (kind !== "entries" && kind !== "balances" && kind !== "history") throw new ReportInputError("Tipo de relatório inválido.");
    params.delete("type");
    params.set("kind", kind);
  }
  if (!params.has("page")) params.set("page", "1");
  return params;
}

function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format(); return true; }
  catch { return false; }
}

async function organizationFor(actor: HorusActor): Promise<ExportOrganization> {
  const { data, error } = await getSupabaseAdmin().from("organizations").select("name,timezone").eq("id", actor.organizationId).maybeSingle();
  if (error) throw error;
  const row = data as { name?: unknown; timezone?: unknown } | null;
  return {
    name: typeof row?.name === "string" && row.name.trim() ? row.name : actor.organizationName,
    timezone: validTimeZone(row?.timezone) ? row.timezone : "America/Sao_Paulo",
  };
}

function reportModel(actor: HorusActor, organization: ExportOrganization, filters: ReportFilters, rows: ReportRow[], generatedAt: Date) {
  return buildExportModel({ organization, actor, filters, generatedAt, report: { kind: filters.kind, filters, rows } });
}

function commonFilters(filters: ReportFilters, kind: ReportKind): ReportFilters {
  return { ...filters, kind, category: null, actorId: null, page: 1 };
}

async function validateIgnoredActor(actor: HorusActor, filters: ReportFilters) {
  if (!filters.actorId) return;
  const options = await getReportOptions(actor, "history");
  if (!options.actors.some(option => option.value === filters.actorId)) {
    throw new ReportInputError("Pessoa, setor ou responsável inválido para esta organização.");
  }
}

async function getAllBalanceLots(actor: HorusActor, filters: ReportFilters, maxRows: number): Promise<BalanceLotExportRow[]> {
  let query = getSupabaseAdmin().from("report_balance_lots").select("*", { count: "exact" })
    .eq("organization_id", actor.organizationId).gte("origin_date", filters.from).lte("origin_date", filters.to);
  if (filters.personId) query = query.eq("person_id", filters.personId);
  if (filters.sectorId === "UNASSIGNED") query = query.is("sector_id", null);
  else if (filters.sectorId) query = query.eq("sector_id", filters.sectorId);
  query = query.order("origin_date", { ascending: false }).order("id", { ascending: false });
  const rows = await readAllRows<BalanceLotViewRow>((from, to) => query.range(from, to) as never, maxRows);
  return rows.map(row => ({
    id: row.id, personId: row.person_id, personName: row.person_name ?? "Não identificado", sectorName: row.sector_name ?? "Sem setor definido",
    type: row.type, originalMinutes: row.original_minutes, remainingMinutes: row.remaining_minutes, reservedMinutes: row.reserved_minutes,
    originDate: row.origin_date, deadlineDate: row.deadline_date, status: row.status,
  }));
}

function filename(format: ExportFormat, filters: ReportFilters) {
  const current = filters.kind === "entries" ? "lancamentos" : filters.kind === "balances" ? "banco-de-horas" : "historico-de-alteracoes";
  const name = format === "package" ? "pacote-completo" : current;
  const extension = format === "package" ? "xlsx" : format;
  return `horus-${name}-${filters.from}-a-${filters.to}.${extension}`;
}

function download(bytes: Uint8Array, format: ExportFormat, filters: ReportFilters) {
  return new Response(Uint8Array.from(bytes).buffer, { headers: {
    "content-type": CONTENT_TYPES[format],
    "content-disposition": `attachment; filename="${filename(format, filters)}"`,
    "cache-control": "private, no-store",
  } });
}

function exportFailure(error: unknown) {
  if (error instanceof ReadLimitExceededError) {
    return privateJson({ error: "Este relatório ultrapassa o limite de 20.000 registros. Reduza o período ou aplique filtros e tente novamente." }, { status: 413 });
  }
  if (error instanceof ReportInputError) return privateJson({ error: error.message }, { status: 400 });
  return apiFailure(error, "report export");
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return privateJson({ error: "Apenas o RH pode exportar relatórios." }, { status: 403 });

    const url = new URL(request.url);
    const format = exportFormat(url.searchParams);
    const filters = parseReportFilters(normalizedFilterParams(url.searchParams));
    const generatedAt = new Date();

    if (format === "package") {
      await validateIgnoredActor(actor, filters);
      const entriesFilters = commonFilters(filters, "entries");
      const balancesFilters = commonFilters(filters, "balances");
      const historyFilters = commonFilters(filters, "history");
      const organization = await organizationFor(actor);
      let remaining = MAX_EXPORT_ROWS;
      const entries = await getAllReportRows(actor, entriesFilters, remaining);
      remaining -= entries.length;
      const balances = await getAllReportRows(actor, balancesFilters, remaining);
      remaining -= balances.length;
      const lots = await getAllBalanceLots(actor, balancesFilters, remaining);
      remaining -= lots.length;
      const history = await getAllReportRows(actor, historyFilters, remaining);
      if (entries.length + balances.length + lots.length + history.length === 0) {
        return privateJson({ error: "Nenhum registro encontrado com estes filtros." }, { status: 422 });
      }
      const complete = await buildCompleteWorkbook({
        entries: reportModel(actor, organization, entriesFilters, entries, generatedAt),
        balances: reportModel(actor, organization, balancesFilters, balances, generatedAt),
        lots: buildBalanceLotsExportModel({ organization, actor, filters: balancesFilters, rows: lots, generatedAt }),
        history: reportModel(actor, organization, historyFilters, history, generatedAt),
      });
      return download(complete, format, filters);
    }

    const [organization, rows] = await Promise.all([organizationFor(actor), getAllReportRows(actor, filters, MAX_EXPORT_ROWS)]);
    if (!rows.length) return privateJson({ error: "Nenhum registro encontrado com estes filtros." }, { status: 422 });
    const model = reportModel(actor, organization, filters, rows, generatedAt);
    if (format === "csv") return download(buildCsv(model), format, filters);
    if (format === "xlsx") return download(await buildCurrentWorkbook(model), format, filters);
    return download(await buildSummaryPdf(model), format, filters);
  } catch (error) {
    return exportFailure(error);
  }
}

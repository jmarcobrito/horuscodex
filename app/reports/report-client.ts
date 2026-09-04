import type { ReportFilters, ReportKind, ReportResponse } from "./report-types";

export type ReportRequest = (url: string, init?: RequestInit) => Promise<Response>;
export type ReportLoadState = {
  status: "loading" | "empty" | "error" | "ready";
  filters: ReportFilters;
  response: ReportResponse | null;
  message: string | null;
};

const FILTER_KEYS = ["kind", "from", "to", "personId", "sectorId", "category", "actorId", "page"] as const;

export function reportFilters(input: Partial<ReportFilters> = {}): ReportFilters {
  const kind = input.kind ?? "entries";
  return {
    kind,
    from: input.from ?? "",
    to: input.to ?? "",
    personId: input.personId ?? null,
    sectorId: input.sectorId ?? null,
    category: input.category ?? null,
    actorId: kind === "history" ? input.actorId ?? null : null,
    page: input.page ?? 1,
    pageSize: 50,
  };
}

export function reportQuery(filters: ReportFilters) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value !== null && value !== undefined) query.set(key, String(value));
  }
  return query;
}

export function changeReportKind(filters: ReportFilters, kind: ReportKind): ReportFilters {
  return { ...filters, kind, category: null, actorId: null, page: 1 };
}

export function changeReportFilters(filters: ReportFilters, change: Partial<Pick<ReportFilters, "personId" | "sectorId" | "category" | "actorId">>): ReportFilters {
  return { ...filters, ...change, page: 1 };
}

export function clearReportFilters(filters: ReportFilters): ReportFilters {
  return { ...filters, personId: null, sectorId: null, category: null, actorId: null, page: 1 };
}

export function reportExportUrl(filters: ReportFilters, format: "xlsx" | "package" | "csv" | "pdf") {
  const query = reportQuery(filters);
  query.set("format", format);
  return "/api/reports/export?" + query.toString();
}

const EXPORT_READY_MESSAGES = {
  xlsx: "Excel pronto para download.",
  package: "Pacote completo pronto para download.",
  csv: "CSV pronto para download.",
  pdf: "PDF pronto para download.",
} as const;

export async function requestReportExport(request: ReportRequest, filters: ReportFilters, format: keyof typeof EXPORT_READY_MESSAGES) {
  const response = await request(reportExportUrl(filters, format), { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response));
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `horus-relatorio.${format === "package" ? "xlsx" : format}`;
  return { blob: await response.blob(), filename, message: EXPORT_READY_MESSAGES[format] };
}

function sameFilters(left: ReportFilters, right: ReportFilters) {
  return FILTER_KEYS.every(key => left[key] === right[key]) && left.pageSize === right.pageSize;
}

async function responseError(response: Response) {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch { /* The status fallback remains useful for malformed failures. */ }
  return "Não foi possível carregar o relatório.";
}

export function createReportLoader(request: ReportRequest) {
  let requestId = 0;
  let abortController: AbortController | null = null;
  let state: ReportLoadState = { status: "loading", filters: reportFilters(), response: null, message: null };

  return {
    current() { return state; },
    cancel() { requestId += 1; abortController?.abort(); abortController = null; },
    async load(filters: ReportFilters) {
      const id = ++requestId;
      abortController?.abort();
      const controller = new AbortController();
      abortController = controller;
      state = { status: "loading", filters, response: null, message: null };
      try {
        const response = await request("/api/reports?" + reportQuery(filters).toString(), { cache: "no-store", signal: controller.signal });
        if (id !== requestId) return state;
        if (!response.ok) {
          state = { status: "error", filters, response: null, message: await responseError(response) };
          return state;
        }
        const report = await response.json() as ReportResponse;
        if (id !== requestId) return state;
        if (!report || !Array.isArray(report.rows) || !report.filters || !sameFilters(filters, report.filters)) {
          state = { status: "error", filters, response: null, message: "A resposta não corresponde aos filtros escolhidos." };
          return state;
        }
        state = { status: report.rows.length ? "ready" : "empty", filters, response: report, message: null };
        return state;
      } catch (error) {
        if (id !== requestId || (error instanceof DOMException && error.name === "AbortError")) return state;
        state = { status: "error", filters, response: null, message: error instanceof Error && error.message ? error.message : "Não foi possível carregar o relatório." };
        return state;
      } finally {
        if (id === requestId) abortController = null;
      }
    },
  };
}

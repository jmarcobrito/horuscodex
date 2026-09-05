import type {
  BalanceReportRow, BalanceReportSummary, EntryReportRow, EntryReportSummary, HistoryReportRow, HistoryReportSummary,
  ReportColumn, ReportFilters, ReportKind, ReportOption, ReportOptions, ReportResponse, ReportRow,
} from "../app/reports/report-types";
import { actionLabel, balanceDirectionLabel, balanceLotStatusLabel, balanceMovementLabel, entrySituationLabel, relatedRecordLabel, reportCategoryLabel } from "../app/reports/report-language";
import type { HorusActor } from "./actor";
import { validIsoDate } from "./http";
import { ReadLimitExceededError, readAllRows } from "./read-all";
import { getSupabaseAdmin } from "./supabase";

const PAGE_SIZE = 50 as const;
const EXPORT_BATCH_SIZE = 500;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const REPORT_KINDS = new Set<ReportKind>(["entries", "balances", "history"]);

export const REPORT_CATEGORIES = {
  entries: ["regular", "retroactive", "non_business", "with_notes"],
  balances: ["CREDIT", "DEBIT", "COMPENSATION", "RESERVATION", "RELEASE", "CONSUMPTION", "REVERSAL", "EXPIRATION", "ADJUSTMENT"],
  history: ["entries", "closing", "approval", "request", "registration", "access", "policy"],
} as const;

export class ReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportInputError";
  }
}

type EntryViewRow = { id:string; organization_id:string; person_id:string; person_name:string|null; sector_id:string|null; sector_name:string|null; work_date:string; start_time:string; end_time:string; break_minutes:number; calculated_minutes:number; eligible_minutes:number; non_business_day_status:string; notes:string|null; is_retroactive:boolean; has_notes:boolean };
type BalanceViewRow = { id:string; organization_id:string; person_id:string; person_name:string|null; sector_id:string|null; sector_name:string|null; type:string; lot_type:string|null; minutes:number; description:string|null; lot_status:string|null; created_at:string; event_date:string; direction?:string|null; movement_direction?:string|null };
type AuditViewRow = { id:string; organization_id:string; actor_id:string; actor_name:string|null; action:string; entity_type:string; entity_id:string; reason:string|null; affected_user_id:string|null; affected_user_name:string|null; sector_id:string|null; related_date:string|null; created_at:string; event_date:string; category:string };
type BalanceDirectionRow = Pick<BalanceViewRow, "type" | "lot_type" | "direction" | "movement_direction">;
type ReportAggregate = { rowCount:number; timezone:string; workedMinutes?:number; consideredMinutes?:number; creditMinutes?:number; debitMinutes?:number; reservationMinutes?:number; utilizationMinutes?:number; events?:number; affectedPeople?:number };
type UserOptionRow = { id:string; name:string; status:"ACTIVE"|"INACTIVE" };
type SectorOptionRow = { id:string; name:string; status:"ACTIVE"|"INACTIVE" };
type Page<T> = { data:T[]|null; count:number|null; error:unknown };
type ReportQuery<T> = {
  eq(key:string, value:unknown): ReportQuery<T>; is(key:string, value:unknown): ReportQuery<T>; neq(key:string, value:unknown): ReportQuery<T>;
  not(key:string, operator:string, value:unknown): ReportQuery<T>; gte(key:string, value:unknown): ReportQuery<T>; lte(key:string, value:unknown): ReportQuery<T>;
  order(key:string, options?:{ ascending?:boolean }): ReportQuery<T>; range(from:number, to:number): PromiseLike<Page<T>>;
};
type RpcResult<T> = { data:T|null; error:unknown };
type ReportAdmin = {
  from(table:string): { select(columns:string, options:{ count:"exact" }): ReportQuery<unknown> };
  rpc(name:string, args:Record<string, unknown>): PromiseLike<RpcResult<unknown>>;
};

function reportAdmin(): ReportAdmin { return getSupabaseAdmin() as unknown as ReportAdmin; }

function one(params: URLSearchParams, key: string) {
  const values = params.getAll(key);
  if (values.length > 1) throw new ReportInputError("Filtro inválido.");
  return values[0] ?? null;
}

function validReportDate(value: string | null) {
  return value !== null && validIsoDate(value) && Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2200;
}

function optionalId(value: string | null) {
  if (value === null) return null;
  if (!ID_PATTERN.test(value)) throw new ReportInputError("Filtro inválido.");
  return value;
}

/** Parse the public query shape without accepting client-selected page sizes or unknown filters. */
export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  const allowed = new Set(["kind", "from", "to", "page", "personId", "sectorId", "category", "actorId"]);
  for (const key of searchParams.keys()) if (!allowed.has(key)) throw new ReportInputError("Filtro inválido.");
  const kindValue = one(searchParams, "kind");
  if (!kindValue || !REPORT_KINDS.has(kindValue as ReportKind)) throw new ReportInputError("Tipo de relatório inválido.");
  const kind = kindValue as ReportKind;
  const from = one(searchParams, "from"), to = one(searchParams, "to");
  if (!validReportDate(from) || !validReportDate(to) || from > to) throw new ReportInputError("Período inválido.");
  const pageValue = one(searchParams, "page");
  const page = pageValue === null ? 1 : Number(pageValue);
  if (!Number.isSafeInteger(page) || page < 1 || String(page) !== pageValue) throw new ReportInputError("Página inválida.");
  const sectorValue = one(searchParams, "sectorId");
  const sectorId = sectorValue === "UNASSIGNED" ? sectorValue : optionalId(sectorValue);
  const category = one(searchParams, "category");
  if (category !== null && !(REPORT_CATEGORIES[kind] as readonly string[]).includes(category)) throw new ReportInputError("Categoria inválida.");
  const personId = optionalId(one(searchParams, "personId"));
  const actorValue = one(searchParams, "actorId");
  const actorId = kind === "history" ? optionalId(actorValue) : null;
  return { kind, from, to, page, pageSize: PAGE_SIZE, personId, sectorId, category, actorId };
}

function assertFilters(filters: ReportFilters) {
  if (!REPORT_KINDS.has(filters.kind) || !validReportDate(filters.from) || !validReportDate(filters.to) || filters.from > filters.to || !Number.isSafeInteger(filters.page) || filters.page < 1 || filters.pageSize !== PAGE_SIZE) throw new ReportInputError("Filtro inválido.");
  if (filters.personId !== null && !ID_PATTERN.test(filters.personId)) throw new ReportInputError("Filtro inválido.");
  if (filters.sectorId !== null && filters.sectorId !== "UNASSIGNED" && !ID_PATTERN.test(filters.sectorId)) throw new ReportInputError("Filtro inválido.");
  if (filters.kind === "history" && filters.actorId !== null && !ID_PATTERN.test(filters.actorId)) throw new ReportInputError("Filtro inválido.");
  if (filters.category !== null && !(REPORT_CATEGORIES[filters.kind] as readonly string[]).includes(filters.category)) throw new ReportInputError("Categoria inválida.");
}

function statusDescription(status: "ACTIVE" | "INACTIVE") { return status === "ACTIVE" ? "Ativo" : "Inativo"; }
function option(row: UserOptionRow | SectorOptionRow): ReportOption { return { value: row.id, label: row.name, description: statusDescription(row.status) }; }

async function allOptionRows<T extends { id:string }>(query: ReportQuery<T>): Promise<T[]> {
  return readAllRows<T>((from, to) => query.range(from, to));
}

export async function getReportOptions(actor: HorusActor, kind: ReportKind): Promise<ReportOptions> {
  if (!REPORT_KINDS.has(kind)) throw new ReportInputError("Tipo de relatório inválido.");
  const admin = reportAdmin();
  const [people, actors, sectors] = await Promise.all([
    allOptionRows<UserOptionRow>(admin.from("users").select("id,name,status", { count: "exact" }).eq("organization_id", actor.organizationId).eq("role", "PJ").order("name").order("id") as ReportQuery<UserOptionRow>),
    allOptionRows<UserOptionRow>(admin.from("users").select("id,name,status", { count: "exact" }).eq("organization_id", actor.organizationId).order("name").order("id") as ReportQuery<UserOptionRow>),
    allOptionRows<SectorOptionRow>(admin.from("sectors").select("id,name,status", { count: "exact" }).eq("organization_id", actor.organizationId).order("name").order("id") as ReportQuery<SectorOptionRow>),
  ]);
  return {
    people: people.map(option), actors: actors.map(option),
    sectors: [{ value: "UNASSIGNED", label: "Sem setor definido" }, ...sectors.map(option)],
    categories: REPORT_CATEGORIES[kind].map(value => ({ value, label: reportCategoryLabel(kind, value) })),
  };
}

function validateScopedFilters(filters: ReportFilters, options: ReportOptions) {
  const personKnown = filters.personId === null || options.people.some(option => option.value === filters.personId);
  const sectorKnown = filters.sectorId === null || filters.sectorId === "UNASSIGNED" || options.sectors.some(option => option.value === filters.sectorId);
  const actorKnown = filters.kind !== "history" || filters.actorId === null || options.actors.some(option => option.value === filters.actorId);
  if (!personKnown || !sectorKnown || !actorKnown) throw new ReportInputError("Pessoa, setor ou responsável inválido para esta organização.");
}

function applyEntryFilters<T>(query: ReportQuery<T>, actor: HorusActor, filters: ReportFilters) {
  query.eq("organization_id", actor.organizationId).gte("work_date", filters.from).lte("work_date", filters.to);
  if (filters.personId) query.eq("person_id", filters.personId);
  if (filters.sectorId === "UNASSIGNED") query.is("sector_id", null);
  else if (filters.sectorId) query.eq("sector_id", filters.sectorId);
  if (filters.category === "regular") query.eq("is_retroactive", false).eq("non_business_day_status", "NOT_APPLICABLE");
  if (filters.category === "retroactive") query.eq("is_retroactive", true);
  if (filters.category === "non_business") query.neq("non_business_day_status", "NOT_APPLICABLE");
  if (filters.category === "with_notes") query.eq("has_notes", true);
  return query.order("work_date", { ascending: false }).order("id", { ascending: false });
}

function applyBalanceFilters<T>(query: ReportQuery<T>, actor: HorusActor, filters: ReportFilters) {
  query.eq("organization_id", actor.organizationId).gte("event_date", filters.from).lte("event_date", filters.to);
  if (filters.personId) query.eq("person_id", filters.personId);
  if (filters.sectorId === "UNASSIGNED") query.is("sector_id", null);
  else if (filters.sectorId) query.eq("sector_id", filters.sectorId);
  if (filters.category) query.eq("type", filters.category);
  return query.order("created_at", { ascending: false }).order("id", { ascending: false });
}

function applyHistoryFilters<T>(query: ReportQuery<T>, actor: HorusActor, filters: ReportFilters) {
  query.eq("organization_id", actor.organizationId).gte("event_date", filters.from).lte("event_date", filters.to);
  if (filters.personId) query.eq("affected_user_id", filters.personId);
  if (filters.sectorId === "UNASSIGNED") query.is("sector_id", null).not("affected_user_id", "is", null);
  else if (filters.sectorId) query.eq("sector_id", filters.sectorId);
  if (filters.category) query.eq("category", filters.category);
  if (filters.actorId) query.eq("actor_id", filters.actorId);
  return query.order("created_at", { ascending: false }).order("id", { ascending: false });
}

function reportQuery(actor: HorusActor, filters: ReportFilters, selectedColumns = "*"): ReportQuery<unknown> {
  const admin = reportAdmin();
  if (filters.kind === "entries") return applyEntryFilters(admin.from("report_time_entries").select(selectedColumns, { count: "exact" }), actor, filters);
  if (filters.kind === "balances") return applyBalanceFilters(admin.from("report_balance_transactions").select(selectedColumns, { count: "exact" }), actor, filters);
  return applyHistoryFilters(admin.from("report_audit_events").select(selectedColumns, { count: "exact" }), actor, filters);
}

function mapEntry(row: EntryViewRow): EntryReportRow {
  return { id: row.id, workDate: row.work_date, personId: row.person_id, personName: row.person_name ?? "Não identificado", sectorName: row.sector_name ?? "Sem setor definido", startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5), breakMinutes: row.break_minutes, workedMinutes: row.calculated_minutes, consideredMinutes: row.eligible_minutes, situation: entrySituationLabel(row.non_business_day_status), notes: row.notes ?? "" };
}

function balanceDirection(row: BalanceDirectionRow): BalanceReportRow["direction"] {
  if (row.type === "CREDIT") return "credit";
  if (row.type === "DEBIT" || row.type === "CONSUMPTION" || row.type === "EXPIRATION") return "debit";
  if (row.type === "RESERVATION") return "reservation";
  if (row.type === "RELEASE") return "release";
  if (row.type === "COMPENSATION") return row.lot_type === "CREDIT" ? "debit" : row.lot_type === "DEBIT" ? "credit" : "neutral";
  const stored = row.direction ?? row.movement_direction;
  return stored === "credit" || stored === "debit" || stored === "reservation" || stored === "release" || stored === "neutral" ? stored : "neutral";
}

function mapBalance(row: BalanceViewRow): BalanceReportRow {
  const direction = balanceDirection(row);
  return { id: row.id, createdAt: row.created_at, personId: row.person_id, personName: row.person_name ?? "Não identificado", sectorName: row.sector_name ?? "Sem setor definido", movement: balanceMovementLabel(row.type), direction, directionLabel: balanceDirectionLabel(direction), minutes: row.minutes, description: row.description ?? "", status: balanceLotStatusLabel(row.lot_status ?? "") };
}

function mapHistory(row: AuditViewRow): HistoryReportRow {
  return { id: row.id, createdAt: row.created_at, actorId: row.actor_id, actorName: row.actor_name ?? "Usuário não identificado", action: actionLabel(row.action), affectedPersonId: row.affected_user_id, affectedPersonName: row.affected_user_name ?? "Não identificado", relatedRecord: relatedRecordLabel(row.entity_type, row.related_date, row.affected_user_name), reason: row.reason ?? "", technical: { actionCode: row.action, entityType: row.entity_type, entityId: row.entity_id } };
}

function mapRows(kind: ReportKind, rows: unknown[]): ReportRow[] {
  if (kind === "entries") return (rows as EntryViewRow[]).map(mapEntry);
  if (kind === "balances") return (rows as BalanceViewRow[]).map(mapBalance);
  return (rows as AuditViewRow[]).map(mapHistory);
}

function columns(kind: ReportKind): ReportColumn[] {
  if (kind === "entries") return [
    { key:"workDate",label:"Data trabalhada" }, { key:"personName",label:"Colaborador" }, { key:"sectorName",label:"Setor" },
    { key:"startTime",label:"Entrada" }, { key:"endTime",label:"Saída" }, { key:"breakMinutes",label:"Intervalo" },
    { key:"workedMinutes",label:"Horas trabalhadas" }, { key:"consideredMinutes",label:"Horas consideradas" },
    { key:"situation",label:"Situação do dia" }, { key:"notes",label:"Observação" },
  ];
  if (kind === "balances") return [
    { key:"createdAt",label:"Data" }, { key:"personName",label:"Colaborador" }, { key:"sectorName",label:"Setor" },
    { key:"movement",label:"Tipo de movimentação" }, { key:"directionLabel",label:"Crédito ou débito" },
    { key:"minutes",label:"Quantidade de horas" }, { key:"description",label:"Origem ou descrição" }, { key:"status",label:"Situação relacionada" },
  ];
  return [
    { key:"createdAt",label:"Data e hora" }, { key:"actorName",label:"Quem realizou" }, { key:"action",label:"O que aconteceu" },
    { key:"affectedPersonName",label:"Pessoa afetada" }, { key:"relatedRecord",label:"Registro relacionado" },
    { key:"reason",label:"Motivo" }, { key:"technical",label:"Dados técnicos",technical:true },
  ];
}

function pagination(page: number, total: number) { return { page, pageSize: PAGE_SIZE, total, pageCount: Math.ceil(total / PAGE_SIZE) }; }

async function readPage(actor: HorusActor, filters: ReportFilters, from: number, to: number): Promise<Page<unknown>> {
  return reportQuery(actor, filters).range(from, to) as Promise<Page<unknown>>;
}

function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value); }

async function readSummary(actor: HorusActor, filters: ReportFilters): Promise<ReportAggregate> {
  const result = await reportAdmin().rpc("report_summary", {
    p_organization_id: actor.organizationId,
    p_kind: filters.kind,
    p_from: filters.from,
    p_to: filters.to,
    p_person_id: filters.personId,
    p_sector_id: filters.sectorId,
    p_category: filters.category,
    p_actor_id: filters.kind === "history" ? filters.actorId : null,
  });
  if (result.error) throw result.error;
  const aggregate = result.data as ReportAggregate | null;
  const keys = filters.kind === "entries"
    ? ["workedMinutes", "consideredMinutes"]
    : filters.kind === "balances"
      ? ["creditMinutes", "debitMinutes", "reservationMinutes", "utilizationMinutes"]
      : ["events", "affectedPeople"];
  if (!aggregate || !Number.isSafeInteger(aggregate.rowCount) || aggregate.rowCount < 0 || typeof aggregate.timezone !== "string" || !aggregate.timezone || !keys.every(key => finiteNumber(aggregate[key as keyof ReportAggregate]))) {
    throw new Error("Incomplete report summary");
  }
  return aggregate;
}

export async function getReportPage(actor: HorusActor, filters: ReportFilters): Promise<ReportResponse> {
  assertFilters(filters);
  const options = await getReportOptions(actor, filters.kind);
  validateScopedFilters(filters, options);
  const [result, aggregate] = await Promise.all([
    readPage(actor, filters, (filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1),
    readSummary(actor, filters),
  ]);
  if (result.error) throw result.error;
  if (!Array.isArray(result.data) || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("Incomplete history read");
  if (aggregate.rowCount !== result.count) throw new Error("History changed during read");
  const common = { timezone: aggregate.timezone, filters, columns: columns(filters.kind), options, pagination: pagination(filters.page, result.count) };
  if (filters.kind === "entries") return { ...common, kind: "entries", rows: mapRows("entries", result.data) as EntryReportRow[], summary: { workedMinutes: aggregate.workedMinutes!, consideredMinutes: aggregate.consideredMinutes! } satisfies EntryReportSummary };
  if (filters.kind === "balances") return { ...common, kind: "balances", rows: mapRows("balances", result.data) as BalanceReportRow[], summary: { creditMinutes: aggregate.creditMinutes!, debitMinutes: aggregate.debitMinutes!, reservationMinutes: aggregate.reservationMinutes!, utilizationMinutes: aggregate.utilizationMinutes! } satisfies BalanceReportSummary };
  return { ...common, kind: "history", rows: mapRows("history", result.data) as HistoryReportRow[], summary: { events: aggregate.events!, affectedPeople: aggregate.affectedPeople! } satisfies HistoryReportSummary };
}

/** Private 500-row reader for exports. Counts and IDs must remain stable across every batch. */
export async function getAllReportRows(actor: HorusActor, filters: ReportFilters, maxRows?: number): Promise<ReportRow[]> {
  assertFilters(filters);
  if (maxRows !== undefined && (!Number.isSafeInteger(maxRows) || maxRows < 0)) throw new Error("Invalid row limit");
  const options = await getReportOptions(actor, filters.kind);
  validateScopedFilters(filters, options);
  const raw: unknown[] = [], ids = new Set<string>();
  let expected: number | undefined;
  while (expected === undefined || raw.length < expected) {
    const result = await readPage(actor, filters, raw.length, raw.length + EXPORT_BATCH_SIZE - 1);
    if (result.error) throw result.error;
    if (!Array.isArray(result.data) || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("Incomplete history read");
    expected ??= result.count;
    if (result.count !== expected || (!result.data.length && raw.length < expected)) throw new Error("History changed during read");
    if (maxRows !== undefined && result.count > maxRows) throw new ReadLimitExceededError(maxRows, result.count);
    for (const row of result.data as { id?: unknown }[]) {
      if (typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new Error("History changed during read");
      ids.add(row.id); raw.push(row);
    }
    if (raw.length > expected) throw new Error("History changed during read");
  }
  return mapRows(filters.kind, raw);
}

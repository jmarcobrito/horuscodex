import { useState } from "react";
import { createRoot } from "react-dom/client";
import { HorusApp } from "../../app/HorusApp";
import type { ReportFilters, ReportKind, ReportOptions, ReportResponse, ReportRow } from "../../app/reports/report-types";
import { createWorkflowServer, type TestRole, type TestScenario } from "../helpers/workflow-server";
import "../../app/globals.css";
import "./preview.css";

type ReportMode = "normal" | "empty" | "loading" | "error";
type PreviewState = { reportMode: ReportMode };
type PreviewRequest = (url: string, init?: RequestInit) => Promise<Response>;
type FixtureRow = ReportRow & { previewSectorId: string | null; previewCategory: string };

const PEOPLE = [
  { value: "person-1", label: "Ana Exemplo", description: "Ativo" },
  { value: "person-2", label: "Bruno Exemplo", description: "Ativo" },
  { value: "person-3", label: "Carla Exemplo", description: "Inativo" },
];
const SECTORS = [
  { id: "sector-product", name: "Produto", status: "ACTIVE" as const, created_at: "2026-01-10T09:00:00Z", updated_at: "2026-08-20T14:00:00Z" },
  { id: "sector-operations", name: "Operações", status: "ACTIVE" as const, created_at: "2026-02-12T09:00:00Z", updated_at: "2026-08-22T14:00:00Z" },
  { id: "sector-legacy", name: "Operação antiga", status: "INACTIVE" as const, created_at: "2025-11-03T09:00:00Z", updated_at: "2026-07-15T14:00:00Z" },
];
const ACTORS = [
  { value: "rh-1", label: "Marina Exemplo", description: "RH ativo" },
  { value: "dev-1", label: "Diego Exemplo", description: "DEV ativo" },
];

const ENTRY_ROWS: FixtureRow[] = [
  { id: "entry-preview-1", workDate: "2026-08-28", personId: "person-1", personName: "Ana Exemplo", sectorName: "Produto", startTime: "08:35", endTime: "17:42", breakMinutes: 60, workedMinutes: 487, consideredMinutes: 487, situation: "Dia útil", notes: "Alinhamento e revisão do fluxo de cadastro.", previewSectorId: "sector-product", previewCategory: "with_notes" },
  { id: "entry-preview-2", workDate: "2026-08-27", personId: "person-2", personName: "Bruno Exemplo", sectorName: "Operações", startTime: "09:02", endTime: "18:10", breakMinutes: 60, workedMinutes: 488, consideredMinutes: 488, situation: "Dia útil", notes: "", previewSectorId: "sector-operations", previewCategory: "regular" },
  { id: "entry-preview-3", workDate: "2026-08-22", personId: "person-3", personName: "Carla Exemplo", sectorName: "Sem setor definido", startTime: "08:20", endTime: "16:55", breakMinutes: 45, workedMinutes: 470, consideredMinutes: 470, situation: "Autorizado para dia não útil", notes: "Apoio excepcional previamente autorizado.", previewSectorId: null, previewCategory: "non_business" },
];

const BALANCE_ROWS: FixtureRow[] = [
  { id: "balance-preview-1", createdAt: "2026-08-28T18:00:00Z", personId: "person-1", personName: "Ana Exemplo", sectorName: "Produto", movement: "Crédito", direction: "credit", directionLabel: "Crédito", minutes: 67, description: "Saldo positivo do fechamento de julho", status: "Disponível", previewSectorId: "sector-product", previewCategory: "CREDIT" },
  { id: "balance-preview-2", createdAt: "2026-08-27T18:30:00Z", personId: "person-2", personName: "Bruno Exemplo", sectorName: "Operações", movement: "Débito", direction: "debit", directionLabel: "Débito", minutes: 42, description: "Ajuste conferido pelo RH", status: "Compensado", previewSectorId: "sector-operations", previewCategory: "DEBIT" },
  { id: "balance-preview-3", createdAt: "2026-08-24T13:10:00Z", personId: "person-1", personName: "Ana Exemplo", sectorName: "Produto", movement: "Reserva", direction: "reservation", directionLabel: "Reserva", minutes: 120, description: "Folga aprovada para 31/08", status: "Reservado", previewSectorId: "sector-product", previewCategory: "RESERVATION" },
  { id: "balance-preview-4", createdAt: "2026-08-21T10:15:00Z", personId: "person-3", personName: "Carla Exemplo", sectorName: "Sem setor definido", movement: "Utilização", direction: "debit", directionLabel: "Débito", minutes: 90, description: "Folga utilizada em 21/08", status: "Utilizado", previewSectorId: null, previewCategory: "CONSUMPTION" },
];

const HISTORY_ROWS: FixtureRow[] = [
  { id: "history-preview-1", createdAt: "2026-08-28T15:24:00Z", actorId: "rh-1", actorName: "Marina Exemplo", action: "Alterou um lançamento de horas", affectedPersonId: "person-1", affectedPersonName: "Ana Exemplo", relatedRecord: "Lançamento de 27/08/2026 — Ana Exemplo", reason: "Correção conferida com a colaboradora", technical: { actionCode: "TIME_ENTRY_UPDATED", entityType: "TimeEntry", entityId: "entry-preview-1" }, previewSectorId: "sector-product", previewCategory: "entries" },
  { id: "history-preview-2", createdAt: "2026-08-27T17:40:00Z", actorId: "dev-1", actorName: "Diego Exemplo", action: "Criou um setor", affectedPersonId: null, affectedPersonName: "Não identificado", relatedRecord: "Setor", reason: "Organização da equipe fictícia", technical: { actionCode: "SECTOR_CREATED", entityType: "Sector", entityId: "sector-operations" }, previewSectorId: null, previewCategory: "registration" },
  { id: "history-preview-3", createdAt: "2026-08-26T13:12:00Z", actorId: "rh-1", actorName: "Marina Exemplo", action: "Aprovou uma folga", affectedPersonId: "person-2", affectedPersonName: "Bruno Exemplo", relatedRecord: "Solicitação de folga — Bruno Exemplo", reason: "Saldo disponível e cobertura confirmada", technical: { actionCode: "LEAVE_REQUEST_APPROVE", entityType: "LeaveRequest", entityId: "leave-preview-1" }, previewSectorId: "sector-operations", previewCategory: "approval" },
];

const CATEGORIES: Record<ReportKind, ReportOptions["categories"]> = {
  entries: [
    { value: "regular", label: "Regular" }, { value: "retroactive", label: "Retroativo" },
    { value: "non_business", label: "Dia não útil" }, { value: "with_notes", label: "Com observação" },
  ],
  balances: [
    { value: "CREDIT", label: "Crédito" }, { value: "DEBIT", label: "Débito" },
    { value: "RESERVATION", label: "Reserva" }, { value: "CONSUMPTION", label: "Utilização" },
  ],
  history: [
    { value: "entries", label: "Lançamento" }, { value: "approval", label: "Aprovação" },
    { value: "registration", label: "Cadastro" }, { value: "access", label: "Acesso" },
  ],
};

const COLUMNS: Record<ReportKind, ReportResponse["columns"]> = {
  entries: [
    { key: "workDate", label: "Data trabalhada" }, { key: "personName", label: "Colaborador" }, { key: "sectorName", label: "Setor" },
    { key: "startTime", label: "Entrada" }, { key: "endTime", label: "Saída" }, { key: "breakMinutes", label: "Intervalo" },
    { key: "workedMinutes", label: "Horas trabalhadas" }, { key: "consideredMinutes", label: "Horas consideradas" },
    { key: "situation", label: "Situação do dia" }, { key: "notes", label: "Observação" },
  ],
  balances: [
    { key: "createdAt", label: "Data" }, { key: "personName", label: "Colaborador" }, { key: "sectorName", label: "Setor" },
    { key: "movement", label: "Tipo de movimentação" }, { key: "directionLabel", label: "Crédito ou débito" },
    { key: "minutes", label: "Quantidade de horas" }, { key: "description", label: "Origem ou descrição" },
    { key: "status", label: "Situação relacionada" },
  ],
  history: [
    { key: "createdAt", label: "Data e hora" }, { key: "actorName", label: "Quem realizou" }, { key: "action", label: "O que aconteceu" },
    { key: "affectedPersonName", label: "Pessoa afetada" }, { key: "relatedRecord", label: "Registro relacionado" },
    { key: "reason", label: "Motivo" }, { key: "technical", label: "Dados técnicos", technical: true },
  ],
};

function previewFilters(url: URL): ReportFilters {
  const selectedKind = url.searchParams.get("kind");
  const kind = selectedKind === "balances" || selectedKind === "history" ? selectedKind : "entries";
  return {
    kind,
    from: url.searchParams.get("from") ?? "2026-09-01",
    to: url.searchParams.get("to") ?? "2026-09-30",
    personId: url.searchParams.get("personId"),
    sectorId: url.searchParams.get("sectorId"),
    category: url.searchParams.get("category"),
    actorId: kind === "history" ? url.searchParams.get("actorId") : null,
    page: Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1),
    pageSize: 50,
  };
}

function previewRows(filters: ReportFilters) {
  const source = filters.kind === "entries" ? ENTRY_ROWS : filters.kind === "balances" ? BALANCE_ROWS : HISTORY_ROWS;
  return source.filter(row => {
    const record = row as FixtureRow & { personId?: string; affectedPersonId?: string | null; actorId?: string; workDate?: string; createdAt?: string };
    const personId = filters.kind === "history" ? record.affectedPersonId : record.personId;
    const date = filters.kind === "entries" ? record.workDate : record.createdAt?.slice(0, 10);
    return (!filters.personId || personId === filters.personId)
      && (!filters.sectorId || (filters.sectorId === "UNASSIGNED" ? row.previewSectorId === null : row.previewSectorId === filters.sectorId))
      && (!filters.category || row.previewCategory === filters.category)
      && (!filters.actorId || record.actorId === filters.actorId)
      && Boolean(date && date >= filters.from && date <= filters.to);
  });
}

function operationalRows(rows: FixtureRow[]): ReportRow[] {
  return rows.map(row => {
    const operational = { ...row } as Record<string, unknown>;
    delete operational.previewSectorId;
    delete operational.previewCategory;
    return operational as unknown as ReportRow;
  });
}

function previewReport(url: URL, mode: ReportMode): ReportResponse {
  const filters = previewFilters(url);
  const rows = mode === "empty" ? [] : previewRows(filters);
  const options: ReportOptions = {
    people: PEOPLE,
    sectors: [{ value: "UNASSIGNED", label: "Sem setor definido" }, ...SECTORS.map(sector => ({ value: sector.id, label: sector.name, description: sector.status === "ACTIVE" ? "Ativo" : "Inativo" }))],
    actors: ACTORS,
    categories: CATEGORIES[filters.kind],
  };
  const pagination = { page: filters.page, pageSize: 50 as const, total: rows.length, pageCount: rows.length ? 1 : 0 };
  if (filters.kind === "entries") {
    const entryRows = rows.filter((row): row is Extract<FixtureRow, { workDate: string }> => "workDate" in row);
    return { kind: "entries", timezone: "America/Sao_Paulo", filters, columns: COLUMNS.entries, rows: operationalRows(entryRows), summary: { workedMinutes: entryRows.reduce((total, row) => total + row.workedMinutes, 0), consideredMinutes: entryRows.reduce((total, row) => total + row.consideredMinutes, 0) }, options, pagination } as ReportResponse;
  }
  if (filters.kind === "balances") {
    const balanceRows = rows.filter((row): row is Extract<FixtureRow, { movement: string }> => "movement" in row);
    const sum = (direction: string) => balanceRows.reduce((total, row) => total + (row.direction === direction ? row.minutes : 0), 0);
    const utilizationMinutes = balanceRows.reduce((total, row) => total + (row.previewCategory === "CONSUMPTION" ? row.minutes : 0), 0);
    return { kind: "balances", timezone: "America/Sao_Paulo", filters, columns: COLUMNS.balances, rows: operationalRows(balanceRows), summary: { creditMinutes: sum("credit"), debitMinutes: sum("debit"), reservationMinutes: sum("reservation"), utilizationMinutes }, options, pagination } as ReportResponse;
  }
  const historyRows = rows.filter((row): row is Extract<FixtureRow, { actorId: string }> => "actorId" in row);
  const affected = new Set(historyRows.flatMap(row => row.affectedPersonId ? [row.affectedPersonId] : []));
  return { kind: "history", timezone: "America/Sao_Paulo", filters, columns: COLUMNS.history, rows: operationalRows(historyRows), summary: { events: historyRows.length, affectedPeople: affected.size }, options, pagination } as ReportResponse;
}

function pendingUntilAbort(signal?: AbortSignal | null) {
  return new Promise<Response>((_resolve, reject) => {
    const abort = () => reject(new DOMException("Ensaio reiniciado", "AbortError"));
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

export function createPreviewRequest(delegate: PreviewRequest, state: PreviewState): PreviewRequest {
  let sectors = structuredClone(SECTORS);
  const previewRoutes: Record<string, (url: URL, init: RequestInit) => Promise<Response> | Response> = {
    "GET /api/reports": (url, init) => {
      if (state.reportMode === "loading") return pendingUntilAbort(init.signal);
      if (state.reportMode === "error") return Response.json({ error: "Falha fictícia do servidor de relatórios." }, { status: 503 });
      return Response.json(previewReport(url, state.reportMode));
    },
    "GET /api/reports/export": url => {
      const format = url.searchParams.get("format") ?? "xlsx";
      return new Response(`Arquivo fictício ${format}; nenhum dado real foi consultado.`, { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="horus-ensaio.${format === "package" ? "xlsx" : format}"` } });
    },
    "GET /api/sectors": () => Response.json({ sectors }),
    "POST /api/sectors": (_url, init) => {
      const body = JSON.parse(String(init.body ?? "{}")) as { name?: string };
      const sector = { id: `sector-preview-${sectors.length + 1}`, name: body.name?.trim() || "Novo setor fictício", status: "ACTIVE" as const, created_at: "2026-09-04T12:00:00Z", updated_at: "2026-09-04T12:00:00Z" };
      sectors = [...sectors, sector];
      return Response.json({ sector, message: "Setor fictício criado." });
    },
    "PATCH /api/sectors": (_url, init) => {
      const body = JSON.parse(String(init.body ?? "{}")) as { id?: string; name?: string; status?: "ACTIVE" | "INACTIVE" };
      sectors = sectors.map(sector => sector.id === body.id ? { ...sector, name: body.name?.trim() || sector.name, status: body.status ?? sector.status, updated_at: "2026-09-04T12:00:00Z" } : sector);
      return Response.json({ message: "Setor fictício atualizado." });
    },
  };

  return async (path, init = {}) => {
    if (typeof path !== "string" || !path.startsWith("/api/")) throw new Error("Endereço externo proibido no ensaio");
    const url = new URL(path, "https://horus.invalid");
    const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname}`;
    const route = previewRoutes[key];
    return route ? route(url, init) : delegate(path, init);
  };
}

function createRun(id: number, role: TestRole, scenario: TestScenario, reportMode: ReportMode) {
  const server = createWorkflowServer(role, scenario);
  const previewState = { reportMode };
  return { id, role, server, request: createPreviewRequest(server.request, previewState) };
}

function Harness() {
  const [role, setRole] = useState<TestRole>("rh");
  const [scenario, setScenario] = useState<TestScenario>("normal");
  const [reportMode, setReportMode] = useState<ReportMode>("normal");
  const [run, setRun] = useState(() => createRun(0, "rh", "normal", "normal"));
  const [report, setReport] = useState("");
  const [realDisconnected, setRealDisconnected] = useState(false);
  const { server } = run;
  function reset() { setRun(createRun(run.id + 1, role, scenario, reportMode)); setReport(""); }
  return <>
    <div className="fixture-banner"><strong>TESTE LOCAL — dados fictícios; sem Supabase</strong>
      <details><summary>Controles do ensaio</summary><div className="fixture-controls" key={run.id}>
        <label>Perfil de teste<select value={role} onChange={event => setRole(event.target.value as TestRole)}><option value="rh">RH</option><option value="pj">Colaborador</option><option value="dev">DEV</option></select></label>
        <label>Cenário geral<select value={scenario} onChange={event => setScenario(event.target.value as TestScenario)}><option value="normal">Normal</option><option value="pending">Pendência</option><option value="empty">Mês sem lançamentos</option><option value="closed">Mês fechado</option><option value="unknown">Metadados indisponíveis</option><option value="range">Intervalo parcial inicial</option></select></label>
        <label>Estado dos relatórios<select value={reportMode} onChange={event => setReportMode(event.target.value as ReportMode)}><option value="normal">Com resultados</option><option value="empty">Sem resultados</option><option value="loading">Carregando contínuo</option><option value="error">Erro do servidor</option></select></label>
        <button type="button" className="fixture-primary" onClick={reset}>Aplicar controles e reiniciar</button>
        <button type="button" onClick={() => { server.configure({ failDashboard: true }); setReport("Próxima consulta falhará"); }}>Falhar próxima consulta</button>
        <label><input type="checkbox" onChange={event => { server.configure({ delayAugust: event.target.checked }); }} />Atrasar agosto</label>
        <label><input type="checkbox" onChange={event => { server.configure({ failRefreshAfterSave: event.target.checked }); }} />Falhar consulta após salvar</label>
        <label>Histórico fictício<select onChange={event => { server.configure({ historyMode: event.target.value as typeof server.controls.historyMode }); }}><option value="normal">Versões</option><option value="empty">Vazio</option><option value="error">Erro</option><option value="slow">Lento</option></select></label>
        <label>Resultado fictício<select onChange={event => { server.configure({ closingMode: event.target.value as typeof server.controls.closingMode }); }}><option value="normal">Sucesso</option><option value="partial">Falha parcial</option><option value="uncertain">Incerto</option><option value="slow">Lento</option></select></label>
        <label><input type="checkbox" checked={realDisconnected} onChange={event => setRealDisconnected(event.target.checked)} />Fechamento desativado no servidor</label>
        <button type="button" onClick={() => setReport(JSON.stringify({ calls: server.calls, closingCalls: server.closingCalls }, null, 2))}>Mostrar chamadas fictícias</button>
        <button type="button" onClick={() => setReport(JSON.stringify(server.snapshot(), null, 2))}>Mostrar dias e versões fictícios</button>
        <output aria-live="polite"><pre>{report}</pre></output>
      </div></details>
    </div>
    <HorusApp key={run.id} accountRole={run.role} user={{ name: run.role === "pj" ? "Ana Exemplo" : run.role === "dev" ? "Diego Exemplo" : "Marina Exemplo", email: `${run.role}@example.invalid` }} organizationName="Empresa fictícia" initialDashboard={server.initialDashboard} request={run.request} closingEnabled={!realDisconnected} closingTestMode />
  </>;
}

createRoot(document.getElementById("root")!).render(<Harness />);

import type { DashboardData, DashboardEntry } from "../../app/dashboard-types";
import type { ClosingSubmit, ClosingResult } from "../../app/closing-model";
import type { HistoryVersion } from "../../app/EntryHistory";
import { monthPeriod } from "../../app/period";
import { buildPeriodSummary, requiredForPerson } from "../../db/dashboard-summary";
import { civilDate, registrationDelayDays } from "../../db/civil-date";
import { makeWorkflowDashboard, makeHistoryVersion } from "../fixtures/monthly-workflow.mjs";
import { makeAdminData } from "../fixtures/dashboard.mjs";
import { createMockRequest } from "./mock-request.mjs";

export type TestRole = "rh" | "pj" | "dev";
export type TestScenario = "normal" | "pending" | "empty" | "closed" | "unknown" | "range" | "overview" | "many" | "nobody";
export function createWorkflowServer(role: TestRole = "rh", scenario: TestScenario = "normal") {
  const dashboards = new Map<string, DashboardData>([["2026-8", makeWorkflowDashboard()], ["2026-9", makeWorkflowDashboard(2026, 9)]]);
  const versions: Record<string, HistoryVersion[]> = { "entry-1": [makeHistoryVersion()], "entry-2": [] };
  const closingCalls: unknown[] = [];
  const controls = { failDashboard: false, omitAnaOnce: false, delayAugust: false, historyMode: "normal" as "normal" | "empty" | "error" | "slow", closingMode: "normal" as "normal" | "partial" | "uncertain" | "slow", failRefreshAfterSave: false };
  const august = dashboards.get("2026-8")!;
  if (scenario === "pending") august.entries[0].nonBusinessDayStatus = "PENDING_AUTHORIZATION";
  if (scenario === "closed") { august.monthlyTimesheets![0].status = "CLOSED"; august.contractors[0].timesheetStatus = "CLOSED"; }
  if (scenario === "unknown") august.monthlyTimesheets = undefined;
  if (scenario === "empty") august.monthlyTimesheets!.push({ ...august.monthlyTimesheets![0], id: "empty-month", contractorId: "person-3", workedMinutes: 0, creditedMinutes: 60, consideredMinutes: 60 });
  if (scenario === "overview" || scenario === "many") {
    const template = august.contractors[0], sheet = august.monthlyTimesheets![0], entry = august.entries[0];
    const names = ["Ana Exemplo", "Bruno Teste", "Carla Teste", "Diego Exemplo", "Elisa Exemplo", "Fábio Exemplo"];
    august.contractors = Array.from({ length: scenario === "many" ? 40 : 6 }, (_, i) => ({ ...template,
      id: "person-" + (i+1), name: names[i] ?? "Pessoa fictícia " + String(i+1).padStart(2,"0"),
      status: i === 1 ? "INACTIVE" : "ACTIVE", sectorId: i === 5 ? null : i % 2 ? "engineering" : "architecture",
      sectorName: i === 5 ? "Sem setor definido" : i % 2 ? "Engenharia" : "Arquitetura" }));
    august.entries = august.contractors.filter((_,i) => i !== 3 && i !== 4).map((p,i) => ({ ...entry, id:"entry-"+(i+1), contractorId:p.id, contractorName:p.name, nonBusinessDayStatus: p.id === "person-3" ? "PENDING_AUTHORIZATION" : "NOT_APPLICABLE" }));
    august.monthlyTimesheets = august.contractors.filter(p => p.id !== "person-5").map(p => ({ ...sheet, id:"sheet-"+p.id, contractorId:p.id, status:p.id === "person-1" ? "CLOSED" : "OPEN", workedMinutes:p.id === "person-4" ? 0 : 480, consideredMinutes:p.id === "person-4" ? 0 : 480 }));
    august.balanceLots = [{ id:"fixture-credit", contractorId:"person-1", contractorName:"Ana Exemplo", type:"CREDIT", originalMinutes:1920, remainingMinutes:1920, reservedMinutes:480, originDate:"2026-07-31", deadlineDate:"2026-10-29", status:"RESERVED" },
      { id:"fixture-debit", contractorId:"person-2", contractorName:"Bruno Teste", type:"DEBIT", originalMinutes:180, remainingMinutes:180, reservedMinutes:0, originDate:"2026-07-31", deadlineDate:"2026-10-29", status:"OPEN" }];
    august.balanceTransactions = august.balanceLots.map(lot => ({ id:lot.id, contractorId:lot.contractorId, contractorName:lot.contractorName, lotId:lot.id, type:lot.type, minutes:lot.remainingMinutes, description:"Movimento fictício", createdAt:"2026-08-01T12:00:00Z" }));
  }
  if (scenario === "nobody") { august.contractors = []; august.entries = []; august.monthlyTimesheets = []; }
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  function getMonth(year: number, month: number) {
    monthPeriod(year, month);
    const key = year + "-" + month;
    if (!dashboards.has(key)) dashboards.set(key, makeWorkflowDashboard(year, month));
    return dashboards.get(key)!;
  }
  function consult(url: URL, omitAna = false) {
    const from = url.searchParams.get("from"), to = url.searchParams.get("to");
    const period = from && to ? { from, to, year: null, month: null } : monthPeriod(Number(url.searchParams.get("year")), Number(url.searchParams.get("month")));
    const months: DashboardData[] = [];
    const cursor = new Date(period.from + "T00:00:00Z"), end = new Date(period.to + "T00:00:00Z");
    while (cursor <= end) { months.push(getMonth(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1)); cursor.setUTCDate(1); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
    const data = structuredClone(months[0] ?? august);
    data.period = period;
    data.timezone = "America/Sao_Paulo";
    const approvalsScope = url.searchParams.get("approvalsScope") ?? "period";
    if (approvalsScope !== "all" && approvalsScope !== "period") throw Error("Escopo fictício inválido");
    data.approvalsScope = approvalsScope;
    const approvalMonths = [...dashboards.values()];
    data.entries = structuredClone(months.flatMap(m => m.entries).filter(e => e.workDate >= period.from && e.workDate <= period.to));
    data.monthlyTimesheets = months.every(m => m.monthlyTimesheets) ? structuredClone(months.flatMap(m => m.monthlyTimesheets!)) : undefined;
    data.authorizations = structuredClone(approvalMonths.flatMap(m => m.authorizations).filter(a => approvalsScope === "all" || (a.workDate >= period.from && a.workDate <= period.to)));
    data.occurrences = structuredClone(approvalMonths.flatMap(m => m.occurrences).filter(o => approvalsScope === "all" || (o.startDate <= period.to && o.endDate >= period.from)));
    data.requests = structuredClone(approvalMonths.flatMap(m => m.requests).filter(r => approvalsScope === "all" || (r.startDate <= period.to && r.endDate >= period.from)));
    const id = role === "pj" ? "person-1" : url.searchParams.get("viewAs");
    if (id) {
      data.contractors = data.contractors.filter(p => p.id === id);
      data.entries = data.entries.filter(e => e.contractorId === id);
      data.monthlyTimesheets = data.monthlyTimesheets?.filter(m => m.contractorId === id);
      data.occurrences = data.occurrences.filter(o => o.contractorId === id);
      data.authorizations = data.authorizations.filter(a => a.contractorId === id);
      data.requests = data.requests.filter(r => r.contractorId === id); data.balanceLots = []; data.balanceTransactions = [];
    }
    // Response-only omission: persisted fictional history remains intact.
    if (omitAna) {
      data.contractors = data.contractors.filter(p => p.id !== "person-1");
      data.entries = data.entries.filter(e => e.contractorId !== "person-1");
      data.monthlyTimesheets = data.monthlyTimesheets?.filter(m => m.contractorId !== "person-1");
      data.occurrences = data.occurrences.filter(o => o.contractorId !== "person-1");
      data.authorizations = data.authorizations.filter(a => a.contractorId !== "person-1");
      data.requests = data.requests.filter(r => r.contractorId !== "person-1");
      data.balanceLots = data.balanceLots.filter(l => l.contractorId !== "person-1");
      data.balanceTransactions = data.balanceTransactions.filter(t => t.contractorId !== "person-1");
    }
    for (const person of data.contractors) {
      const entries = data.entries.filter(e => e.contractorId === person.id);
      const sheets = data.monthlyTimesheets?.filter(m => m.contractorId === person.id) ?? [];
      person.workedMinutes = entries.reduce((n, e) => n + e.calculatedMinutes, 0);
      person.consideredMinutes = entries.reduce((n, e) => n + e.eligibleMinutes, 0) + sheets.reduce((n, m) => n + m.creditedMinutes, 0);
      const requirement = requiredForPerson(sheets, person.status === "ACTIVE", 480, months.length);
      person.requiredMinutes = requirement.requiredMinutes;
      person.estimatedRequiredMonths = requirement.estimatedMonths;
      person.fillPercentage = person.requiredMinutes ? Math.min(100, Math.round(person.consideredMinutes / person.requiredMinutes * 100)) : 0;
      person.timesheetStatus = sheets[0]?.status ?? "OPEN";
      const delays = entries.map(e => registrationDelayDays(e.workDate, e.createdAt, data.timezone!));
      const validDelays = delays.filter((value): value is number => value !== null);
      person.averageDelayDays = validDelays.length ? Math.round(validDelays.reduce((n, value) => n + value, 0) / validDelays.length) : null;
      person.unavailableRegistrationDates = delays.length - validDelays.length;
      person.retroactiveEntries = validDelays.filter(value => value > 0).length;
      person.lastEntryDate = entries.map(e => e.workDate).sort().at(-1) ?? null;
      person.lastEntryAt = entries.filter(e => civilDate(e.createdAt, data.timezone!) !== null).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]?.createdAt ?? null;
    }
    const summary = buildPeriodSummary({ users: data.contractors, entries: data.entries, timesheets: data.monthlyTimesheets ?? [], requiredPerMonth: 480, monthCount: months.length });
    data.timesheet = { workedMinutes: summary.workedMinutes, creditedMinutes: summary.creditedMinutes, consideredMinutes: summary.consideredMinutes, requiredMinutes: summary.requiredMinutes, projectedBalanceMinutes: summary.consideredMinutes - summary.requiredMinutes, status: data.monthlyTimesheets?.every(m => m.status === "CLOSED") ? "CLOSED" : "OPEN" };
    data.metrics = { ...data.metrics, activeContractors: summary.activeContractors, workedMinutes: summary.workedMinutes, requiredMinutes: summary.requiredMinutes, estimatedRequiredPersonMonths: summary.estimatedRequiredPersonMonths, pendingRequests: data.requests.filter(r => r.status === "REQUESTED").length, pendingAuthorizations: data.authorizations.filter(a => (a.status === "REQUESTED" || a.status === "NEEDS_ADJUSTMENT")).length, pendingOccurrences: data.occurrences.filter(o => o.status === "REQUESTED").length };
    // Deliberately malformed response tests the UI's defensive UNKNOWN state.
    // Keep persisted fixture sheets valid for the real summary calculator.
    if ((scenario === "overview" || scenario === "many") && data.period.from.startsWith("2026-08")) {
      const duplicate = data.monthlyTimesheets?.find(sheet => sheet.contractorId === "person-6");
      if (duplicate) data.monthlyTimesheets!.push({ ...duplicate, id:"duplicate-response-only" });
    }
    return data;
  }
  const snapshot = () => structuredClone({ entries: [...dashboards.values()].flatMap(m => m.entries), versions });
  const fullSnapshot = () => structuredClone({ dashboards: [...dashboards.entries()], versions });
  const history = (id: string) => async () => {
    const mode = controls.historyMode;
    if (mode === "slow") await pause(2500);
    if (mode === "error") return Response.json({ error: "Falha fictícia no histórico" }, { status: 503 });
    const names = new Map([...august.contractors.map(person => [person.id, person.name] as const), ["test-rh", "Marina Exemplo"] as const]);
    return Response.json({ timezone: "America/Sao_Paulo", versions: mode === "empty" ? [] : structuredClone(versions[id] ?? []).map(version => ({ ...version, changed_by_name: names.get(version.changed_by) ?? null })) });
  };
  const raw = (entry: DashboardEntry) => ({ start_time: entry.startTime, end_time: entry.endTime, break_minutes: entry.breakMinutes, calculated_minutes: entry.calculatedMinutes, notes: entry.notes });
  const { request, calls } = createMockRequest({
    // Transport fixture only: 8h is a deterministic UI error threshold, not a business policy.
    "POST /api/leave-requests": (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (!Number.isInteger(body.requestedMinutes) || body.requestedMinutes <= 0) return Response.json({ error: "Quantidade fictícia inválida." }, { status: 400 });
      if (body.requestedMinutes > 480) return Response.json({ error: "Saldo fictício insuficiente. Neste ensaio, use até 8 horas." }, { status: 409 });
      const contractorId = role === "pj" ? "person-1" : body.contractorId;
      const [year, month] = String(body.startDate).split("-").map(Number);
      const data = getMonth(year, month);
      const person = data.contractors.find(p => p.id === contractorId);
      if (!person) return Response.json({ error: "Pessoa fora da fixture." }, { status: 404 });
      const item = { id: "fixture-leave-" + (data.requests.length + 1), contractorId, contractorName: person.name,
        startDate: body.startDate, endDate: body.endDate, requestedMinutes: body.requestedMinutes,
        reservedMinutes: 0, status: "REQUESTED", reason: body.reason, requestedAt: "2026-09-05T12:00:00Z", decisionNotes: "" };
      data.requests.push(item);
      return Response.json({ id: item.id, status: item.status, message: "Solicitação fictícia enviada. Nenhum dado real foi alterado." }, { status: 201 });
    },
    "POST /api/timesheets": async (_url: URL, init: RequestInit) => {
      if (role === "pj") return Response.json({ error: "Apenas o RH pode fechar o mês." }, { status: 403 });
      const body = JSON.parse(String(init.body));
      if (body.action !== "CLOSE") return Response.json({ error: "Ação fora deste ensaio." }, { status: 400 });
      if (controls.closingMode === "partial" && body.contractorId === "person-2") return Response.json({ error: "Pendência fictícia impede o fechamento." }, { status: 409 });
      const [result] = await closingSubmit({ year: body.year, month: body.month, contractorIds: [body.contractorId] });
      if (!["closed", "already-closed"].includes(result.status)) return Response.json({ error: result.message }, { status: 409 });
      return Response.json({ action: "CLOSE", result: { timesheetId: `ts_${body.contractorId}_${body.year}_${body.month}`, alreadyClosed: result.status === "already-closed" } });
    },
    "GET /api/dashboard": async (url: URL) => {
      const omitAna = controls.omitAnaOnce; controls.omitAnaOnce = false;
      const data = consult(url, omitAna);
      const fail = controls.failDashboard; controls.failDashboard = false;
      if (controls.delayAugust && data.period.from.startsWith("2026-08")) await pause(2500);
      return fail ? Response.json({ error: "Falha fictícia na consulta" }, { status: 503 }) : Response.json(data);
    },
    "GET /api/admin/users": () => Response.json(makeAdminData()),
    "GET /api/time-entries/entry-1/history": history("entry-1"),
    "GET /api/time-entries/entry-2/history": history("entry-2"),
    "POST /api/time-entries": (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const data = [...dashboards.values()].find(m => m.entries.some(e => e.contractorId === body.contractorId && e.workDate === body.workDate));
      const entry = data?.entries.find(e => e.contractorId === body.contractorId && e.workDate === body.workDate);
      if (!data || !entry) return Response.json({ error: "Dia fora da fixture" }, { status: 404 });
      if (data.monthlyTimesheets?.find(m => m.contractorId === body.contractorId)?.status === "CLOSED") return Response.json({ error: "Mês fictício fechado" }, { status: 409 });
      const previous_data = raw(entry);
      entry.startTime = body.startTime; entry.endTime = body.endTime; entry.breakMinutes = body.breakMinutes; entry.notes = body.notes;
      const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
      entry.calculatedMinutes = minutes(entry.endTime) - minutes(entry.startTime) - entry.breakMinutes; entry.eligibleMinutes = entry.calculatedMinutes;
      versions[entry.id] ??= [];
      versions[entry.id].push({ id: "fixture-version-" + versions[entry.id].length, version_number: versions[entry.id].length + 2, previous_data, new_data: raw(entry), changed_by: role === "pj" ? "person-1" : "test-rh", change_reason: body.changeReason, changed_at: "2026-09-03T12:00:00Z" });
      const sheet = data.monthlyTimesheets?.find(m => m.contractorId === entry.contractorId);
      if (sheet) { sheet.workedMinutes = data.entries.filter(e => e.contractorId === entry.contractorId).reduce((n, e) => n + e.calculatedMinutes, 0); sheet.consideredMinutes = sheet.workedMinutes + sheet.creditedMinutes; }
      if (controls.failRefreshAfterSave) controls.failDashboard = true;
      return Response.json({ message: "Dia fictício salvo; versão anterior preservada." });
    },
    "POST /api/non-business-authorizations": (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const data = [...dashboards.values()].find(m => m.entries.some(e => e.contractorId === body.contractorId && e.workDate === body.workDate));
      if (!data) return Response.json({ error: "Dia fora da fixture" }, { status: 404 });
      data.authorizations.push({ id: "fixture-auth-1", contractorId: body.contractorId, contractorName: data.contractors.find(p => p.id === body.contractorId)!.name, workDate: body.workDate, estimatedMinutes: body.estimatedMinutes, approvedMinutes: null, reason: body.reason, status: "REQUESTED", requestedAt: "2026-09-03T12:00:00Z", decisionNotes: "" });
      return Response.json({ message: "Solicitação fictícia criada" });
    },
    "PATCH /api/non-business-authorizations": (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const data = [...dashboards.values()].find(m => m.authorizations.some(a => a.id === body.id));
      const item = data?.authorizations.find(a => a.id === body.id);
      if (!data || !item) return Response.json({ error: "Autorização fora da fixture" }, { status: 404 });
      item.status = body.action === "APPROVE" ? "APPROVED" : body.action === "REJECT" ? "REJECTED" : "NEEDS_ADJUSTMENT";
      if (item.status === "APPROVED") { const entry = data.entries.find(e => e.contractorId === item.contractorId && e.workDate === item.workDate); if (entry) entry.nonBusinessDayStatus = "AUTHORIZED"; }
      return Response.json({ message: "Decisão fictícia registrada" });
    },
  });
  const closingSubmit: ClosingSubmit = async command => {
    closingCalls.push(structuredClone(command));
    if (controls.closingMode === "slow") await pause(2500);
    if (controls.closingMode === "uncertain") throw Error("Falha fictícia de transporte");
    return command.contractorIds.map((contractorId, index): ClosingResult => {
      if (controls.closingMode === "partial" && index > 0) return { contractorId, status: "failed", message: "Falha fictícia, sem reenvio automático" };
      const sheet = dashboards.get(command.year + "-" + command.month)?.monthlyTimesheets?.find(m => m.contractorId === contractorId);
      if (!sheet) return { contractorId, status: "blocked", message: "Sem registro mensal fictício" };
      if (sheet.status === "CLOSED") return { contractorId, status: "already-closed" };
      sheet.status = "CLOSED"; sheet.closedAt = "2026-09-03T12:00:00Z"; sheet.closedByName = "RH de teste";
      return { contractorId, status: "closed" };
    });
  };
  const initialDashboard = consult(new URL(scenario === "range" ? "https://horus.invalid/api/dashboard?from=2026-08-03&to=2026-08-15" : "https://horus.invalid/api/dashboard?year=2026&month=8"));
  const configure = (settings: Partial<typeof controls>) => Object.assign(controls, settings);
  return { request, calls, closingSubmit, closingCalls, controls, configure, initialDashboard, snapshot, fullSnapshot };
}

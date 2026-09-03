"use client";

import { FormEvent, useCallback, useMemo, useReducer, useRef, useState } from "react";
import { entryEditBlockReason, saveThenRefresh, selectableContractors, type EntriesDisplayMode } from "./entries-model";
import { EntryHistory, type HistoryState, type HistoryVersion } from "./EntryHistory";
import { Modal } from "./Modal";
import { PeriodPicker } from "./PeriodPicker";
import { asFullMonth, monthPeriod, periodQuery, samePeriod } from "./period";
import { firstVisitPeriod, initialWorkspace, workspaceKey, workspaceReducer } from "./workspace-state";
import { AdminView } from "./AdminView";
import { ClosingOverview } from "./ClosingOverview";
import { ClosingConfirmation } from "./ClosingConfirmation";
import type { ClosingCommand, ClosingIssue, ClosingRow, ClosingSubmit } from "./closing-model";
import { createClosingSubmit, type WorkflowRequest } from "./closing-client";
import { DeveloperViewBanner } from "./DeveloperViewBanner";
import type { AdminData, AdminUser } from "./admin-types";
import type { DashboardData, DashboardEntry, DashboardPeriod } from "./dashboard-types";
import { SelectMenu } from "./SelectMenu";
import {
  BalanceView, EntriesView, formatDate, formatMinutes, Overview, ReportsView,
  RequestsView, type Role, type Section, TeamView,
} from "./HorusViews";

type User = { name: string; email: string };
type AccountRole = "dev" | Role;
type ModalKind = "closing" | "entry" | "history" | "occurrence" | "leave" | "authorization" | "contractor" | "contractorPassword" | "policy" | null;
type Confirmation = { title: string; description: string; confirmLabel: string; reasonRequired: boolean; danger?: boolean; onConfirm: (reason: string) => Promise<void> } | null;

const rhNavItems: Array<{ id: Section; label: string; icon: string; devOnly?: boolean }> = [
  { id: "overview", label: "Painel", icon: "⌂" },
  { id: "entries", label: "Lançamentos", icon: "▷" },
  { id: "requests", label: "Aprovações", icon: "◇" },
  { id: "closing", label: "Fechamento do mês", icon: "◫" },
  { id: "team", label: "Pessoas", icon: "◎" },
  { id: "reports", label: "Relatórios", icon: "↗" },
  { id: "admin", label: "Administração", icon: "⚙", devOnly: true },
];
const collaboratorNavItems: Array<{ id: Section; label: string; icon: string }> = [
  { id: "entries", label: "Meu mês", icon: "▷" },
  { id: "balance", label: "Banco de horas", icon: "◫" },
  { id: "requests", label: "Solicitações", icon: "◇" },
];
const sectionNames: Record<Section, string> = { overview: "Painel", entries: "Lançamentos", balance: "Banco de horas", requests: "Solicitações", closing: "Fechamento do mês", team: "Pessoas", reports: "Relatórios", admin: "Administração" };

function minutesBetween(start: string, end: string, breakMinutes: number) {
  const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, eh * 60 + em - sh * 60 - sm - breakMinutes);
}
function hoursToMinutes(value: string) { const hours = Number(value.replace(",", ".")); return Number.isFinite(hours) ? Math.round(hours * 60) : 0; }
function minutesToHours(value: number) { return (value / 60).toFixed(value % 60 === 0 ? 0 : 2); }

export function HorusApp({ user, accountRole, organizationName, initialDashboard, request = fetch, closingSubmit, closingEnabled = false, closingTestMode = false }: { request?: WorkflowRequest; closingSubmit?: ClosingSubmit; closingEnabled?: boolean; closingTestMode?: boolean; user: User; accountRole: AccountRole; organizationName: string; initialDashboard: DashboardData }) {
  const isDev = accountRole === "dev";
  const [viewMode, setViewMode] = useState<"rh" | "pj">(accountRole === "pj" ? "pj" : "rh");
  const role: Role = viewMode;
  const submitClosing = useMemo(() => role !== "rh" ? undefined : closingTestMode && closingSubmit ? closingSubmit : closingEnabled ? createClosingSubmit(request) : undefined, [role, closingEnabled, closingTestMode, closingSubmit, request]);
  const [section, setSection] = useState<Section>(role === "rh" ? "overview" : "entries");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaces, dispatchWorkspace] = useReducer(workspaceReducer, undefined, () => initialWorkspace(workspaceKey(role, role === "rh" ? "overview" : "entries"), initialDashboard));
  const requestCounter = useRef(0);
  const latestRequests = useRef(new Map<string, number>());
  const mutationInFlight = useRef(false);
  const [closingReview, setClosingReview] = useState<{ command: ClosingCommand; rows: ClosingRow[] } | null>(null);
  const [requestFocus, setRequestFocus] = useState<ClosingIssue | undefined>(undefined);
  const [entryContractorId, setEntryContractorId] = useState<string | null>(null);
  const [entryDisplayMode, setEntryDisplayMode] = useState<EntriesDisplayMode>("collaborator");
  const [entryWorkDate, setEntryWorkDate] = useState("");
  const [refreshNotice, setRefreshNotice] = useState(false);
  const [rhDashboard, setRhDashboard] = useState(initialDashboard); const [viewedContractorId, setViewedContractorId] = useState("");
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const activeViewAs = isDev && viewMode === "pj" ? viewedContractorId : "";
  const activeKey = workspaceKey(role, section, activeViewAs);
  const activeSlot = workspaces[activeKey];
  const dashboard = activeSlot?.data ?? { ...initialDashboard, contractors: [], entries: [], monthlyTimesheets: undefined, requests: [], occurrences: [], authorizations: [], balanceLots: [], balanceTransactions: [], audits: [] };
  const dashboardQuery = periodQuery(activeSlot?.period ?? initialDashboard.period);
  const [loading, setLoading] = useState(false); const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ModalKind>(null); const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [editingEntry, setEditingEntry] = useState<DashboardEntry | null>(null); const [historyEntry, setHistoryEntry] = useState<DashboardEntry | null>(null);
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);
  const historyRequestId = useRef(0); const today = new Date().toISOString().slice(0, 10);
  const [entryForm, setEntryForm] = useState({ contractorId: "", date: today, start: "08:00", end: "17:30", breakMinutes: "60", notes: "", changeReason: "" });
  const [occurrenceForm, setOccurrenceForm] = useState({ contractorId: "", type: "MEDICAL_CERTIFICATE", startDate: today, endDate: today, hours: "8", effect: "CREDITS_HOURS", description: "" });
  const [leaveForm, setLeaveForm] = useState({ contractorId: "", startDate: today, endDate: today, hours: "8", reason: "" });
  const [authorizationForm, setAuthorizationForm] = useState({ contractorId: "", workDate: today, hours: "8", reason: "" });
  const [contractorForm, setContractorForm] = useState({ name: "", email: "", password: "" });
  const [contractorPasswordForm, setContractorPasswordForm] = useState({ id: "", name: "", password: "", scope: "team" as "team" | "admin" });
  const [policyForm, setPolicyForm] = useState({ monthlyHours: minutesToHours(initialDashboard.policy.monthlyRequiredMinutes), minimumNotice: String(initialDashboard.policy.minimumLeaveNoticeDays ?? ""), batchThreshold: String(initialDashboard.policy.retroactiveBatchThreshold), deadlinePolicy: initialDashboard.policy.positiveBalanceAfterDeadlinePolicy, applyToOpenBalances: false, reason: "" });
  const calculated = useMemo(() => minutesBetween(entryForm.start, entryForm.end, Number(entryForm.breakMinutes)), [entryForm]);
  const initials = user.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const visibleNav = role === "rh" ? rhNavItems.filter((item) => !item.devOnly || isDev) : collaboratorNavItems;
  const pendingCount = activeSlot?.data ? dashboard.metrics.pendingRequests + dashboard.metrics.pendingOccurrences + dashboard.metrics.pendingAuthorizations : 0;


  function closeModal() { historyRequestId.current += 1; setModal(null); setHistoryState(null); }
  function requestCloseModal() { if (!mutationInFlight.current) closeModal(); }
  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 5200); }
  function openSection(next: Section) {
    if (loading || mutationInFlight.current) return;
    const key = workspaceKey(role, next, activeViewAs);
    const source = activeSlot?.period ?? null;
    const period = firstVisitPeriod(next, source, initialDashboard.period);
    dispatchWorkspace({ type: "open", key, period });
    closeModal(); setRequestFocus(undefined); setConfirmation(null); setSection(next); setSidebarOpen(false);
    if (next === "admin" && isDev) void fetchAdmin();
    const targetPeriod = workspaces[key] ? workspaces[key].period : period;
    if (next !== "admin" && targetPeriod && !workspaces[key]?.data && !workspaces[key]?.loading) void loadWorkspace(key, targetPeriod, activeViewAs).catch(() => {});
  }
  const loadWorkspace = useCallback(async (key: string, period: DashboardPeriod, viewAs = "") => {
    const requestId = ++requestCounter.current;
    latestRequests.current.set(key, requestId);
    dispatchWorkspace({ type: "start", key, period, requestId });
    try {
      const params = new URLSearchParams(periodQuery(period));
      if (viewAs) params.set("viewAs", viewAs);
      const response = await request("/api/dashboard?" + params.toString(), { cache: "no-store" });
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw Error(result.error || "Não foi possível carregar este mês.");
      if (!result.period || !samePeriod(period, result.period) || !Array.isArray(result.contractors) || !Array.isArray(result.entries)) throw Error("A resposta não corresponde ao período escolhido.");
      if (viewAs && (result.contractors.some(person => person.id !== viewAs) || result.entries.some(entry => entry.contractorId !== viewAs))) throw Error("A resposta não corresponde ao colaborador escolhido.");
      dispatchWorkspace({ type: "success", key, requestId, data: result });
      if (latestRequests.current.get(key) === requestId) {
        if (key.startsWith("rh:")) setRhDashboard(result);
        if (key === "rh:self:entries" && entryContractorId && !selectableContractors(result).some(person => person.id === entryContractorId)) {
          setEntryContractorId(null);
          setNotice("O filtro de colaborador foi removido porque essa pessoa não está disponível neste mês.");
        }
      }
      return result;
    } catch (error) {
      dispatchWorkspace({ type: "failure", key, requestId, message: error instanceof Error ? error.message : "Não foi possível carregar este mês." });
      throw error;
    }
  }, [request, entryContractorId]);
  function changePeriod(period: DashboardPeriod) {
    if (loading || mutationInFlight.current) return;
    closeModal(); setConfirmation(null);
    if (section === "entries" && role === "rh") setEntryWorkDate(period.from);
    void loadWorkspace(activeKey, period, activeViewAs).catch(() => {});
  }
  async function fetchDashboard(query = dashboardQuery, viewAs = activeViewAs) {
    const params = new URLSearchParams(query);
    const from = params.get("from"), to = params.get("to");
    const period = from && to ? { from, to, year: null, month: null } : monthPeriod(Number(params.get("year")), Number(params.get("month")));
    return loadWorkspace(workspaceKey(viewAs ? "pj" : role, section, viewAs), period, viewAs);
  }
  async function refreshDashboard() {
    if (!activeSlot?.period) return;
    try { await loadWorkspace(activeKey, activeSlot.period, activeViewAs); } catch { /* The workspace displays the retryable error. */ }
  }
  async function mutate(path: string, method: "POST" | "PATCH", body: unknown, success: string, dismissModal = true) {
    if (mutationInFlight.current || (isDev && viewMode === "pj")) return false;
    mutationInFlight.current = true; setLoading(true); setRefreshNotice(false);
    let rejected = false;
    let message = success;
    try {
      const outcome = await saveThenRefresh(async () => {
        const response = await request(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        rejected = [400, 401, 403, 404, 409, 422].includes(response.status);
        const result = await response.json() as { error?: string; message?: string };
        if (!response.ok) throw Error(result.error || "Não foi possível concluir a ação.");
        message = result.message || success;
        if (dismissModal) closeModal();
        latestRequests.current.clear();
        dispatchWorkspace({ type: "invalidate" });
      }, async () => { await fetchDashboard(); });
      if (outcome === "saved-refresh-failed") {
        setRefreshNotice(true);
        showNotice("Salvo. Não foi possível atualizar o resumo; tente atualizar a consulta.");
      } else showNotice(message);
      return true;
    } catch (error) {
      if (rejected) showNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
      else {
        closeModal(); setConfirmation(null); latestRequests.current.clear();
        dispatchWorkspace({ type: "invalidate" });
        showNotice("Não foi possível confirmar a gravação. Consulte os dados atualizados antes de tentar novamente.");
        try { await fetchDashboard(); } catch { /* Keep the failed consultation visible. */ }
      }
      return false;
    } finally { mutationInFlight.current = false; setLoading(false); }
  }

  async function fetchAdmin() {
    setLoading(true);
    try {
      const response = await request("/api/admin/users", { cache: "no-store" });
      const result = await response.json() as AdminData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar a Administração.");
      setAdminData(result);
    } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível carregar a Administração."); }
    finally { setLoading(false); }
  }

  async function adminMutate(method: "PATCH", body: unknown, success: string, dismissModal = true) {
    const saved = await mutate("/api/admin/users", method, body, success, dismissModal);
    if (saved) await fetchAdmin();
    return saved;
  }

  function switchToRh() {
    if (!isDev || loading || mutationInFlight.current) return;
    const key = workspaceKey("rh", "overview");
    const period = workspaces[key] ? workspaces[key].period : activeSlot?.period ?? null;
    dispatchWorkspace({ type: "open", key, period });
    if (period && !workspaces[key]?.data && !workspaces[key]?.loading) void loadWorkspace(key, period).catch(() => {});
    closeModal(); setRequestFocus(undefined); setConfirmation(null); setViewMode("rh"); setViewedContractorId(""); setSection("overview"); setSidebarOpen(false);
  }
  function switchToContractor(contractorId?: string) {
    if (!isDev || loading || mutationInFlight.current) return;
    const targetId = contractorId || rhDashboard.contractors.find(person => person.status === "ACTIVE")?.id || rhDashboard.contractors[0]?.id;
    if (!targetId) { showNotice("Cadastre um colaborador antes de abrir essa visualização."); return; }
    const source = activeSlot?.period;
    const key = workspaceKey("pj", "entries", targetId);
    const period = workspaces[key] ? workspaces[key].period : source ? asFullMonth(source) : null;
    dispatchWorkspace({ type: "open", key, period });
    if (period && !workspaces[key]?.data && !workspaces[key]?.loading) void loadWorkspace(key, period, targetId).catch(() => {});
    closeModal(); setConfirmation(null); setViewMode("pj"); setViewedContractorId(targetId); setSection("entries"); setSidebarOpen(false);
  }

  async function openClosingIssue(issue: ClosingIssue) {
    if (loading || mutationInFlight.current || !activeSlot?.data) return;
    const period = asFullMonth(activeSlot.data.period);
    if (!period) return;
    closeModal(); setConfirmation(null);
    const token = historyRequestId.current;
    setRequestFocus(structuredClone(issue)); setSection("requests");
    try {
      const result = await loadWorkspace(workspaceKey("rh", "requests"), period);
      if (historyRequestId.current !== token) return;
      if (issue.kind === "entry-authorization" && result.entries.some(entry => entry.id === issue.sourceId && entry.contractorId === issue.contractorId && entry.workDate === issue.workDate)) {
        setAuthorizationForm({ contractorId: issue.contractorId, workDate: issue.workDate, hours: "8", reason: "" }); setModal("authorization");
      }
    } catch { /* Retryable consultation error is visible; no decision is sent. */ }
  }
  function defaultContractorId() { return dashboard.contractors.find((person) => person.status === "ACTIVE")?.id ?? ""; }
  function openNewEntry() { setEditingEntry(null); setEntryForm({ contractorId: defaultContractorId(), date: today, start: "08:00", end: "17:30", breakMinutes: "60", notes: "", changeReason: "" }); setModal("entry"); }
  function openEditEntry(entry: DashboardEntry) {
    const blocked = entryEditBlockReason(dashboard, entry, isDev && viewMode === "pj");
    if (blocked || !activeSlot?.data || loading) { if (blocked) showNotice(blocked); return; }
    setEditingEntry(entry); setEntryForm({ contractorId: entry.contractorId, date: entry.workDate, start: entry.startTime, end: entry.endTime, breakMinutes: String(entry.breakMinutes), notes: entry.notes, changeReason: "" }); setModal("entry"); }
  async function openHistory(entry: DashboardEntry) {
    if (loading || !activeSlot?.data) return;
    const token = ++historyRequestId.current;
    setHistoryEntry(entry); setHistoryState({ status: "loading", entryId: entry.id }); setModal("history");
    try {
      const response = await request("/api/time-entries/" + entry.id + "/history", { cache: "no-store" });
      const result = await response.json() as { versions?: HistoryVersion[]; error?: string };
      if (!response.ok) throw Error(result.error || "Não foi possível carregar o histórico.");
      if (!Array.isArray(result.versions) || result.versions.some(version => !version || !version.previous_data || !version.new_data)) throw Error("A resposta do histórico está incompleta.");
      if (token === historyRequestId.current) setHistoryState({ status: "ready", entryId: entry.id, versions: result.versions });
    } catch (error) {
      if (token === historyRequestId.current) setHistoryState({ status: "error", entryId: entry.id, message: error instanceof Error ? error.message : "Não foi possível carregar o histórico." });
    }
  }
  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await mutate("/api/time-entries", "POST", { contractorId: entryForm.contractorId, workDate: entryForm.date, startTime: entryForm.start, endTime: entryForm.end, breakMinutes: Number(entryForm.breakMinutes), notes: entryForm.notes, changeReason: entryForm.changeReason }, editingEntry ? "Lançamento corrigido e versão anterior preservada." : "Lançamento salvo.");
  }
  async function submitOccurrence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await mutate("/api/occurrences", "POST", { contractorId: occurrenceForm.contractorId, type: occurrenceForm.type, startDate: occurrenceForm.startDate, endDate: occurrenceForm.endDate, minutes: hoursToMinutes(occurrenceForm.hours), calculationEffect: occurrenceForm.effect, description: occurrenceForm.description }, role === "rh" ? "Ocorrência registrada e cálculos atualizados." : "Ocorrência enviada ao RH.");
  }
  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await mutate("/api/leave-requests", "POST", { contractorId: leaveForm.contractorId, startDate: leaveForm.startDate, endDate: leaveForm.endDate, requestedMinutes: hoursToMinutes(leaveForm.hours), reason: leaveForm.reason }, "Solicitação de folga enviada.");
  }
  async function submitAuthorization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await mutate("/api/non-business-authorizations", "POST", { contractorId: authorizationForm.contractorId, workDate: authorizationForm.workDate, estimatedMinutes: hoursToMinutes(authorizationForm.hours), reason: authorizationForm.reason }, "Solicitação de trabalho em dia não útil enviada.");
  }
  async function submitContractor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const success = await mutate("/api/team", "POST", contractorForm, "Colaborador cadastrado com acesso por senha."); if (success) setContractorForm({ name: "", email: "", password: "" });
  }
  async function submitContractorPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = contractorPasswordForm.scope === "admin"
      ? await adminMutate("PATCH", { id: contractorPasswordForm.id, action: "SET_PASSWORD", password: contractorPasswordForm.password }, "Senha do usuário atualizada.")
      : await mutate("/api/team", "PATCH", { id: contractorPasswordForm.id, action: "SET_PASSWORD", password: contractorPasswordForm.password }, "Senha do colaborador atualizada.");
    if (success) setContractorPasswordForm({ id: "", name: "", password: "", scope: "team" });
  }
  async function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await mutate("/api/policies", "PATCH", { monthlyRequiredMinutes: hoursToMinutes(policyForm.monthlyHours), minimumLeaveNoticeDays: policyForm.minimumNotice === "" ? null : Number(policyForm.minimumNotice), retroactiveBatchThreshold: Number(policyForm.batchThreshold), positiveBalanceAfterDeadlinePolicy: policyForm.deadlinePolicy, applyToOpenBalances: policyForm.applyToOpenBalances, reason: policyForm.reason }, "Políticas atualizadas e registradas na auditoria.");
  }
  async function decide(resource: "leave-requests" | "occurrences" | "non-business-authorizations", id: string, action: string) {
    const label = action === "APPROVE" ? "aprovar" : action === "REJECT" ? "rejeitar" : action === "UTILIZE" ? "confirmar a utilização" : action === "CANCEL" ? "cancelar" : "solicitar ajuste em";
    setConfirmation({ title: "Confirmar decisão", description: `Deseja ${label} este registro?`, confirmLabel: "Confirmar", reasonRequired: action === "REJECT" || action === "NEEDS_ADJUSTMENT", onConfirm: async (reason) => { const ok = await mutate(`/api/${resource}`, "PATCH", { id, action, notes: reason }, "Decisão registrada.", false); if (ok) setConfirmation(null); } });
  }
  function changeContractorStatus(id: string, next: "ACTIVE" | "INACTIVE") {
    setConfirmation({ title: next === "INACTIVE" ? "Inativar colaborador" : "Reativar colaborador", description: next === "INACTIVE" ? "O colaborador perderá o acesso, mas todo o histórico será preservado." : "O colaborador voltará a poder acessar o Horus.", confirmLabel: next === "INACTIVE" ? "Inativar" : "Reativar", reasonRequired: true, onConfirm: async (reason) => { const ok = await mutate("/api/team", "PATCH", { id, status: next, reason }, "Situação do colaborador atualizada.", false); if (ok) setConfirmation(null); } });
  }
  function changeUserRole(userToChange: AdminUser, next: "RH" | "PJ") {
    if (userToChange.role === next) return;
    setConfirmation({ title: "Alterar perfil do usuário", description: `${userToChange.name} passará de ${userToChange.role === "PJ" ? "Colaborador" : "RH"} para ${next === "PJ" ? "Colaborador" : "RH"}. O histórico será preservado.`, confirmLabel: "Alterar perfil", reasonRequired: true, onConfirm: async (reason) => { const ok = await adminMutate("PATCH", { id: userToChange.id, action: "SET_ROLE", role: next, reason }, "Perfil atualizado.", false); if (ok) setConfirmation(null); } });
  }
  function changeUserStatus(userToChange: AdminUser, next: "ACTIVE" | "INACTIVE") {
    if (userToChange.status === next) return;
    setConfirmation({ title: next === "INACTIVE" ? "Inativar usuário" : "Reativar usuário", description: next === "INACTIVE" ? `${userToChange.name} perderá o acesso, mas o histórico será preservado.` : `${userToChange.name} voltará a ter acesso ao Horus.`, confirmLabel: next === "INACTIVE" ? "Inativar" : "Reativar", reasonRequired: true, onConfirm: async (reason) => { const ok = await adminMutate("PATCH", { id: userToChange.id, action: "SET_STATUS", status: next, reason }, "Situação atualizada.", false); if (ok) setConfirmation(null); } });
  }

  return <div className="app-shell">
    <button className="mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-label="Abrir menu" aria-expanded={sidebarOpen} aria-controls="main-sidebar"><span /><span /></button>
    <aside id="main-sidebar" className={"sidebar " + (sidebarOpen ? "sidebar-open" : "")}><button className="brand" onClick={() => openSection(role === "rh" ? "overview" : "entries")}><span className="brand-mark">H</span><span><strong>horus</strong><small>HORAS TÉCNICAS</small></span></button>{isDev ? <div className="dev-mode-panel"><span>MODO DEV</span><div className="dev-mode-buttons"><button disabled={loading} className={viewMode === "rh" ? "active" : ""} onClick={() => void switchToRh()}>Visão RH</button><button disabled={loading} className={viewMode === "pj" ? "active" : ""} onClick={() => void switchToContractor()}>Visualizar como colaborador</button></div>{viewMode === "pj" && <div className="dev-view-selector"><span>Visualizar como</span><SelectMenu variant="dark" ariaLabel="Colaborador visualizado" disabled={loading} value={viewedContractorId} onChange={(value) => void switchToContractor(value)} options={rhDashboard.contractors.map((person) => ({ value: person.id, label: person.name, description: person.status === "INACTIVE" ? "Cadastro inativo" : "Colaborador ativo" }))} /></div>}</div> : <div className="role-switch actual-role" aria-label="Perfil autorizado"><button className="active" disabled>{role === "rh" ? "RH" : "Colaborador"}</button></div>}<nav aria-label="Navegação principal"><p className="nav-caption">ESPAÇO DE TRABALHO</p>{visibleNav.map((item) => <button key={item.id} className={section === item.id ? "nav-active" : ""} onClick={() => openSection(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "requests" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="profile-card"><div className="avatar">{initials}</div><div><strong>{user.name}</strong><span>{isDev ? "Desenvolvedor" : role === "rh" ? "Recursos Humanos" : "Colaborador"}</span></div><form action="/api/auth/sign-out" method="post"><button type="submit" aria-label="Sair da conta">Sair</button></form></div></div></aside>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
    <main className="main-content"><header className="topbar"><div className="breadcrumb"><span>Horus</span><b>/</b>{sectionNames[section]}</div><div className="topbar-actions"><div className="organization-button"><span className="org-monogram">{organizationName.slice(0, 1).toUpperCase()}</span><span>{organizationName}</span></div></div></header>{notice && <div className="toast" role="status" aria-live="polite">{notice}{refreshNotice && <button type="button" onClick={() => void refreshDashboard()}>Atualizar consulta</button>}</div>}{(loading || activeSlot?.loading) && <div className="loading-line" role="status" aria-label="Atualizando dados">Atualizando dados…</div>}<div className="content-wrap">{isDev && viewMode === "pj" && <DeveloperViewBanner collaboratorName={rhDashboard.contractors.find(person => person.id === viewedContractorId)?.name ?? "colaborador selecionado"} onBack={() => void switchToRh()} />}
      {["overview", "entries", "closing", "reports"].includes(section) && <PeriodPicker value={activeSlot?.period ?? null} busy={loading} allowRange={section === "overview" || section === "reports"} onChange={changePeriod} />}
      {section !== "admin" && !activeSlot?.data && <section className="panel workspace-status" role={activeSlot?.error ? "alert" : "status"}>
        <h1>{sectionNames[section]}</h1>
        <p>{activeSlot?.error ? "Não foi possível carregar este mês. " + activeSlot.error : activeSlot?.period ? "Carregando o período escolhido…" : "Escolha o mês para consultar esta tela."}</p>
        {activeSlot?.error && <button type="button" className="secondary-button" onClick={() => void refreshDashboard()}>Tentar novamente</button>}
      </section>}
      {activeSlot?.data && section === "overview" && role === "rh" && <Overview data={dashboard} onNavigate={openSection} />}
      {activeSlot?.data && section === "entries" && <EntriesView role={role} data={dashboard} contractorId={entryContractorId} onContractorChange={setEntryContractorId} displayMode={entryDisplayMode} onDisplayModeChange={setEntryDisplayMode} workDate={entryWorkDate} onWorkDateChange={setEntryWorkDate} readOnly={isDev && viewMode === "pj"} onNew={openNewEntry} onEdit={openEditEntry} onHistory={openHistory} />}
      {activeSlot?.data && section === "balance" && <BalanceView data={dashboard} />}
      {activeSlot?.data && section === "requests" && <RequestsView data={dashboard} role={role} requestFocus={requestFocus} onClearFocus={() => setRequestFocus(undefined)} readOnly={isDev && viewMode === "pj"} onNewOccurrence={() => { setOccurrenceForm({ contractorId: defaultContractorId(), type: "MEDICAL_CERTIFICATE", startDate: today, endDate: today, hours: "8", effect: "CREDITS_HOURS", description: "" }); setModal("occurrence"); }} onNewLeave={() => { setLeaveForm({ contractorId: defaultContractorId(), startDate: today, endDate: today, hours: "8", reason: "" }); setModal("leave"); }} onNewAuthorization={() => { setAuthorizationForm({ contractorId: requestFocus?.contractorId ?? defaultContractorId(), workDate: requestFocus?.workDate ?? today, hours: "8", reason: "" }); setModal("authorization"); }} onDecision={decide} />}
      {activeSlot?.data && section === "closing" && role === "rh" && <ClosingOverview data={dashboard} closingEnabled={Boolean(submitClosing)} onReview={(command, rows) => { setClosingReview(structuredClone({ command, rows })); setModal("closing"); }} onIssue={issue => void openClosingIssue(issue)} />}
      {activeSlot?.data && section === "team" && role === "rh" && <TeamView data={dashboard} onNew={() => setModal("contractor")} onStatus={changeContractorStatus} onSetPassword={(id, name) => { setContractorPasswordForm({ id, name, password: "", scope: "team" }); setModal("contractorPassword"); }} />}
      {activeSlot?.data && section === "reports" && role === "rh" && <ReportsView data={dashboard} onPolicy={() => { setPolicyForm({ monthlyHours: minutesToHours(dashboard.policy.monthlyRequiredMinutes), minimumNotice: String(dashboard.policy.minimumLeaveNoticeDays ?? ""), batchThreshold: String(dashboard.policy.retroactiveBatchThreshold), deadlinePolicy: dashboard.policy.positiveBalanceAfterDeadlinePolicy, applyToOpenBalances: false, reason: "" }); setModal("policy"); }} />}
      {section === "admin" && isDev && role === "rh" && <AdminView data={adminData} loading={loading} onRole={changeUserRole} onStatus={changeUserStatus} onViewAs={(target) => void switchToContractor(target.id)} onPassword={(target) => { setContractorPasswordForm({ id: target.id, name: target.name, password: "", scope: "admin" }); setModal("contractorPassword"); }} />}
    </div></main>

    {modal === "closing" && closingReview && <ClosingConfirmation command={closingReview.command} rows={closingReview.rows} submit={submitClosing} testMode={closingTestMode} onClose={requestCloseModal} onBusyChange={busy => { mutationInFlight.current = busy; setLoading(busy); }} onSettled={async () => { latestRequests.current.clear(); dispatchWorkspace({ type: "invalidate" }); await fetchDashboard(); }} />}
    {modal === "entry" && <Modal title={editingEntry ? "Editar este dia" : "Registrar horas"} eyebrow="LANÇAMENTO DIÁRIO" description={editingEntry ? editingEntry.contractorName + " · " + formatDate(editingEntry.workDate) + " — Esta alteração corrige somente este dia. O histórico é preservado." : "O servidor recalcula o total e preserva o histórico."} busy={loading} onClose={requestCloseModal}><form onSubmit={submitEntry}>{role === "rh" && <ContractorSelect value={entryForm.contractorId} onChange={(contractorId) => setEntryForm({ ...entryForm, contractorId })} data={dashboard} disabled={Boolean(editingEntry)} />}<label className="field full-field">Data trabalhada<input type="date" value={entryForm.date} max={today} onChange={(event) => setEntryForm({ ...entryForm, date: event.target.value })} required disabled={Boolean(editingEntry)} /></label><div className="form-grid"><label className="field">Entrada<input type="time" value={entryForm.start} onChange={(event) => setEntryForm({ ...entryForm, start: event.target.value })} required /></label><label className="field">Saída<input type="time" value={entryForm.end} onChange={(event) => setEntryForm({ ...entryForm, end: event.target.value })} required /></label><label className="field">Intervalo em minutos<input type="number" min="0" max="1440" value={entryForm.breakMinutes} onChange={(event) => setEntryForm({ ...entryForm, breakMinutes: event.target.value })} required /></label><div className="calculated-field"><span>Total calculado</span><strong>{formatMinutes(calculated)}</strong></div></div><label className="field full-field">Observação <em>opcional</em><textarea value={entryForm.notes} onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })} maxLength={2000} /></label>{role === "rh" && <label className="field full-field">Justificativa da correção<textarea value={entryForm.changeReason} onChange={(event) => setEntryForm({ ...entryForm, changeReason: event.target.value })} minLength={5} maxLength={2000} required /></label>}<ModalActions loading={loading} onCancel={requestCloseModal} label={editingEntry ? "Salvar correção" : "Salvar lançamento"} /></form></Modal>}
    {modal === "history" && historyState && <Modal title="Histórico deste dia" eyebrow="VERSÕES PRESERVADAS" description={historyEntry ? historyEntry.contractorName + " · " + formatDate(historyEntry.workDate) : ""} onClose={requestCloseModal}><EntryHistory state={historyState} names={new Map(dashboard.contractors.map(person => [person.id, person.name]))} onRetry={() => { if (historyEntry) void openHistory(historyEntry); }} /></Modal>}
    {modal === "occurrence" && <Modal title="Registrar ocorrência" eyebrow="AUSÊNCIA E ABONO" description={role === "rh" ? "O registro do RH entra aprovado e recalcula a competência." : "O RH analisará o efeito no cálculo."} busy={loading} onClose={requestCloseModal}><form onSubmit={submitOccurrence}>{role === "rh" && <ContractorSelect value={occurrenceForm.contractorId} onChange={(contractorId) => setOccurrenceForm({ ...occurrenceForm, contractorId })} data={dashboard} />}<div className="field full-field"><span>Tipo</span><SelectMenu ariaLabel="Tipo de ocorrência" value={occurrenceForm.type} onChange={(type) => setOccurrenceForm({ ...occurrenceForm, type })} options={[{ value: "VACATION", label: "Férias" }, { value: "MEDICAL_CERTIFICATE", label: "Atestado" }, { value: "JUSTIFIED_ABSENCE", label: "Falta justificada" }, { value: "BANK_LEAVE", label: "Folga com banco de horas" }, { value: "OTHER", label: "Outra ocorrência" }]} /></div><div className="form-grid"><label className="field">Data inicial<input type="date" value={occurrenceForm.startDate} onChange={(event) => setOccurrenceForm({ ...occurrenceForm, startDate: event.target.value })} required /></label><label className="field">Data final<input type="date" min={occurrenceForm.startDate} value={occurrenceForm.endDate} onChange={(event) => setOccurrenceForm({ ...occurrenceForm, endDate: event.target.value })} required /></label><label className="field">Quantidade de horas<input type="number" min="0" step="0.25" value={occurrenceForm.hours} onChange={(event) => setOccurrenceForm({ ...occurrenceForm, hours: event.target.value })} required /></label>{role === "rh" && <div className="field"><span>Efeito no cálculo</span><SelectMenu ariaLabel="Efeito da ocorrência no cálculo" value={occurrenceForm.effect} onChange={(effect) => setOccurrenceForm({ ...occurrenceForm, effect })} options={[{ value: "CREDITS_HOURS", label: "Abona horas", description: "Soma ao total considerado" }, { value: "DOES_NOT_CREDIT", label: "Não abona", description: "Não altera o total considerado" }, { value: "CONSUMES_BALANCE", label: "Consome banco", description: "Utiliza créditos disponíveis" }]} /></div>}</div><label className="field full-field">Descrição<textarea value={occurrenceForm.description} onChange={(event) => setOccurrenceForm({ ...occurrenceForm, description: event.target.value })} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={requestCloseModal} label={role === "rh" ? "Registrar ocorrência" : "Enviar ao RH"} /></form></Modal>}
    {modal === "leave" && <Modal title="Solicitar folga" eyebrow="USO DE CRÉDITO" description="A aprovação reserva os créditos mais antigos pelo método FIFO." busy={loading} onClose={requestCloseModal}><form onSubmit={submitLeave}>{role === "rh" && <ContractorSelect value={leaveForm.contractorId} onChange={(contractorId) => setLeaveForm({ ...leaveForm, contractorId })} data={dashboard} />}<div className="form-grid"><label className="field">Data inicial<input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm({ ...leaveForm, startDate: event.target.value })} required /></label><label className="field">Data final<input type="date" min={leaveForm.startDate} value={leaveForm.endDate} onChange={(event) => setLeaveForm({ ...leaveForm, endDate: event.target.value })} required /></label><label className="field">Quantidade de horas<input type="number" min="0.25" step="0.25" value={leaveForm.hours} onChange={(event) => setLeaveForm({ ...leaveForm, hours: event.target.value })} required /></label></div><label className="field full-field">Justificativa<textarea value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={requestCloseModal} label="Enviar solicitação" /></form></Modal>}
    {modal === "authorization" && <Modal title="Trabalho em dia não útil" eyebrow="AUTORIZAÇÃO PRÉVIA" description="Sem aprovação, o lançamento fica salvo, mas não entra no fechamento." busy={loading} onClose={requestCloseModal}><form onSubmit={submitAuthorization}>{role === "rh" && <ContractorSelect value={authorizationForm.contractorId} onChange={(contractorId) => setAuthorizationForm({ ...authorizationForm, contractorId })} data={dashboard} />}<div className="form-grid"><label className="field">Data<input type="date" value={authorizationForm.workDate} onChange={(event) => setAuthorizationForm({ ...authorizationForm, workDate: event.target.value })} required /></label><label className="field">Horas estimadas<input type="number" min="0.25" max="24" step="0.25" value={authorizationForm.hours} onChange={(event) => setAuthorizationForm({ ...authorizationForm, hours: event.target.value })} required /></label></div><label className="field full-field">Justificativa<textarea value={authorizationForm.reason} onChange={(event) => setAuthorizationForm({ ...authorizationForm, reason: event.target.value })} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={requestCloseModal} label="Enviar solicitação" /></form></Modal>}
    {modal === "contractor" && <Modal title="Novo colaborador" eyebrow="CADASTRO" description="Defina uma senha inicial e compartilhe-a com o colaborador por um canal seguro." busy={loading} onClose={requestCloseModal}><form onSubmit={submitContractor}><label className="field full-field">Nome completo<input value={contractorForm.name} onChange={(event) => setContractorForm({ ...contractorForm, name: event.target.value })} maxLength={200} required /></label><label className="field full-field">E-mail<input type="email" value={contractorForm.email} onChange={(event) => setContractorForm({ ...contractorForm, email: event.target.value })} maxLength={320} required /></label><label className="field full-field">Senha inicial<input type="password" autoComplete="new-password" value={contractorForm.password} onChange={(event) => setContractorForm({ ...contractorForm, password: event.target.value })} minLength={8} maxLength={72} required /></label><div className="audit-note"><span>◈</span><p><strong>Sem envio de magic link</strong>O colaborador também poderá entrar com o Google, desde que use o mesmo e-mail cadastrado.</p></div><ModalActions loading={loading} onCancel={requestCloseModal} label="Cadastrar colaborador" /></form></Modal>}
    {modal === "contractorPassword" && <Modal title="Definir senha" eyebrow="ACESSO DO USUÁRIO" description={`Crie uma nova senha para ${contractorPasswordForm.name}.`} busy={loading} onClose={requestCloseModal}><form onSubmit={submitContractorPassword}><label className="field full-field">Nova senha<input type="password" autoComplete="new-password" value={contractorPasswordForm.password} onChange={(event) => setContractorPasswordForm({ ...contractorPasswordForm, password: event.target.value })} minLength={8} maxLength={72} required autoFocus /></label><div className="audit-note"><span>◈</span><p><strong>Compartilhamento seguro</strong>A senha não será enviada por e-mail nem registrada na auditoria.</p></div><ModalActions loading={loading} onCancel={requestCloseModal} label="Salvar nova senha" /></form></Modal>}
    {modal === "policy" && <Modal title="Políticas da organização" eyebrow="REGRAS OPERACIONAIS" description="Alterações exigem justificativa e ficam na auditoria." busy={loading} onClose={requestCloseModal}><form onSubmit={submitPolicy}><div className="form-grid"><label className="field">Carga mensal em horas<input type="number" min="0" step="0.25" value={policyForm.monthlyHours} onChange={(event) => setPolicyForm({ ...policyForm, monthlyHours: event.target.value })} required /></label><label className="field">Aviso mínimo para folga (dias)<input type="number" min="0" value={policyForm.minimumNotice} onChange={(event) => setPolicyForm({ ...policyForm, minimumNotice: event.target.value })} /></label><label className="field">Limite do lote retroativo<input type="number" min="1" value={policyForm.batchThreshold} onChange={(event) => setPolicyForm({ ...policyForm, batchThreshold: event.target.value })} required /></label><div className="field"><span>Crédito após 90 dias</span><SelectMenu ariaLabel="Política de crédito após 90 dias" value={policyForm.deadlinePolicy} onChange={(deadlinePolicy) => setPolicyForm({ ...policyForm, deadlinePolicy: deadlinePolicy as typeof policyForm.deadlinePolicy })} options={[{ value: "ALLOW_AFTER_DEADLINE", label: "Continuar permitindo", description: "O crédito segue disponível" }, { value: "BLOCK_AFTER_DEADLINE", label: "Bloquear utilização", description: "O crédito vence após o prazo" }]} /></div></div><label className="check-field"><input type="checkbox" checked={policyForm.applyToOpenBalances} onChange={(event) => setPolicyForm({ ...policyForm, applyToOpenBalances: event.target.checked })} /><span>Aplicar a política de prazo também aos saldos antigos ainda abertos</span></label><label className="field full-field">Justificativa<textarea value={policyForm.reason} onChange={(event) => setPolicyForm({ ...policyForm, reason: event.target.value })} minLength={5} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={requestCloseModal} label="Salvar políticas" /></form></Modal>}
    {confirmation && <ConfirmationModal confirmation={confirmation} loading={loading} onClose={() => setConfirmation(null)} />}
  </div>;
}

function ModalActions({ loading, onCancel, label, danger = false }: { loading: boolean; onCancel: () => void; label: string; danger?: boolean }) { return <div className="modal-actions"><button type="button" className="secondary-button" disabled={loading} onClick={onCancel}>Cancelar</button><button className={danger ? "danger-button" : "primary-button"} type="submit" disabled={loading}>{loading ? "Processando…" : label}</button></div>; }
function ContractorSelect({ value, onChange, data, disabled = false }: { value: string; onChange: (value: string) => void; data: DashboardData; disabled?: boolean }) { return <div className="field full-field"><span>Colaborador</span><SelectMenu ariaLabel="Selecionar colaborador" value={value} onChange={onChange} disabled={disabled} options={data.contractors.filter((person) => person.status === "ACTIVE" || person.id === value).map((person) => ({ value: person.id, label: person.name, description: person.email }))} /></div>; }

function ConfirmationModal({ confirmation, loading, onClose }: { confirmation: Exclude<Confirmation, null>; loading: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await confirmation.onConfirm(reason); }
  return <Modal busy={loading} title={confirmation.title} eyebrow="CONFIRMAÇÃO" description={confirmation.description} onClose={onClose}><form onSubmit={submit}>{confirmation.reasonRequired && <label className="field full-field">Justificativa<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={2000} required autoFocus /></label>}<ModalActions loading={loading} onCancel={onClose} label={confirmation.confirmLabel} danger={confirmation.danger} /></form></Modal>;
}

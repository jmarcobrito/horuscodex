"use client";

import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AdminView } from "./AdminView";
import { ApprovalInboxView } from "./ApprovalInboxView";
import { ClosingView } from "./ClosingView";
import type { AdminData, AdminUser } from "./admin-types";
import { DailyAllocationFields, dailyAllocationPayload, type DailyHours } from "./DailyAllocationFields";
import type { DashboardData, DashboardEntry } from "./dashboard-types";
import { SelectMenu } from "./SelectMenu";
import {
  BalanceView, EntriesView, formatDate, formatMinutes, Overview, ReportsView,
  type Role, type Section, TeamView,
} from "./HorusViews";
import type { TimesheetPreview } from "../db/timesheet-preview";

type User = { name: string; email: string };
type AccountRole = "dev" | Role;
type ModalKind = "entry" | "history" | "occurrence" | "leave" | "authorization" | "contractor" | "contractorPassword" | "policy" | null;
type HistoryVersion = { id: string; version_number: number; previous_data: Record<string, unknown>; new_data: Record<string, unknown>; changed_by: string; change_reason: string | null; changed_at: string };
type Confirmation = { title: string; description: string; confirmLabel: string; reasonRequired: boolean; danger?: boolean; onConfirm: (reason: string) => Promise<void> } | null;

const navItems: Array<{ id: Section; label: string; icon: string; role: Role; devOnly?: boolean }> = [
  { id: "overview", label: "Painel", icon: "⌂", role: "rh" },
  { id: "entries", label: "Lançamentos", icon: "▷", role: "rh" },
  { id: "approvals", label: "Aprovações", icon: "◇", role: "rh" },
  { id: "closing", label: "Fechamento do mês", icon: "✓", role: "rh" },
  { id: "team", label: "Pessoas", icon: "◎", role: "rh" },
  { id: "reports", label: "Relatórios", icon: "↗", role: "rh" },
  { id: "admin", label: "Administração", icon: "⚙", role: "rh", devOnly: true },
  { id: "entries", label: "Meu mês", icon: "▷", role: "pj" },
  { id: "balance", label: "Banco de horas", icon: "◫", role: "pj" },
  { id: "approvals", label: "Solicitações", icon: "◇", role: "pj" },
];
const sectionNames: Record<Section, string> = { overview: "Painel", entries: "Lançamentos", balance: "Banco de horas", approvals: "Aprovações", closing: "Fechamento do mês", team: "Pessoas", reports: "Relatórios", admin: "Administração" };

type ApiPayload = { error?: string | { message?: string }; message?: string };

function apiMessage(result: ApiPayload, fallback: string) {
  if (typeof result.error === "string") return result.error;
  return result.error?.message ?? fallback;
}

function minutesBetween(start: string, end: string, breakMinutes: number) {
  const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, eh * 60 + em - sh * 60 - sm - breakMinutes);
}
function hoursToMinutes(value: string) { const hours = Number(value.replace(",", ".")); return Number.isFinite(hours) ? Math.round(hours * 60) : 0; }
function minutesToHours(value: number) { return (value / 60).toFixed(value % 60 === 0 ? 0 : 2); }

export function HorusApp({ user, accountRole, organizationName, initialDashboard }: { user: User; accountRole: AccountRole; organizationName: string; initialDashboard: DashboardData }) {
  const isDev = accountRole === "dev";
  const [viewMode, setViewMode] = useState<"rh" | "pj">(accountRole === "pj" ? "pj" : "rh");
  const role: Role = viewMode;
  const [section, setSection] = useState<Section>(role === "rh" ? "overview" : "entries");
  const [sidebarOpen, setSidebarOpen] = useState(false); const [dashboard, setDashboard] = useState(initialDashboard);
  const [rhDashboard, setRhDashboard] = useState(initialDashboard); const [viewedContractorId, setViewedContractorId] = useState("");
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [dashboardQuery, setDashboardQuery] = useState(""); const [loading, setLoading] = useState(false); const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ModalKind>(null); const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [editingEntry, setEditingEntry] = useState<DashboardEntry | null>(null); const [historyEntry, setHistoryEntry] = useState<DashboardEntry | null>(null);
  const [history, setHistory] = useState<HistoryVersion[]>([]); const today = new Date().toISOString().slice(0, 10);
  const [entryForm, setEntryForm] = useState({ contractorId: "", date: today, start: "08:00", end: "17:30", breakMinutes: "60", notes: "", changeReason: "" });
  const [occurrenceForm, setOccurrenceForm] = useState<{ contractorId: string; type: string; startDate: string; endDate: string; days: DailyHours; effect: string; description: string }>({ contractorId: "", type: "MEDICAL_CERTIFICATE", startDate: today, endDate: today, days: { [today]: "8" }, effect: "CREDITS_HOURS", description: "" });
  const [leaveForm, setLeaveForm] = useState<{ contractorId: string; startDate: string; endDate: string; days: DailyHours; reason: string }>({ contractorId: "", startDate: today, endDate: today, days: { [today]: "8" }, reason: "" });
  const [authorizationForm, setAuthorizationForm] = useState({ contractorId: "", workDate: today, hours: "8", reason: "" });
  const [contractorForm, setContractorForm] = useState({ name: "", email: "", password: "" });
  const [contractorPasswordForm, setContractorPasswordForm] = useState({ id: "", name: "", password: "", scope: "team" as "team" | "admin" });
  const [policyForm, setPolicyForm] = useState({ monthlyHours: minutesToHours(initialDashboard.policy.monthlyRequiredMinutes), minimumNotice: String(initialDashboard.policy.minimumLeaveNoticeDays ?? ""), batchThreshold: String(initialDashboard.policy.retroactiveBatchThreshold), deadlinePolicy: initialDashboard.policy.positiveBalanceAfterDeadlinePolicy, applyToOpenBalances: false, reason: "" });
  const calculated = useMemo(() => minutesBetween(entryForm.start, entryForm.end, Number(entryForm.breakMinutes)), [entryForm]);
  const initials = user.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const visibleNav = navItems.filter((item) => item.role === role && (!item.devOnly || isDev));
  const visibleSectionName = visibleNav.find((item) => item.id === section)?.label ?? sectionNames[section];
  const pendingCount = dashboard.metrics.pendingRequests + dashboard.metrics.pendingOccurrences + dashboard.metrics.pendingAuthorizations;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") { setModal(null); setConfirmation(null); } }
    window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 5200); }
  function openSection(next: Section) { setSection(next); setSidebarOpen(false); if (next === "admin" && isDev) void fetchAdmin(); }
  async function fetchDashboard(query = dashboardQuery, viewAs = isDev && viewMode === "pj" ? viewedContractorId : "") {
    const params = new URLSearchParams(query);
    if (viewAs) params.set("viewAs", viewAs); else params.delete("viewAs");
    const serialized = params.toString();
    const response = await fetch("/api/dashboard" + (serialized ? "?" + serialized : ""), { cache: "no-store" });
    const result = (await response.json()) as DashboardData & ApiPayload;
    if (!response.ok) throw new Error(apiMessage(result, "Não foi possível atualizar os dados."));
    setDashboard(result); setDashboardQuery(query); if (!viewAs) setRhDashboard(result);
  }
  async function refreshDashboard(query = dashboardQuery) {
    setLoading(true); try { await fetchDashboard(query); } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível atualizar os dados."); } finally { setLoading(false); }
  }
  async function mutate(path: string, method: "POST" | "PATCH", body: unknown, success: string, closeModal = true) {
    setLoading(true);
    try {
      const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(apiMessage(result, "Não foi possível concluir a ação."));
      await fetchDashboard(); if (closeModal) setModal(null); showNotice(result.message || success); return true;
    } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação."); return false; }
    finally { setLoading(false); }
  }

  async function fetchAdmin() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const result = await response.json() as AdminData & ApiPayload;
      if (!response.ok) throw new Error(apiMessage(result, "Não foi possível carregar a Administração."));
      setAdminData(result);
    } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível carregar a Administração."); }
    finally { setLoading(false); }
  }

  async function adminMutate(method: "PATCH", body: unknown, success: string, closeModal = true) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as ApiPayload;
      if (!response.ok) throw new Error(apiMessage(result, "Não foi possível concluir a ação administrativa."));
      await Promise.all([fetchAdmin(), fetchDashboard(dashboardQuery, "")]);
      if (closeModal) setModal(null); showNotice(result.message || success); return true;
    } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação administrativa."); return false; }
    finally { setLoading(false); }
  }

  async function switchToRh() {
    if (!isDev) return;
    setViewMode("rh"); setViewedContractorId(""); setSection("overview"); setDashboard(rhDashboard); setSidebarOpen(false); setLoading(true);
    try { await fetchDashboard(dashboardQuery, ""); } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível abrir a visão do RH."); }
    finally { setLoading(false); }
  }

  async function switchToContractor(contractorId?: string) {
    if (!isDev) return;
    const targetId = contractorId || rhDashboard.contractors.find((person) => person.status === "ACTIVE")?.id || rhDashboard.contractors[0]?.id;
    if (!targetId) { showNotice("Cadastre um prestador antes de abrir essa visualização."); return; }
    setViewMode("pj"); setViewedContractorId(targetId); setSection("entries"); setSidebarOpen(false); setLoading(true);
    try { await fetchDashboard(dashboardQuery, targetId); } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível abrir a visão do prestador."); }
    finally { setLoading(false); }
  }

  function defaultContractorId() { return dashboard.contractors.find((person) => person.status === "ACTIVE")?.id ?? ""; }
  function openNewOccurrence() { setOccurrenceForm({ contractorId: defaultContractorId(), type: "MEDICAL_CERTIFICATE", startDate: today, endDate: today, days: { [today]: "8" }, effect: "CREDITS_HOURS", description: "" }); setModal("occurrence"); }
  function openNewLeave() { setLeaveForm({ contractorId: defaultContractorId(), startDate: today, endDate: today, days: { [today]: "8" }, reason: "" }); setModal("leave"); }
  function openNewAuthorization() { setAuthorizationForm({ contractorId: defaultContractorId(), workDate: today, hours: "8", reason: "" }); setModal("authorization"); }
  function openNewEntry() { setEditingEntry(null); setEntryForm({ contractorId: defaultContractorId(), date: today, start: "08:00", end: "17:30", breakMinutes: "60", notes: "", changeReason: "" }); setModal("entry"); }
  function openEditEntry(entry: DashboardEntry) { setEditingEntry(entry); setEntryForm({ contractorId: entry.contractorId, date: entry.workDate, start: entry.startTime, end: entry.endTime, breakMinutes: String(entry.breakMinutes), notes: entry.notes, changeReason: "" }); setModal("entry"); }
  async function openHistory(entry: DashboardEntry) {
    setHistoryEntry(entry); setHistory([]); setModal("history"); setLoading(true);
    try { const response = await fetch(`/api/time-entries/${entry.id}/history`, { cache: "no-store" }); const result = await response.json() as { versions?: HistoryVersion[]; error?: string }; if (!response.ok) throw new Error(result.error); setHistory(result.versions ?? []); }
    catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível abrir o histórico."); }
    finally { setLoading(false); }
  }
  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await mutate("/api/time-entries", "POST", { contractorId: entryForm.contractorId, workDate: entryForm.date, startTime: entryForm.start, endTime: entryForm.end, breakMinutes: Number(entryForm.breakMinutes), notes: entryForm.notes, changeReason: entryForm.changeReason }, editingEntry ? "Lançamento corrigido e versão anterior preservada." : "Lançamento salvo.");
  }
  async function submitOccurrence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const days = dailyAllocationPayload(occurrenceForm.startDate, occurrenceForm.endDate, occurrenceForm.days);
    await mutate("/api/occurrences", "POST", { contractorId: occurrenceForm.contractorId, type: occurrenceForm.type, startDate: occurrenceForm.startDate, endDate: occurrenceForm.endDate, minutes: days.reduce((total, day) => total + day.minutes, 0), days, calculationEffect: occurrenceForm.effect, description: occurrenceForm.description }, role === "rh" ? "Ocorrência registrada e cálculos atualizados." : "Ocorrência enviada ao RH.");
  }
  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const days = dailyAllocationPayload(leaveForm.startDate, leaveForm.endDate, leaveForm.days);
    await mutate("/api/leave-requests", "POST", { contractorId: leaveForm.contractorId, startDate: leaveForm.startDate, endDate: leaveForm.endDate, requestedMinutes: days.reduce((total, day) => total + day.minutes, 0), days, reason: leaveForm.reason }, "Solicitação de folga enviada.");
  }
  async function submitAuthorization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await mutate("/api/non-business-authorizations", "POST", { contractorId: authorizationForm.contractorId, workDate: authorizationForm.workDate, estimatedMinutes: hoursToMinutes(authorizationForm.hours), reason: authorizationForm.reason }, "Solicitação de trabalho em dia não útil enviada.");
  }
  async function submitContractor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const success = await mutate("/api/team", "POST", contractorForm, "Prestador cadastrado com acesso por senha."); if (success) setContractorForm({ name: "", email: "", password: "" });
  }
  async function submitContractorPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = contractorPasswordForm.scope === "admin"
      ? await adminMutate("PATCH", { id: contractorPasswordForm.id, action: "SET_PASSWORD", password: contractorPasswordForm.password }, "Senha do usuário atualizada.")
      : await mutate("/api/team", "PATCH", { id: contractorPasswordForm.id, action: "SET_PASSWORD", password: contractorPasswordForm.password }, "Senha do prestador atualizada.");
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
    setConfirmation({ title: next === "INACTIVE" ? "Inativar prestador" : "Reativar prestador", description: next === "INACTIVE" ? "O prestador perderá o acesso, mas todo o histórico será preservado." : "O prestador voltará a poder acessar o Horus.", confirmLabel: next === "INACTIVE" ? "Inativar" : "Reativar", reasonRequired: true, onConfirm: async (reason) => { const ok = await mutate("/api/team", "PATCH", { id, status: next, reason }, "Situação do prestador atualizada.", false); if (ok) setConfirmation(null); } });
  }
  function closeMonth(preview: TimesheetPreview, allowEmptyMonth = false) {
    const person = dashboard.contractors.find((item) => item.id === preview.contractorId);
    setConfirmation({
      title: `Fechar mês de ${person?.name ?? "prestador"}`,
      description: `Total considerado: ${formatMinutes(preview.consideredMinutes)}. Impacto previsto no banco: ${formatMinutes(preview.projectedBalanceMinutes, true)}. Depois de confirmar, os lançamentos do mês ficam bloqueados.`,
      confirmLabel: allowEmptyMonth ? "Confirmar mês sem horas" : "Fechar mês",
      reasonRequired: allowEmptyMonth,
      onConfirm: async (reason) => {
        const ok = await mutate("/api/timesheets", "POST", {
          contractorId: preview.contractorId,
          year: preview.year,
          month: preview.month,
          action: "CLOSE",
          reviewVersion: preview.reviewVersion,
          allowEmptyMonth,
          emptyMonthReason: allowEmptyMonth ? reason : undefined,
        }, "Mês fechado e banco de horas atualizado.", false);
        if (ok) setConfirmation(null);
      },
    });
  }
  function closeReadyMonths(previews: TimesheetPreview[]) {
    setConfirmation({
      title: `Fechar ${previews.length} mês(es) revisado(s)`,
      description: "Somente as pessoas exibidas como prontas serão processadas. Se alguma revisão tiver mudado, ela voltará para a lista de pendências.",
      confirmLabel: "Fechar meses prontos",
      reasonRequired: false,
      onConfirm: async () => {
        setLoading(true);
        try {
          const response = await fetch("/api/timesheets/close-batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ year: dashboard.period.year, month: dashboard.period.month, people: previews.map((preview) => ({ contractorId: preview.contractorId, reviewVersion: preview.reviewVersion })) }) });
          const result = await response.json() as ApiPayload & { results?: Array<{ status: string }> };
          if (!response.ok) throw new Error(apiMessage(result, "Não foi possível concluir o fechamento em grupo."));
          await fetchDashboard();
          const closed = result.results?.filter((item) => item.status === "closed" || item.status === "alreadyClosed").length ?? 0;
          const review = result.results?.filter((item) => item.status === "needsReview" || item.status === "failed").length ?? 0;
          setConfirmation(null);
          showNotice(review > 0 ? `${closed} mês(es) fechado(s). ${review} precisam de uma nova revisão.` : `${closed} mês(es) fechado(s) com sucesso.`);
        } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível concluir o fechamento em grupo."); }
        finally { setLoading(false); }
      },
    });
  }
  async function reopenMonth(preview: TimesheetPreview) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ contractorId: preview.contractorId, year: String(preview.year), month: String(preview.month) });
      const response = await fetch(`/api/timesheets/reopen-preview?${params}`, { cache: "no-store" });
      const result = await response.json() as ApiPayload & { canReopen?: boolean; message?: string; code?: string };
      if (!response.ok) throw new Error(apiMessage(result, "Não foi possível revisar a reabertura."));
      if (!result.canReopen) { showNotice(result.message || "Este mês não pode ser reaberto automaticamente. Consulte o histórico do banco de horas."); return; }
      const person = dashboard.contractors.find((item) => item.id === preview.contractorId);
      setConfirmation({ title: `Reabrir mês de ${person?.name ?? "prestador"}`, description: "A reabertura desfará somente as movimentações deste fechamento. Informe o motivo para manter a auditoria completa.", confirmLabel: "Reabrir mês", reasonRequired: true, onConfirm: async (reason) => { const ok = await mutate("/api/timesheets", "POST", { contractorId: preview.contractorId, year: preview.year, month: preview.month, action: "REOPEN", reason }, "Mês reaberto com estorno auditado.", false); if (ok) setConfirmation(null); } });
    } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível revisar a reabertura."); }
    finally { setLoading(false); }
  }

  function changeUserRole(userToChange: AdminUser, next: "RH" | "PJ") {
    if (userToChange.role === next) return;
    setConfirmation({ title: "Alterar perfil do usuário", description: `${userToChange.name} passará de ${userToChange.role === "PJ" ? "Prestador PJ" : "RH"} para ${next === "PJ" ? "Prestador PJ" : "RH"}. O histórico será preservado.`, confirmLabel: "Alterar perfil", reasonRequired: true, onConfirm: async (reason) => { const ok = await adminMutate("PATCH", { id: userToChange.id, action: "SET_ROLE", role: next, reason }, "Perfil atualizado.", false); if (ok) setConfirmation(null); } });
  }
  function changeUserStatus(userToChange: AdminUser, next: "ACTIVE" | "INACTIVE") {
    if (userToChange.status === next) return;
    setConfirmation({ title: next === "INACTIVE" ? "Inativar usuário" : "Reativar usuário", description: next === "INACTIVE" ? `${userToChange.name} perderá o acesso, mas o histórico será preservado.` : `${userToChange.name} voltará a ter acesso ao Horus.`, confirmLabel: next === "INACTIVE" ? "Inativar" : "Reativar", reasonRequired: true, onConfirm: async (reason) => { const ok = await adminMutate("PATCH", { id: userToChange.id, action: "SET_STATUS", status: next, reason }, "Situação atualizada.", false); if (ok) setConfirmation(null); } });
  }
  return <div className="app-shell">
    <button className="mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-label="Abrir menu" aria-expanded={sidebarOpen} aria-controls="main-sidebar"><span /><span /></button>
    <aside id="main-sidebar" className={"sidebar " + (sidebarOpen ? "sidebar-open" : "")}><button className="brand" onClick={() => openSection(role === "rh" ? "overview" : "entries")}><span className="brand-mark">H</span><span><strong>horus</strong><small>HORAS TÉCNICAS</small></span></button>{isDev ? <div className="dev-mode-panel"><span>MODO DEV</span><div className="dev-mode-buttons"><button className={viewMode === "rh" ? "active" : ""} onClick={() => void switchToRh()}>Visão RH</button><button className={viewMode === "pj" ? "active" : ""} onClick={() => void switchToContractor()}>Prestador</button></div>{viewMode === "pj" && <div className="dev-view-selector"><span>Visualizar como</span><SelectMenu variant="dark" ariaLabel="Prestador visualizado" value={viewedContractorId} onChange={(value) => void switchToContractor(value)} options={rhDashboard.contractors.map((person) => ({ value: person.id, label: person.name, description: person.status === "INACTIVE" ? "Cadastro inativo" : "Prestador ativo" }))} /></div>}</div> : <div className="role-switch actual-role" aria-label="Perfil autorizado"><button className="active" disabled>{role === "rh" ? "RH" : "Prestador"}</button></div>}<nav aria-label="Navegação principal"><p className="nav-caption">ESPAÇO DE TRABALHO</p>{visibleNav.map((item) => <button key={`${item.role}-${item.id}`} className={section === item.id ? "nav-active" : ""} onClick={() => openSection(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "approvals" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="profile-card"><div className="avatar">{initials}</div><div><strong>{user.name}</strong><span>{isDev ? "Desenvolvedor" : role === "rh" ? "Recursos Humanos" : "Prestador PJ"}</span></div><form action="/api/auth/sign-out" method="post"><button type="submit" aria-label="Sair da conta">Sair</button></form></div></div></aside>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
    <main className="main-content"><header className="topbar"><div className="breadcrumb"><span>Horus</span><b>/</b>{visibleSectionName}</div><div className="topbar-actions"><div className="organization-button"><span className="org-monogram">{organizationName.slice(0, 1).toUpperCase()}</span><span>{organizationName}</span></div></div></header>{notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}{loading && <div className="loading-line" role="status" aria-label="Atualizando dados">Atualizando dados…</div>}<div className="content-wrap">{isDev && viewMode === "pj" && <div className="dev-view-banner"><span>VISUALIZAÇÃO DEV</span><div><strong>Você está vendo o Horus como {dashboard.contractors[0]?.name ?? "prestador selecionado"}</strong><p>Modo somente leitura. Nenhuma ação será realizada em nome dessa pessoa.</p></div><button onClick={() => void switchToRh()}>Voltar à visão RH</button></div>}
      {section === "overview" && role === "rh" && <Overview data={dashboard} loading={loading} onNavigate={openSection} onPeriod={refreshDashboard} />}
      {section === "entries" && <EntriesView role={role} data={dashboard} readOnly={isDev && viewMode === "pj"} onNew={openNewEntry} onEdit={openEditEntry} onHistory={openHistory} />}
      {section === "balance" && <BalanceView data={dashboard} />}
      {section === "approvals" && <ApprovalInboxView data={dashboard} role={role} readOnly={isDev && viewMode === "pj"} onNewOccurrence={openNewOccurrence} onNewLeave={openNewLeave} onNewAuthorization={openNewAuthorization} onDecision={decide} />}
      {section === "closing" && role === "rh" && <ClosingView data={dashboard} loading={loading} onClose={closeMonth} onCloseReady={closeReadyMonths} onReopen={(preview) => void reopenMonth(preview)} />}
      {section === "team" && role === "rh" && <TeamView data={dashboard} onNew={() => setModal("contractor")} onStatus={changeContractorStatus} onSetPassword={(id, name) => { setContractorPasswordForm({ id, name, password: "", scope: "team" }); setModal("contractorPassword"); }} />}
      {section === "reports" && role === "rh" && <ReportsView data={dashboard} onPolicy={() => { setPolicyForm({ monthlyHours: minutesToHours(dashboard.policy.monthlyRequiredMinutes), minimumNotice: String(dashboard.policy.minimumLeaveNoticeDays ?? ""), batchThreshold: String(dashboard.policy.retroactiveBatchThreshold), deadlinePolicy: dashboard.policy.positiveBalanceAfterDeadlinePolicy, applyToOpenBalances: false, reason: "" }); setModal("policy"); }} />}
      {section === "admin" && isDev && role === "rh" && <AdminView data={adminData} loading={loading} onRole={changeUserRole} onStatus={changeUserStatus} onViewAs={(target) => void switchToContractor(target.id)} onPassword={(target) => { setContractorPasswordForm({ id: target.id, name: target.name, password: "", scope: "admin" }); setModal("contractorPassword"); }} />}
    </div></main>

    {modal === "entry" && <Modal title={editingEntry ? "Editar lançamento" : "Registrar horas"} eyebrow="LANÇAMENTO DIÁRIO" description="O servidor recalcula o total e preserva o histórico." onClose={() => setModal(null)}><form onSubmit={submitEntry}>{role === "rh" && <ContractorSelect value={entryForm.contractorId} onChange={(contractorId) => setEntryForm({ ...entryForm, contractorId })} data={dashboard} disabled={Boolean(editingEntry)} />}<label className="field full-field">Data trabalhada<input type="date" value={entryForm.date} max={today} onChange={(event) => setEntryForm({ ...entryForm, date: event.target.value })} required disabled={Boolean(editingEntry)} /></label><div className="form-grid"><label className="field">Entrada<input type="time" value={entryForm.start} onChange={(event) => setEntryForm({ ...entryForm, start: event.target.value })} required /></label><label className="field">Saída<input type="time" value={entryForm.end} onChange={(event) => setEntryForm({ ...entryForm, end: event.target.value })} required /></label><label className="field">Intervalo em minutos<input type="number" min="0" max="1440" value={entryForm.breakMinutes} onChange={(event) => setEntryForm({ ...entryForm, breakMinutes: event.target.value })} required /></label><div className="calculated-field"><span>Total calculado</span><strong>{formatMinutes(calculated)}</strong></div></div><label className="field full-field">Observação <em>opcional</em><textarea value={entryForm.notes} onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })} maxLength={2000} /></label>{role === "rh" && <label className="field full-field">Justificativa da correção<textarea value={entryForm.changeReason} onChange={(event) => setEntryForm({ ...entryForm, changeReason: event.target.value })} minLength={5} maxLength={2000} required /></label>}<ModalActions loading={loading} onCancel={() => setModal(null)} label={editingEntry ? "Salvar correção" : "Salvar lançamento"} /></form></Modal>}
    {modal === "history" && <Modal title="Histórico do lançamento" eyebrow="VERSÕES PRESERVADAS" description={historyEntry ? `${historyEntry.contractorName} · ${formatDate(historyEntry.workDate)}` : ""} onClose={() => setModal(null)}>{history.length ? <div className="history-list">{history.map((version) => <article key={version.id}><div><strong>Versão {version.version_number}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(version.changed_at))}</time></div><p>{version.change_reason || "Alteração realizada pelo prestador."}</p><dl><div><dt>Antes</dt><dd>{historyHours(version.previous_data)}</dd></div><div><dt>Depois</dt><dd>{historyHours(version.new_data)}</dd></div></dl></article>)}</div> : <div className="empty-state"><strong>Sem alterações</strong><p>Este lançamento ainda está em sua versão original.</p></div>}</Modal>}
    {modal === "occurrence" && <Modal title="Informar ausência" eyebrow="AUSÊNCIA E JUSTIFICATIVA" description={role === "rh" ? "O registro feito pelo RH entra aprovado e atualiza os cálculos." : "O RH analisará a justificativa e o efeito no mês."} onClose={() => setModal(null)}><form onSubmit={submitOccurrence}>{role === "rh" && <ContractorSelect value={occurrenceForm.contractorId} onChange={(contractorId) => setOccurrenceForm({ ...occurrenceForm, contractorId })} data={dashboard} />}<div className="field full-field"><span>Motivo da ausência</span><SelectMenu ariaLabel="Motivo da ausência" value={occurrenceForm.type} onChange={(type) => setOccurrenceForm({ ...occurrenceForm, type })} options={[{ value: "VACATION", label: "Férias" }, { value: "MEDICAL_CERTIFICATE", label: "Atestado" }, { value: "JUSTIFIED_ABSENCE", label: "Falta justificada" }, { value: "OTHER", label: "Outro motivo" }]} /></div><div className="form-grid"><label className="field">Data inicial<input type="date" value={occurrenceForm.startDate} onChange={(event) => setOccurrenceForm({ ...occurrenceForm, startDate: event.target.value })} required /></label><label className="field">Data final<input type="date" min={occurrenceForm.startDate} value={occurrenceForm.endDate} onChange={(event) => setOccurrenceForm({ ...occurrenceForm, endDate: event.target.value })} required /></label>{role === "rh" && <div className="field"><span>Efeito nas horas</span><SelectMenu ariaLabel="Efeito da ausência nas horas" value={occurrenceForm.effect} onChange={(effect) => setOccurrenceForm({ ...occurrenceForm, effect })} options={[{ value: "CREDITS_HOURS", label: "Abonar horas", description: "Soma as horas ao total do mês" }, { value: "DOES_NOT_CREDIT", label: "Não abonar", description: "Não altera o total do mês" }, { value: "CONSUMES_BALANCE", label: "Usar banco de horas", description: "Consome créditos disponíveis" }]} /></div>}</div><DailyAllocationFields startDate={occurrenceForm.startDate} endDate={occurrenceForm.endDate} values={occurrenceForm.days} onChange={(days) => setOccurrenceForm({ ...occurrenceForm, days })} /><label className="field full-field">Descrição<textarea value={occurrenceForm.description} onChange={(event) => setOccurrenceForm({ ...occurrenceForm, description: event.target.value })} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={() => setModal(null)} label={role === "rh" ? "Registrar ausência" : "Enviar ao RH"} /></form></Modal>}
    {modal === "leave" && <Modal title="Solicitar folga" eyebrow="USO DO BANCO DE HORAS" description="Se o RH aprovar, o sistema reserva primeiro os créditos mais antigos." onClose={() => setModal(null)}><form onSubmit={submitLeave}>{role === "rh" && <ContractorSelect value={leaveForm.contractorId} onChange={(contractorId) => setLeaveForm({ ...leaveForm, contractorId })} data={dashboard} />}<div className="form-grid"><label className="field">Data inicial<input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm({ ...leaveForm, startDate: event.target.value })} required /></label><label className="field">Data final<input type="date" min={leaveForm.startDate} value={leaveForm.endDate} onChange={(event) => setLeaveForm({ ...leaveForm, endDate: event.target.value })} required /></label></div><DailyAllocationFields startDate={leaveForm.startDate} endDate={leaveForm.endDate} values={leaveForm.days} onChange={(days) => setLeaveForm({ ...leaveForm, days })} /><label className="field full-field">Justificativa<textarea value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={() => setModal(null)} label="Enviar solicitação" /></form></Modal>}
    {modal === "authorization" && <Modal title="Trabalho em dia não útil" eyebrow="AUTORIZAÇÃO PRÉVIA" description="Sem aprovação, o lançamento fica salvo, mas não entra no fechamento." onClose={() => setModal(null)}><form onSubmit={submitAuthorization}>{role === "rh" && <ContractorSelect value={authorizationForm.contractorId} onChange={(contractorId) => setAuthorizationForm({ ...authorizationForm, contractorId })} data={dashboard} />}<div className="form-grid"><label className="field">Data<input type="date" value={authorizationForm.workDate} onChange={(event) => setAuthorizationForm({ ...authorizationForm, workDate: event.target.value })} required /></label><label className="field">Horas estimadas<input type="number" min="0.25" max="24" step="0.25" value={authorizationForm.hours} onChange={(event) => setAuthorizationForm({ ...authorizationForm, hours: event.target.value })} required /></label></div><label className="field full-field">Justificativa<textarea value={authorizationForm.reason} onChange={(event) => setAuthorizationForm({ ...authorizationForm, reason: event.target.value })} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={() => setModal(null)} label="Enviar solicitação" /></form></Modal>}
    {modal === "contractor" && <Modal title="Novo prestador" eyebrow="CADASTRO PJ" description="Defina uma senha inicial e compartilhe-a com o prestador por um canal seguro." onClose={() => setModal(null)}><form onSubmit={submitContractor}><label className="field full-field">Nome completo<input value={contractorForm.name} onChange={(event) => setContractorForm({ ...contractorForm, name: event.target.value })} maxLength={200} required /></label><label className="field full-field">E-mail<input type="email" value={contractorForm.email} onChange={(event) => setContractorForm({ ...contractorForm, email: event.target.value })} maxLength={320} required /></label><label className="field full-field">Senha inicial<input type="password" autoComplete="new-password" value={contractorForm.password} onChange={(event) => setContractorForm({ ...contractorForm, password: event.target.value })} minLength={8} maxLength={72} required /></label><div className="audit-note"><span>◈</span><p><strong>Sem envio de magic link</strong>O prestador também poderá entrar com o Google, desde que use o mesmo e-mail cadastrado.</p></div><ModalActions loading={loading} onCancel={() => setModal(null)} label="Cadastrar prestador" /></form></Modal>}
    {modal === "contractorPassword" && <Modal title="Definir senha" eyebrow="ACESSO DO USUÁRIO" description={`Crie uma nova senha para ${contractorPasswordForm.name}.`} onClose={() => setModal(null)}><form onSubmit={submitContractorPassword}><label className="field full-field">Nova senha<input type="password" autoComplete="new-password" value={contractorPasswordForm.password} onChange={(event) => setContractorPasswordForm({ ...contractorPasswordForm, password: event.target.value })} minLength={8} maxLength={72} required autoFocus /></label><div className="audit-note"><span>◈</span><p><strong>Compartilhamento seguro</strong>A senha não será enviada por e-mail nem registrada na auditoria.</p></div><ModalActions loading={loading} onCancel={() => setModal(null)} label="Salvar nova senha" /></form></Modal>}
    {modal === "policy" && <Modal title="Políticas da organização" eyebrow="REGRAS OPERACIONAIS" description="Alterações exigem justificativa e ficam na auditoria." onClose={() => setModal(null)}><form onSubmit={submitPolicy}><div className="form-grid"><label className="field">Carga mensal em horas<input type="number" min="0" step="0.25" value={policyForm.monthlyHours} onChange={(event) => setPolicyForm({ ...policyForm, monthlyHours: event.target.value })} required /></label><label className="field">Aviso mínimo para folga (dias)<input type="number" min="0" value={policyForm.minimumNotice} onChange={(event) => setPolicyForm({ ...policyForm, minimumNotice: event.target.value })} /></label><label className="field">Limite do lote retroativo<input type="number" min="1" value={policyForm.batchThreshold} onChange={(event) => setPolicyForm({ ...policyForm, batchThreshold: event.target.value })} required /></label><div className="field"><span>Crédito após 90 dias</span><SelectMenu ariaLabel="Política de crédito após 90 dias" value={policyForm.deadlinePolicy} onChange={(deadlinePolicy) => setPolicyForm({ ...policyForm, deadlinePolicy: deadlinePolicy as typeof policyForm.deadlinePolicy })} options={[{ value: "ALLOW_AFTER_DEADLINE", label: "Continuar permitindo", description: "O crédito segue disponível" }, { value: "BLOCK_AFTER_DEADLINE", label: "Bloquear utilização", description: "O crédito vence após o prazo" }]} /></div></div><label className="check-field"><input type="checkbox" checked={policyForm.applyToOpenBalances} onChange={(event) => setPolicyForm({ ...policyForm, applyToOpenBalances: event.target.checked })} /><span>Aplicar a política de prazo também aos saldos antigos ainda abertos</span></label><label className="field full-field">Justificativa<textarea value={policyForm.reason} onChange={(event) => setPolicyForm({ ...policyForm, reason: event.target.value })} minLength={5} maxLength={2000} required /></label><ModalActions loading={loading} onCancel={() => setModal(null)} label="Salvar políticas" /></form></Modal>}
    {confirmation && <ConfirmationModal confirmation={confirmation} loading={loading} onClose={() => setConfirmation(null)} />}
  </div>;
}

function Modal({ title, eyebrow, description, onClose, children }: { title: string; eyebrow: string; description: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector<HTMLElement>("form input:not(:disabled), form textarea:not(:disabled), form button:not(:disabled)")
        ?? dialogRef.current?.querySelector<HTMLElement>("[data-modal-close]");
      firstField?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else document.querySelector<HTMLElement>(".new-request-wrap > button")?.focus();
    };
  }, []);
  function keepFocusInside(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? [])];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description" onKeyDown={keepFocusInside}><div className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2 id="modal-title">{title}</h2><p id="modal-description">{description}</p></div><button data-modal-close type="button" onClick={onClose} aria-label="Fechar">×</button></div>{children}</section></div>;
}
function ModalActions({ loading, onCancel, label, danger = false }: { loading: boolean; onCancel: () => void; label: string; danger?: boolean }) { return <div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button className={danger ? "danger-button" : "primary-button"} type="submit" disabled={loading}>{loading ? "Processando…" : label}</button></div>; }
function ContractorSelect({ value, onChange, data, disabled = false }: { value: string; onChange: (value: string) => void; data: DashboardData; disabled?: boolean }) { return <div className="field full-field"><span>Prestador</span><SelectMenu ariaLabel="Selecionar prestador" value={value} onChange={onChange} disabled={disabled} options={data.contractors.filter((person) => person.status === "ACTIVE" || person.id === value).map((person) => ({ value: person.id, label: person.name, description: person.email }))} /></div>; }
function historyHours(data: Record<string, unknown>) { const start = String(data.start_time ?? "").slice(0, 5); const end = String(data.end_time ?? "").slice(0, 5); const total = Number(data.calculated_minutes ?? 0); return `${start} → ${end} · ${formatMinutes(total)}`; }

function ConfirmationModal({ confirmation, loading, onClose }: { confirmation: Exclude<Confirmation, null>; loading: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await confirmation.onConfirm(reason); }
  return <Modal title={confirmation.title} eyebrow="CONFIRMAÇÃO" description={confirmation.description} onClose={onClose}><form onSubmit={submit}>{confirmation.reasonRequired && <label className="field full-field">Justificativa<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={2000} required autoFocus /></label>}<ModalActions loading={loading} onCancel={onClose} label={confirmation.confirmLabel} danger={confirmation.danger} /></form></Modal>;
}

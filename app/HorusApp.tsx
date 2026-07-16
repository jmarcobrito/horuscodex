"use client";

import { FormEvent, useMemo, useState } from "react";

type Role = "rh" | "pj";
type Section = "overview" | "entries" | "balance" | "requests" | "team" | "reports";
type User = { name: string; email: string };
type TimeEntry = { date: string; day: string; start: string; end: string; breakTime: string; total: string; status: "regular" | "pending" | "late"; note?: string };

const navItems: Array<{ id: Section; label: string; icon: string; rhOnly?: boolean }> = [
  { id: "overview", label: "Visão geral", icon: "⌂" },
  { id: "entries", label: "Lançamentos", icon: "◷" },
  { id: "balance", label: "Banco de horas", icon: "◫" },
  { id: "requests", label: "Solicitações", icon: "◇" },
  { id: "team", label: "Equipe", icon: "◎", rhOnly: true },
  { id: "reports", label: "Relatórios", icon: "↗", rhOnly: true },
];

const contractors = [
  { name: "Beatriz Lima", initials: "BL", last: "15/07", delay: "0 dias", pending: 0, batch: false, fill: 94, tone: "violet" },
  { name: "Caio Martins", initials: "CM", last: "12/07", delay: "3 dias", pending: 2, batch: true, fill: 76, tone: "blue" },
  { name: "Fernanda Alves", initials: "FA", last: "15/07", delay: "0 dias", pending: 0, batch: false, fill: 92, tone: "rose" },
  { name: "Lucas Rocha", initials: "LR", last: "08/07", delay: "7 dias", pending: 5, batch: true, fill: 58, tone: "amber" },
  { name: "Rafael Nunes", initials: "RN", last: "14/07", delay: "1 dia", pending: 1, batch: false, fill: 85, tone: "green" },
];

const balanceLots = [
  { name: "Beatriz Lima", type: "Crédito", amount: "+05:00", origin: "Mai/2026", deadline: "29/08/2026", days: 44, status: "Atenção" },
  { name: "Lucas Rocha", type: "Déficit", amount: "−03:00", origin: "Abr/2026", deadline: "30/07/2026", days: 14, status: "Crítico" },
  { name: "Caio Martins", type: "Crédito", amount: "+08:30", origin: "Jun/2026", deadline: "28/09/2026", days: 74, status: "Regular" },
];

const initialEntries: TimeEntry[] = [
  { date: "15 JUL", day: "Quarta-feira", start: "08:03", end: "17:42", breakTime: "01:00", total: "08:39", status: "regular" },
  { date: "14 JUL", day: "Terça-feira", start: "08:10", end: "18:00", breakTime: "01:15", total: "08:35", status: "regular" },
  { date: "13 JUL", day: "Segunda-feira", start: "08:00", end: "17:30", breakTime: "01:00", total: "08:30", status: "late", note: "Lançado com 1 dia de atraso" },
  { date: "10 JUL", day: "Sexta-feira", start: "08:06", end: "17:18", breakTime: "01:00", total: "08:12", status: "regular" },
  { date: "09 JUL", day: "Quinta-feira", start: "—", end: "—", breakTime: "—", total: "08:00", status: "pending", note: "Atestado · aguardando validação" },
];

const requestRows = [
  { person: "Caio Martins", kind: "Trabalho em dia não útil", date: "18/07/2026", hours: "05:00", status: "Aguardando decisão", urgency: "Hoje" },
  { person: "Fernanda Alves", kind: "Folga com banco de horas", date: "24/07/2026", hours: "08:00", status: "Aguardando decisão", urgency: "2 dias" },
  { person: "Rafael Nunes", kind: "Atestado", date: "13/07/2026", hours: "08:00", status: "Em análise", urgency: "3 dias" },
];

const sectionNames: Record<Section, string> = { overview: "Visão geral", entries: "Lançamentos", balance: "Banco de horas", requests: "Solicitações", team: "Equipe", reports: "Relatórios" };
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function minutesBetween(start: string, end: string, breakMinutes: number) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, eh * 60 + em - (sh * 60 + sm) - breakMinutes);
}

function formatMinutes(minutes: number) {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export function HorusApp({ user }: { user: User }) {
  const [role, setRole] = useState<Role>("rh");
  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entryModal, setEntryModal] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [notice, setNotice] = useState("");
  const [entries, setEntries] = useState(initialEntries);
  const [entryForm, setEntryForm] = useState({ date: "2026-07-16", start: "08:00", end: "17:30", breakMinutes: "60", notes: "" });
  const calculated = useMemo(() => minutesBetween(entryForm.start, entryForm.end, Number(entryForm.breakMinutes)), [entryForm]);
  const initials = user.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const visibleNav = navItems.filter((item) => role === "rh" || !item.rhOnly);

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    setSection(nextRole === "rh" ? "overview" : "entries");
    setSidebarOpen(false);
  }

  function openSection(next: Section) {
    setSection(next);
    setSidebarOpen(false);
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const optimistic: TimeEntry = { date: "16 JUL", day: "Quinta-feira", start: entryForm.start, end: entryForm.end, breakTime: formatMinutes(Number(entryForm.breakMinutes)), total: formatMinutes(calculated), status: "regular", note: entryForm.notes || undefined };
    setEntries((current) => [optimistic, ...current.filter((item) => item.date !== "16 JUL")]);
    setEntryModal(false);
    setNotice(`Lançamento de ${formatMinutes(calculated)} salvo com sucesso.`);
    try {
      await fetch("/api/time-entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workDate: entryForm.date, startTime: entryForm.start, endTime: entryForm.end, breakMinutes: Number(entryForm.breakMinutes), calculatedMinutes: calculated, notes: entryForm.notes }) });
    } catch { /* Local preview can keep the optimistic entry without D1. */ }
    window.setTimeout(() => setNotice(""), 4200);
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-label="Abrir menu" aria-expanded={sidebarOpen}><span /><span /></button>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button className="brand" onClick={() => openSection(role === "rh" ? "overview" : "entries")}><span className="brand-mark">H</span><span><strong>horus</strong><small>HORAS TÉCNICAS</small></span></button>
        <div className="role-switch" aria-label="Alternar perfil de visualização"><button className={role === "rh" ? "active" : ""} onClick={() => changeRole("rh")}>RH</button><button className={role === "pj" ? "active" : ""} onClick={() => changeRole("pj")}>Prestador</button></div>
        <nav aria-label="Navegação principal"><p className="nav-caption">ESPAÇO DE TRABALHO</p>{visibleNav.map((item) => <button key={item.id} className={section === item.id ? "nav-active" : ""} onClick={() => openSection(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "requests" && <span className="nav-count">3</span>}</button>)}</nav>
        <div className="sidebar-bottom"><button className="support-link"><span>?</span> Central de ajuda</button><div className="profile-card"><div className="avatar">{initials}</div><div><strong>{user.name}</strong><span>{role === "rh" ? "Recursos Humanos" : "Prestador PJ"}</span></div><button aria-label="Opções da conta">•••</button></div></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>Horus</span><b>/</b>{sectionNames[section]}</div><div className="topbar-actions"><label className="search-box"><span>⌕</span><input aria-label="Buscar prestador" placeholder="Buscar prestador..." /><kbd>⌘ K</kbd></label><button className="icon-button" aria-label="Notificações">♢<i /></button><button className="organization-button"><span className="org-monogram">A</span><span>Acme Tecnologia</span><b>⌄</b></button></div></header>
        {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
        <div className="content-wrap">
          {section === "overview" && role === "rh" && <RhOverview onNavigate={openSection} />}
          {section === "entries" && <EntriesView role={role} entries={entries} onNewEntry={() => setEntryModal(true)} />}
          {section === "balance" && <BalanceView role={role} />}
          {section === "requests" && <RequestsView role={role} filter={filter} setFilter={setFilter} notify={setNotice} />}
          {section === "team" && <TeamView />}
          {section === "reports" && <ReportsView notify={setNotice} />}
          {section === "overview" && role === "pj" && <EntriesView role={role} entries={entries} onNewEntry={() => setEntryModal(true)} />}
        </div>
      </main>

      {entryModal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEntryModal(false)}><section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div className="modal-header"><div><span className="eyebrow">LANÇAMENTO DIÁRIO</span><h2 id="entry-title">Registrar horas</h2><p>O horário real do lançamento será preservado no histórico.</p></div><button onClick={() => setEntryModal(false)} aria-label="Fechar">×</button></div><form onSubmit={submitEntry}>
        <label className="field full-field">Data trabalhada<input type="date" value={entryForm.date} max="2026-07-16" onChange={(event) => setEntryForm({ ...entryForm, date: event.target.value })} required /></label>
        <div className="form-grid"><label className="field">Entrada<input type="time" value={entryForm.start} onChange={(event) => setEntryForm({ ...entryForm, start: event.target.value })} required /></label><label className="field">Saída<input type="time" value={entryForm.end} onChange={(event) => setEntryForm({ ...entryForm, end: event.target.value })} required /></label><label className="field">Intervalo<select value={entryForm.breakMinutes} onChange={(event) => setEntryForm({ ...entryForm, breakMinutes: event.target.value })}><option value="30">00:30</option><option value="60">01:00</option><option value="90">01:30</option><option value="120">02:00</option></select></label><div className="calculated-field"><span>Total calculado</span><strong>{formatMinutes(calculated)}</strong></div></div>
        <label className="field full-field">Observação <em>opcional</em><textarea value={entryForm.notes} onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })} placeholder="Contexto sobre o dia trabalhado" /></label>
        <div className="audit-note"><span>◉</span><p><strong>Registro auditável</strong>Data, hora e usuário serão salvos automaticamente.</p></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEntryModal(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar lançamento <span>→</span></button></div>
      </form></section></div>}
    </div>
  );
}

function RhOverview({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<"month" | "range">("month");
  const [periodLabel, setPeriodLabel] = useState("Julho de 2026");
  const [periodKind, setPeriodKind] = useState("Mês completo");
  const [calendarMonth, setCalendarMonth] = useState(6);
  const [calendarYear, setCalendarYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(6);
  const [rangeStart, setRangeStart] = useState("2026-07-01");
  const [rangeEnd, setRangeEnd] = useState("2026-07-16");
  const firstWeekDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  function moveCalendar(direction: number) {
    const next = new Date(calendarYear, calendarMonth + direction, 1);
    setCalendarMonth(next.getMonth());
    setCalendarYear(next.getFullYear());
  }

  function dateForDay(day: number) {
    return `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function selectRangeDay(day: number) {
    const date = dateForDay(day);
    if (!rangeStart || rangeEnd) {
      setRangeStart(date);
      setRangeEnd("");
    } else if (date < rangeStart) {
      setRangeStart(date);
    } else {
      setRangeEnd(date);
    }
  }

  function formatDate(date: string) {
    if (!date) return "";
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day)).replace(" de ", " ").replace(" de ", " ");
  }

  function applyPeriod() {
    if (periodMode === "month") {
      setPeriodLabel(`${monthNames[selectedMonth]} de ${calendarYear}`);
      setPeriodKind("Mês completo");
    } else if (rangeStart && rangeEnd) {
      setPeriodLabel(`${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`);
      setPeriodKind("Intervalo personalizado");
    }
    setPickerOpen(false);
  }

  return <><section className="page-heading overview-heading"><div><span className="eyebrow">{periodKind.toUpperCase()}</span><h1>Bom dia, Marina.</h1><p>Indicadores consolidados para {periodLabel.toLowerCase()}.</p></div><div className="period-actions"><div className="period-picker-wrap"><button className="period-button" onClick={() => setPickerOpen((open) => !open)} aria-haspopup="dialog" aria-expanded={pickerOpen}><span className="period-calendar-icon">▦</span><span><small>PERÍODO</small><strong>{periodLabel}</strong></span><b>⌄</b></button>{pickerOpen && <><button className="period-dismiss" aria-label="Fechar seleção de período" onClick={() => setPickerOpen(false)} /><section className="period-popover" role="dialog" aria-label="Selecionar período"><div className="period-popover-head"><div><span>FILTRO DE DADOS</span><h2>Selecionar período</h2></div><button onClick={() => setPickerOpen(false)} aria-label="Fechar">×</button></div><div className="period-mode-tabs"><button className={periodMode === "month" ? "active" : ""} onClick={() => setPeriodMode("month")}>Por mês</button><button className={periodMode === "range" ? "active" : ""} onClick={() => setPeriodMode("range")}>Intervalo de datas</button></div>{periodMode === "month" ? <div className="month-picker"><div className="calendar-navigation"><button onClick={() => setCalendarYear((year) => year - 1)} aria-label="Ano anterior">←</button><strong>{calendarYear}</strong><button onClick={() => setCalendarYear((year) => year + 1)} aria-label="Próximo ano">→</button></div><div className="month-grid">{monthNames.map((month, index) => <button key={month} className={selectedMonth === index ? "selected" : ""} onClick={() => setSelectedMonth(index)}>{month.slice(0, 3)}</button>)}</div></div> : <div className="range-picker"><div className="range-fields"><label>Data inicial<input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></label><span>→</span><label>Data final<input type="date" min={rangeStart} value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} /></label></div><div className="calendar-navigation"><button onClick={() => moveCalendar(-1)} aria-label="Mês anterior">←</button><strong>{monthNames[calendarMonth]} {calendarYear}</strong><button onClick={() => moveCalendar(1)} aria-label="Próximo mês">→</button></div><div className="calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: firstWeekDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => { const date = dateForDay(day); const selected = date === rangeStart || date === rangeEnd; const inRange = Boolean(rangeStart && rangeEnd && date > rangeStart && date < rangeEnd); return <button key={day} className={`${selected ? "selected" : ""} ${inRange ? "in-range" : ""}`} onClick={() => selectRangeDay(day)} aria-label={`Selecionar dia ${day}`}>{day}</button>; })}</div></div>}<div className="period-popover-footer"><button className="period-cancel" onClick={() => setPickerOpen(false)}>Cancelar</button><button className="period-apply" onClick={applyPeriod} disabled={periodMode === "range" && (!rangeStart || !rangeEnd)}>Aplicar período</button></div></section></>}</div><button className="primary-button" onClick={() => onNavigate("reports")}><span>↗</span> Exportar relatório</button></div></section>
    <section className="metric-grid"><MetricCard label="PRESTADORES ATIVOS" value="12" meta="Todos com competência aberta" icon="◎" trend="+2 este mês" tone="violet" /><MetricCard label="HORAS REALIZADAS" value="1.284:30" meta="de 1.944:00 previstas" icon="◷" progress={66} tone="blue" /><MetricCard label="SALDO POSITIVO" value="+42:15" meta="7 prestadores com crédito" icon="↗" trend="+6:30 no mês" tone="green" /><MetricCard label="SALDO NEGATIVO" value="−18:40" meta="3 prestadores com déficit" icon="↘" trend="2 vencem em 30 dias" tone="amber" /></section>
    <section className="attention-banner"><div className="attention-icon">!</div><div><strong>7 itens precisam da sua atenção</strong><p>3 lançamentos atrasados, 2 solicitações de folga e 2 autorizações pendentes.</p></div><button onClick={() => onNavigate("requests")}>Revisar pendências <span>→</span></button></section>
    <section className="dashboard-grid"><div className="panel discipline-panel"><PanelHeading eyebrow="DISCIPLINA DE PREENCHIMENTO" title="Acompanhamento da equipe" action="Ver equipe completa" onAction={() => onNavigate("team")} /><div className="table-scroll"><table><thead><tr><th>Prestador</th><th>Último lançamento</th><th>Atraso</th><th>Dias pendentes</th><th>Preenchimento</th></tr></thead><tbody>{contractors.map((person) => <tr key={person.name}><td><div className="person-cell"><span className={`mini-avatar ${person.tone}`}>{person.initials}</span><div><strong>{person.name}</strong>{person.batch && <small>Retroativo em lote</small>}</div></div></td><td><strong>{person.last}</strong><small>às {person.pending > 2 ? "18:42" : "09:18"}</small></td><td><span className={person.delay === "0 dias" ? "quiet-status" : "delay-status"}>{person.delay}</span></td><td><span className={person.pending ? "pending-days" : "zero-days"}>{person.pending}</span></td><td><div className="fill-cell"><div className="mini-progress"><span style={{ width: `${person.fill}%` }} /></div><b>{person.fill}%</b></div></td></tr>)}</tbody></table></div></div>
      <div className="panel balance-panel"><PanelHeading eyebrow="BANCO DE HORAS" title="Saldos mais antigos" action="Ver extrato" onAction={() => onNavigate("balance")} /><div className="lot-list">{balanceLots.map((lot) => <article className="lot-row" key={lot.name}><div className="lot-top"><div><strong>{lot.name}</strong><span>{lot.origin}</span></div><b className={lot.type === "Crédito" ? "positive" : "negative"}>{lot.amount}</b></div><div className="deadline-line"><span className={`status-dot ${lot.status.toLowerCase().replace("í", "i")}`} /><span>{lot.status}</span><i /><small>vence em {lot.days} dias</small><time>{lot.deadline}</time></div></article>)}</div><div className="balance-summary"><span>Saldo líquido da empresa</span><strong>+23:35</strong><small>Créditos 42:15 · Déficits 18:40</small></div></div></section>
    <section className="panel requests-preview"><PanelHeading eyebrow="SOLICITAÇÕES" title="Aguardando decisão" action="Ver todas as solicitações" onAction={() => onNavigate("requests")} /><div className="request-preview-grid">{requestRows.map((request) => <article key={request.person}><div className="request-symbol">{request.kind.includes("Folga") ? "☼" : request.kind === "Atestado" ? "+" : "◷"}</div><div><small>{request.kind}</small><strong>{request.person}</strong><p>{request.date} · {request.hours}</p></div><span className="waiting-pill">{request.urgency}</span><button aria-label={`Abrir solicitação de ${request.person}`} onClick={() => onNavigate("requests")}>→</button></article>)}</div></section></>;
}

function MetricCard({ label, value, meta, icon, trend, progress, tone }: { label: string; value: string; meta: string; icon: string; trend?: string; progress?: number; tone: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><p>{meta}</p>{trend && <small className={`metric-trend ${tone}`}>{trend}</small>}{progress && <div className="metric-progress"><span style={{ width: `${progress}%` }} /></div>}</article>;
}

function PanelHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction?: () => void }) {
  return <div className="panel-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div><button onClick={onAction}>{action} <b>→</b></button></div>;
}

function EntriesView({ role, entries, onNewEntry }: { role: Role; entries: TimeEntry[]; onNewEntry: () => void }) {
  return <><section className="page-heading"><div><span className="eyebrow">COMPETÊNCIA ATUAL</span><h1>{role === "rh" ? "Lançamentos da equipe" : "Meu mês"}</h1><p>{role === "rh" ? "Acompanhe e corrija os registros antes do fechamento." : "Registre suas horas diariamente e acompanhe seu progresso."}</p></div><button className="primary-button" onClick={onNewEntry}>+ Registrar horas</button></section>
    <section className="month-strip"><button aria-label="Mês anterior">←</button><div><span>JULHO</span><strong>2026</strong></div><button aria-label="Próximo mês">→</button><div className="competence-badge"><span /> Competência aberta</div></section>
    <section className="timesheet-summary"><div><span>Horas trabalhadas</span><strong>96:46</strong><small>59,7% da carga</small></div><div><span>Horas abonadas</span><strong>08:00</strong><small>1 ocorrência</small></div><div><span>Total considerado</span><strong>104:46</strong><small>Meta: 162:00</small></div><div className="projected"><span>Saldo projetado</span><strong>+03:20</strong><small>no ritmo atual</small></div></section>
    <section className="panel entries-panel"><div className="entries-toolbar"><div><span>SEMANA 3 · 13 A 19 JUL</span><h2>Registros diários</h2></div><div className="week-total"><span>Subtotal da semana</span><strong>25:44</strong></div></div><div className="entry-list">{entries.map((entry) => <article key={`${entry.date}-${entry.start}`} className="entry-row"><div className="date-tile"><strong>{entry.date.split(" ")[0]}</strong><span>{entry.date.split(" ")[1]}</span></div><div className="entry-day"><strong>{entry.day}</strong><span>{entry.note ?? "Preenchido no mesmo dia"}</span></div><div className="time-block"><span>Entrada</span><strong>{entry.start}</strong></div><div className="time-separator">→</div><div className="time-block"><span>Saída</span><strong>{entry.end}</strong></div><div className="time-block break-block"><span>Intervalo</span><strong>{entry.breakTime}</strong></div><div className="entry-total"><span>Total</span><strong>{entry.total}</strong></div><span className={`entry-status ${entry.status}`}>{entry.status === "regular" ? "Regular" : entry.status === "late" ? "Com atraso" : "Pendente"}</span><button className="row-menu" aria-label={`Opções de ${entry.date}`}>•••</button></article>)}</div></section></>;
}

function BalanceView({ role }: { role: Role }) {
  const lots = role === "rh" ? balanceLots : [balanceLots[0], { name: "Marina Costa", type: "Crédito", amount: "+02:30", origin: "Jun/2026", deadline: "28/09/2026", days: 74, status: "Regular" }];
  return <><section className="page-heading"><div><span className="eyebrow">EXTRATO AUDITÁVEL</span><h1>Banco de horas</h1><p>Origem, movimentações e prazo de cada saldo preservados.</p></div><button className="secondary-button">Baixar extrato</button></section><section className="balance-hero"><div><span>SALDO LÍQUIDO</span><strong>+23:35</strong><p>Créditos disponíveis depois das reservas</p></div><div className="balance-breakdown"><p><span>Créditos disponíveis</span><strong>42:15</strong></p><p><span>Déficits pendentes</span><strong>18:40</strong></p><p><span>Horas reservadas</span><strong>08:00</strong></p></div><div className="fifo-card"><span>FIFO ATIVO</span><strong>Mais antigos primeiro</strong><p>As próximas compensações usarão os lotes de abril antes dos mais recentes.</p></div></section><section className="panel ledger-panel"><PanelHeading eyebrow="LOTES ABERTOS" title="Composição do saldo" action="Filtrar lotes" /><div className="table-scroll"><table><thead><tr><th>Prestador</th><th>Natureza</th><th>Origem</th><th>Valor original</th><th>Saldo restante</th><th>Data-limite</th><th>Situação</th></tr></thead><tbody>{lots.map((lot, index) => <tr key={`${lot.name}-${index}`}><td><strong>{lot.name}</strong></td><td><span className={lot.type === "Crédito" ? "credit-pill" : "debit-pill"}>{lot.type}</span></td><td>{lot.origin}</td><td>{lot.amount}</td><td><strong className={lot.type === "Crédito" ? "positive" : "negative"}>{lot.amount}</strong></td><td>{lot.deadline}</td><td><span className={`ledger-status ${lot.status.toLowerCase().replace("í", "i")}`}>{lot.status}</span></td></tr>)}</tbody></table></div></section></>;
}

function RequestsView({ role, filter, setFilter, notify }: { role: Role; filter: string; setFilter: (filter: string) => void; notify: (notice: string) => void }) {
  const filters = ["Todos", "Folgas", "Dias não úteis", "Ocorrências"];
  const visible = requestRows.filter((row) => filter === "Todos" || (filter === "Folgas" && row.kind.includes("Folga")) || (filter === "Dias não úteis" && row.kind.includes("não útil")) || (filter === "Ocorrências" && row.kind === "Atestado"));
  return <><section className="page-heading"><div><span className="eyebrow">FLUXOS DE APROVAÇÃO</span><h1>Solicitações</h1><p>{role === "rh" ? "Decida pendências e mantenha o fechamento em dia." : "Acompanhe seus pedidos e registre uma nova solicitação."}</p></div><button className="primary-button">+ Nova solicitação</button></section><div className="filter-tabs" role="tablist">{filters.map((item) => <button role="tab" aria-selected={filter === item} key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><section className="request-list">{visible.map((request) => <article className="request-card" key={request.person}><div className="request-card-icon">{request.kind.includes("Folga") ? "☼" : request.kind === "Atestado" ? "+" : "◷"}</div><div className="request-card-main"><span>{request.kind}</span><h3>{request.person}</h3><p><b>{request.date}</b> · {request.hours} solicitadas</p><small>“{request.kind.includes("Folga") ? "Compromisso pessoal previamente agendado." : request.kind === "Atestado" ? "Documento médico anexado para conferência." : "Atualização da infraestrutura de produção."}”</small></div><div className="request-card-status"><span>{request.status}</span><small>há {request.urgency.toLowerCase()}</small></div>{role === "rh" && <div className="request-actions"><button onClick={() => notify(`Solicitação de ${request.person} rejeitada.`)}>Rejeitar</button><button className="approve" onClick={() => notify(`Solicitação de ${request.person} aprovada.`)}>Aprovar</button></div>}</article>)}</section></>;
}

function TeamView() {
  return <><section className="page-heading"><div><span className="eyebrow">12 PRESTADORES ATIVOS</span><h1>Equipe</h1><p>Visão individual de preenchimento, saldo e competência.</p></div><button className="primary-button">+ Adicionar prestador</button></section><section className="team-grid">{contractors.map((person) => <article className="team-card" key={person.name}><div className={`team-avatar ${person.tone}`}>{person.initials}</div><div className="team-person"><h3>{person.name}</h3><span>Desenvolvimento · PJ</span></div><span className="active-pill">Ativo</span><div className="team-stats"><p><span>Preenchimento</span><strong>{person.fill}%</strong></p><p><span>Saldo atual</span><strong className={person.pending > 2 ? "negative" : "positive"}>{person.pending > 2 ? "−03:00" : "+05:20"}</strong></p></div><div className="team-progress"><span style={{ width: `${person.fill}%` }} /></div><button>Ver competência <span>→</span></button></article>)}</section></>;
}

function ReportsView({ notify }: { notify: (notice: string) => void }) {
  const reports = [{ title: "Fechamento mensal", text: "Horas trabalhadas, abonadas e saldo por prestador.", icon: "▦" }, { title: "Disciplina de preenchimento", text: "Atrasos, retroativos e dias pendentes no período.", icon: "◷" }, { title: "Extrato do banco de horas", text: "Lotes, movimentações, prazos e saldos restantes.", icon: "◫" }, { title: "Trilha de auditoria", text: "Alterações, justificativas e responsáveis por ação.", icon: "◎" }];
  return <><section className="page-heading"><div><span className="eyebrow">EXPORTAÇÕES</span><h1>Relatórios</h1><p>Informação confiável para conferência e prestação de contas.</p></div></section><section className="report-grid">{reports.map((report) => <article className="report-card" key={report.title}><div>{report.icon}</div><h2>{report.title}</h2><p>{report.text}</p><label>Competência<select><option>Julho de 2026</option><option>Junho de 2026</option><option>Maio de 2026</option></select></label><button onClick={() => notify(`${report.title} preparado para exportação.`)}>Gerar relatório <span>→</span></button></article>)}</section></>;
}

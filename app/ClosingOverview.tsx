import type { DashboardContractor, DashboardData } from "./dashboard-types";
import { formatMinutes, monthLabel } from "./HorusViews";

function ClosingGroup({ title, people, empty }: { title: string; people: DashboardContractor[]; empty: string }) {
  return <section className="closing-group panel">
    <div className="panel-heading static"><div><span>{people.length} PESSOA(S)</span><h2>{title}</h2></div></div>
    {people.length ? <div className="closing-person-list">{people.map((person) => <article className="closing-person-row" key={person.id}>
      <div className="mini-avatar violet">{person.initials}</div>
      <div><strong>{person.name}</strong><span>{person.status === "ACTIVE" ? "Colaborador ativo" : "Cadastro inativo"}</span></div>
      <p><span>Horas consideradas</span><strong>{formatMinutes(person.consideredMinutes)}</strong></p>
      <span className={"status-pill " + (person.timesheetStatus === "CLOSED" ? "neutral" : "warning")}>{person.timesheetStatus === "CLOSED" ? "Mês fechado" : "Em aberto"}</span>
    </article>)}</div> : <div className="empty-state"><strong>Sem dados</strong><p>{empty}</p></div>}
  </section>;
}

export function ClosingOverview({ data }: { data: DashboardData }) {
  const closed = data.contractors.filter((person) => person.timesheetStatus === "CLOSED");
  const open = data.contractors.filter((person) => person.status === "ACTIVE" && person.timesheetStatus !== "CLOSED");
  return <>
    <section className="page-heading closing-heading">
      <div><span className="eyebrow">SOMENTE CONFERÊNCIA</span><h1>Fechamento do mês</h1>
        <p>{monthLabel(data.period)} · Nenhum dado será alterado nesta tela.</p></div>
    </section>
    <section className="closing-groups">
      <ClosingGroup title="Em aberto" people={open} empty="Nenhum mês em aberto." />
      <ClosingGroup title="Mês fechado" people={closed} empty="Nenhum mês fechado neste período." />
    </section>
  </>;
}

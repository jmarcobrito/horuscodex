"use client";

import { useState } from "react";
import type { AdminData, AdminSector, AdminUser, SectorUpdate } from "./admin-types";
import { AdminView } from "./AdminView";
import type { DashboardPolicy } from "./dashboard-types";
import { SectorsPanel } from "./SectorsPanel";

type Tab = "sectors" | "policies" | "access";

type Props = {
  isDev: boolean;
  sectors: AdminSector[];
  adminData: AdminData | null;
  policy: DashboardPolicy;
  loading: boolean;
  onCreateSector: (name: string) => boolean | void | Promise<boolean | void>;
  onUpdateSector: (sector: AdminSector, update: SectorUpdate) => boolean | void | Promise<boolean | void>;
  onPolicy: () => void;
  onRole: (user: AdminUser, role: "RH" | "PJ") => void;
  onStatus: (user: AdminUser, status: "ACTIVE" | "INACTIVE") => void;
  onPassword: (user: AdminUser) => void;
  onViewAs: (user: AdminUser) => void;
};

function formatHours(minutes: number) {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export function PolicyPanel({ policy, loading, onPolicy }: Pick<Props, "policy" | "loading" | "onPolicy">) {
  return <section className="panel policy-panel" aria-labelledby="policies-title">
    <div className="panel-heading"><div><span>REGRAS OPERACIONAIS</span><h2 id="policies-title">Políticas da organização</h2></div><button type="button" disabled={loading} onClick={onPolicy}>Configurar políticas</button></div>
    <div className="admin-summary">
      <article><span>Carga mensal</span><strong>{formatHours(policy.monthlyRequiredMinutes)}</strong></article>
      <article><span>Aviso para folga</span><strong>{policy.minimumLeaveNoticeDays === null ? "Sem mínimo" : `${policy.minimumLeaveNoticeDays} dia(s)`}</strong></article>
      <article><span>Crédito após o prazo</span><strong>{policy.positiveBalanceAfterDeadlinePolicy === "ALLOW_AFTER_DEADLINE" ? "Continua disponível" : "Utilização bloqueada"}</strong></article>
    </div>
    <div className="audit-note"><span>◈</span><p><strong>Saldos antigos continuam protegidos</strong>Aplicar a política de prazo aos saldos antigos ainda abertos é uma alteração de dados e exige confirmação explícita dentro de “Configurar políticas”.</p></div>
  </section>;
}

export function AdministrationView(props: Props) {
  const [tab, setTab] = useState<Tab>("sectors");
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "sectors", label: "Setores" },
    { value: "policies", label: "Políticas" },
    ...(props.isDev ? [{ value: "access" as const, label: "Acessos" }] : []),
  ];

  return <>
    <section className="page-heading"><div><span className="eyebrow">ORGANIZAÇÃO E REGRAS</span><h1>Administração</h1><p>Gerencie setores e políticas; controles de acesso permanecem restritos ao perfil autorizado.</p></div></section>
    <div className="filter-tabs administration-tabs" role="tablist" aria-label="Áreas da Administração">{tabs.map(item => <button key={item.value} type="button" role="tab" id={`administration-tab-${item.value}`} aria-controls="administration-panel" aria-selected={tab === item.value} className={tab === item.value ? "active" : ""} onClick={() => setTab(item.value)}>{item.label}</button>)}</div>
    <div id="administration-panel" role="tabpanel" aria-labelledby={`administration-tab-${tab}`}>
      {tab === "sectors" && <SectorsPanel sectors={props.sectors} loading={props.loading} onCreate={props.onCreateSector} onUpdate={props.onUpdateSector} />}
      {tab === "policies" && <PolicyPanel policy={props.policy} loading={props.loading} onPolicy={props.onPolicy} />}
      {tab === "access" && props.isDev && <AdminView data={props.adminData} loading={props.loading} onRole={props.onRole} onStatus={props.onStatus} onPassword={props.onPassword} onViewAs={props.onViewAs} />}
    </div>
  </>;
}

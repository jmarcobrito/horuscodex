import type { AdminData, AdminUser } from "./admin-types";
import { SelectMenu } from "./SelectMenu";

type Props = {
  data: AdminData | null;
  loading: boolean;
  onRole: (user: AdminUser, role: "RH" | "PJ") => void;
  onStatus: (user: AdminUser, status: "ACTIVE" | "INACTIVE") => void;
  onPassword: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onViewAs: (user: AdminUser) => void;
};

function roleLabel(role: AdminUser["role"]) {
  if (role === "PJ") return "Prestador PJ";
  if (role === "DEV") return "Desenvolvedor";
  if (role === "ADMIN") return "Administrador";
  return "Recursos Humanos";
}

function actionLabel(action: string) {
  return ({
    USER_ROLE_CHANGED: "Perfil alterado",
    USER_STATUS_CHANGED: "Situação alterada",
    USER_PASSWORD_SET: "Senha redefinida",
    USER_DELETED: "Usuário excluído",
  } as Record<string, string>)[action] ?? action.replaceAll("_", " ").toLowerCase();
}

export function AdminView({ data, loading, onRole, onStatus, onPassword, onDelete, onViewAs }: Props) {
  return <>
    <section className="page-heading admin-heading"><div><span className="eyebrow">ACESSO EXCLUSIVO DEV</span><h1>Administração</h1><p>Gerencie perfil e acesso sem misturar a função da pessoa com a situação do cadastro.</p></div><span className="dev-protection-badge">DEV PROTEGIDO</span></section>
    <section className="admin-summary">
      <article><span>Usuários</span><strong>{data?.users.length ?? "—"}</strong></article>
      <article><span>RH ativos</span><strong>{data?.users.filter((user) => user.role === "RH" && user.status === "ACTIVE").length ?? "—"}</strong></article>
      <article><span>PJs ativos</span><strong>{data?.users.filter((user) => user.role === "PJ" && user.status === "ACTIVE").length ?? "—"}</strong></article>
    </section>
    <section className="panel admin-users-panel">
      <div className="panel-heading static"><div><span>CONTROLE DE ACESSO</span><h2>Usuários da organização</h2></div></div>
      {loading && !data ? <div className="empty-state"><strong>Carregando usuários…</strong></div> : data?.users.length ? <div className="admin-user-list">{data.users.map((user) => {
        const protectedUser = user.role === "DEV";
        return <article className={"admin-user-row " + (user.status === "INACTIVE" ? "inactive" : "")} key={user.id}>
          <div className="admin-user-avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
          <div className="admin-user-identity"><strong>{user.name}</strong><span>{user.email}</span></div>
          <div className="admin-user-field"><span>Perfil</span>{protectedUser ? <strong className="locked-role">Desenvolvedor</strong> : <SelectMenu ariaLabel={`Perfil de ${user.name}`} value={user.role === "PJ" ? "PJ" : "RH"} onChange={(value) => onRole(user, value as "RH" | "PJ")} disabled={loading} options={[{ value: "RH", label: "Recursos Humanos", description: "Gerencia equipe e aprovações" }, { value: "PJ", label: "Prestador PJ", description: "Registra e acompanha as próprias horas" }]} />}</div>
          <div className="admin-user-field"><span>Situação</span>{protectedUser ? <strong className="locked-role">Ativo</strong> : <SelectMenu ariaLabel={`Situação de ${user.name}`} value={user.status} onChange={(value) => onStatus(user, value as "ACTIVE" | "INACTIVE")} disabled={loading} options={[{ value: "ACTIVE", label: "Ativo", description: "Acesso liberado ao Horus" }, { value: "INACTIVE", label: "Inativo", description: "Acesso bloqueado, histórico preservado" }]} />}</div>
          <div className="admin-user-actions">
            {user.role === "PJ" && <button className="view-as-action" onClick={() => onViewAs(user)} disabled={loading}>Visualizar como</button>}
            {!protectedUser && <button onClick={() => onPassword(user)} disabled={loading}>Definir senha</button>}
            {!protectedUser && user.role === "PJ" && <button className="delete-action" onClick={() => onDelete(user)} disabled={loading}>Excluir</button>}
          </div>
          <small className="admin-user-note">{protectedUser ? "Este perfil não pode ser rebaixado, inativado ou excluído." : `${roleLabel(user.role)} · ${user.hasAccess ? "conta vinculada" : "conta ainda não vinculada"}`}</small>
        </article>;
      })}</div> : <div className="empty-state"><strong>Nenhum usuário encontrado</strong></div>}
    </section>
    <section className="panel ledger-panel admin-audit-panel"><div className="panel-heading static"><div><span>SEGURANÇA</span><h2>Histórico administrativo</h2></div></div>{data?.audits.length ? <div className="table-scroll"><table><thead><tr><th>Data</th><th>Responsável</th><th>Ação</th><th>Usuário afetado</th><th>Justificativa</th></tr></thead><tbody>{data.audits.map((audit) => <tr key={audit.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(audit.createdAt))}</td><td>{audit.actorName}</td><td>{actionLabel(audit.action)}</td><td>{audit.targetName}</td><td>{audit.reason || "—"}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>Sem ações administrativas recentes</strong></div>}</section>
  </>;
}

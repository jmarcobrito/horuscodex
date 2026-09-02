import type { User as AuthUser } from "@supabase/supabase-js";

import { requireActor } from "../../../../db/actor";
import { apiFailure, cleanText, readJson } from "../../../../db/http";
import { getSupabaseAdmin } from "../../../../db/supabase";

export const dynamic = "force-dynamic";

type UserRow = { id: string; auth_user_id: string | null; name: string; email: string; role: "DEV" | "RH" | "PJ" | "ADMIN"; status: "ACTIVE" | "INACTIVE"; created_at: string; updated_at: string };
type AuditRow = { id: string; user_id: string; action: string; entity_id: string; reason: string | null; created_at: string };

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 72;
}
async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const admin = getSupabaseAdmin();
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const match = result.data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (result.data.users.length < 1000) break;
  }
  return null;
}

async function requireDev() {
  const actor = await requireActor();
  if (actor.role !== "DEV") return { actor, denied: Response.json({ error: "Apenas o perfil DEV pode acessar a Administração." }, { status: 403 }) };
  return { actor, denied: null };
}

async function loadTarget(actor: Awaited<ReturnType<typeof requireActor>>, id: string) {
  const admin = getSupabaseAdmin();
  const result = await admin.from("users").select("id,auth_user_id,name,email,role,status,created_at,updated_at")
    .eq("id", id).eq("organization_id", actor.organizationId).maybeSingle();
  if (result.error) throw result.error;
  return result.data as UserRow | null;
}

async function writeAudit(actor: Awaited<ReturnType<typeof requireActor>>, action: string, target: UserRow, reason: string, previousValue?: unknown, newValue?: unknown) {
  const result = await getSupabaseAdmin().from("audit_logs").insert({
    id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
    action, entity_type: "User", entity_id: target.id, reason,
    previous_value: previousValue ?? target, new_value: newValue ?? null,
  });
  if (result.error) throw result.error;
}

export async function GET() {
  try {
    const { actor, denied } = await requireDev();
    if (denied) return denied;
    const admin = getSupabaseAdmin();
    const [usersResult, auditsResult] = await Promise.all([
      admin.from("users").select("id,auth_user_id,name,email,role,status,created_at,updated_at").eq("organization_id", actor.organizationId).order("name"),
      admin.from("audit_logs").select("id,user_id,action,entity_id,reason,created_at").eq("organization_id", actor.organizationId).eq("entity_type", "User").order("created_at", { ascending: false }).limit(80),
    ]);
    if (usersResult.error) throw usersResult.error;
    if (auditsResult.error) throw auditsResult.error;
    const users = (usersResult.data ?? []) as UserRow[];
    const names = new Map(users.map((user) => [user.id, user.name]));
    return Response.json({
      users: users.map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, hasAccess: Boolean(user.auth_user_id), createdAt: user.created_at, updatedAt: user.updated_at })),
      audits: ((auditsResult.data ?? []) as AuditRow[]).map((audit) => ({ id: audit.id, actorName: names.get(audit.user_id) ?? "Usuário removido", action: audit.action, targetName: names.get(audit.entity_id) ?? "Usuário removido", reason: audit.reason ?? "", createdAt: audit.created_at })),
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiFailure(error, "admin users read"); }
}

export async function PATCH(request: Request) {
  const body = (await readJson(request) as Record<string, unknown> | null) ?? {};
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!id || !action) return Response.json({ error: "Usuário e ação são obrigatórios." }, { status: 400 });

  try {
    const { actor, denied } = await requireDev();
    if (denied) return denied;
    const target = await loadTarget(actor, id);
    if (!target) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    if (target.role === "DEV" || target.id === actor.id) return Response.json({ error: "O perfil DEV é protegido e não pode ser alterado." }, { status: 409 });
    const admin = getSupabaseAdmin();

    if (action === "SET_PASSWORD") {
      if (!validPassword(body.password)) return Response.json({ error: "A nova senha deve ter entre 8 e 72 caracteres." }, { status: 400 });
      let authUserId = target.auth_user_id;
      if (!authUserId) {
        const existing = await findAuthUserByEmail(target.email.toLowerCase());
        if (existing) authUserId = existing.id;
        else {
          const created = await admin.auth.admin.createUser({ email: target.email, password: body.password, email_confirm: true, user_metadata: { name: target.name } });
          if (created.error || !created.data.user) throw created.error ?? new Error("Conta de acesso não criada.");
          authUserId = created.data.user.id;
        }
        const bind = await admin.from("users").update({ auth_user_id: authUserId, updated_at: new Date().toISOString() }).eq("id", target.id);
        if (bind.error) throw bind.error;
      }
      const passwordResult = await admin.auth.admin.updateUserById(authUserId, { password: body.password, email_confirm: true });
      if (passwordResult.error) throw passwordResult.error;
      await writeAudit(actor, "USER_PASSWORD_SET", target, "Senha redefinida pelo perfil DEV.", undefined, { access_method: "PASSWORD_OR_GOOGLE" });
      return Response.json({ message: `Senha de ${target.name} atualizada.` });
    }

    const reason = cleanText(body.reason, 2000);
    if (reason.length < 5) return Response.json({ error: "Informe uma justificativa com pelo menos 5 caracteres." }, { status: 400 });
    if (action === "SET_ROLE") {
      const role = body.role === "PJ" ? "PJ" : body.role === "RH" ? "RH" : null;
      if (!role) return Response.json({ error: "Perfil inválido." }, { status: 400 });
      const update = { role, updated_at: new Date().toISOString() };
      const result = await admin.from("users").update(update).eq("id", target.id).eq("organization_id", actor.organizationId);
      if (result.error) throw result.error;
      await writeAudit(actor, "USER_ROLE_CHANGED", target, reason, target, { ...target, ...update });
      return Response.json({ message: `${target.name} agora possui o perfil ${role === "RH" ? "RH" : "Prestador PJ"}.` });
    }
    if (action === "SET_STATUS") {
      const status = body.status === "ACTIVE" ? "ACTIVE" : body.status === "INACTIVE" ? "INACTIVE" : null;
      if (!status) return Response.json({ error: "Situação inválida." }, { status: 400 });
      const update = { status, updated_at: new Date().toISOString() };
      const result = await admin.from("users").update(update).eq("id", target.id).eq("organization_id", actor.organizationId);
      if (result.error) throw result.error;
      await writeAudit(actor, "USER_STATUS_CHANGED", target, reason, target, { ...target, ...update });
      return Response.json({ message: `${target.name} foi ${status === "ACTIVE" ? "reativado" : "inativado"}.` });
    }
    return Response.json({ error: "Ação administrativa inválida." }, { status: 400 });
  } catch (error) { return apiFailure(error, "admin user update"); }
}

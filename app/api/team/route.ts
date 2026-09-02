import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

function safeId(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 72;
}

async function findAuthUserByEmail(admin: ReturnType<typeof getSupabaseAdmin>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const match = result.data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (result.data.users.length < 1000) break;
  }
  return null;
}

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const name = cleanText(body?.name, 200);
  const email = cleanText(body?.email, 320).toLowerCase();
  const password = body?.password;
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validPassword(password)) {
    return Response.json({ error: "Nome, e-mail e senha inicial com pelo menos 8 caracteres são obrigatórios." }, { status: 400 });
  }

  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode cadastrar colaboradores." }, { status: 403 });
    const admin = getSupabaseAdmin();
    const existing = await admin.from("users").select("id").eq("email", email).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return Response.json({ error: "Este e-mail já possui cadastro." }, { status: 409 });

    const authResult = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (authResult.error || !authResult.data.user) {
      console.error("[horus] Could not create contractor auth user", authResult.error);
      return Response.json({ error: "Este e-mail já possui uma conta de acesso ou não pôde ser cadastrado." }, { status: 409 });
    }

    const id = "usr_" + safeId(email);
    const row = {
      id,
      auth_user_id: authResult.data.user.id,
      organization_id: actor.organizationId,
      name,
      email,
      role: "PJ",
      status: "ACTIVE",
    };
    const result = await admin.from("users").insert(row);
    if (result.error) {
      await admin.auth.admin.deleteUser(authResult.data.user.id);
      throw result.error;
    }

    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "CONTRACTOR_CREATED", entity_type: "User", entity_id: id,
      new_value: { ...row, access_method: "PASSWORD_OR_GOOGLE" },
    });
    if (audit.error) throw audit.error;
    return Response.json({
      id,
      message: "Colaborador cadastrado. Compartilhe a senha inicial por um canal seguro.",
    }, { status: 201 });
  } catch (error) { return apiFailure(error, "contractor create"); }
}

export async function PATCH(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") {
    return Response.json({ error: "Dados do colaborador inválidos." }, { status: 400 });
  }

  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode alterar colaboradores." }, { status: 403 });
    const admin = getSupabaseAdmin();

    if (body.action === "SET_PASSWORD") {
      if (!validPassword(body.password)) {
        return Response.json({ error: "A nova senha deve ter entre 8 e 72 caracteres." }, { status: 400 });
      }
      const current = await admin.from("users").select("id,auth_user_id,organization_id,name,email,role,status")
        .eq("id", body.id).eq("organization_id", actor.organizationId).eq("role", "PJ").maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return Response.json({ error: "Colaborador não encontrado." }, { status: 404 });

      let authUserId = current.data.auth_user_id as string | null;
      if (!authUserId) {
        const existingAuthUser = await findAuthUserByEmail(admin, String(current.data.email).toLowerCase());
        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
          const updated = await admin.auth.admin.updateUserById(authUserId, { password: body.password, email_confirm: true });
          if (updated.error) throw updated.error;
        } else {
          const created = await admin.auth.admin.createUser({
            email: String(current.data.email),
            password: body.password,
            email_confirm: true,
            user_metadata: { name: current.data.name },
          });
          if (created.error || !created.data.user) throw created.error ?? new Error("Conta de acesso não criada.");
          authUserId = created.data.user.id;
        }
        const bind = await admin.from("users")
          .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
          .eq("id", body.id);
        if (bind.error) throw bind.error;
      } else {
        const updated = await admin.auth.admin.updateUserById(authUserId, { password: body.password, email_confirm: true });
        if (updated.error) throw updated.error;
      }

      const audit = await admin.from("audit_logs").insert({
        id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
        action: "CONTRACTOR_PASSWORD_SET", entity_type: "User", entity_id: body.id,
        new_value: { access_method: "PASSWORD_OR_GOOGLE" },
      });
      if (audit.error) throw audit.error;
      return Response.json({ id: body.id, message: "Senha do colaborador atualizada." });
    }

    if (!["ACTIVE", "INACTIVE"].includes(String(body.status))) {
      return Response.json({ error: "Situação do colaborador inválida." }, { status: 400 });
    }
    const current = await admin.from("users").select("*").eq("id", body.id)
      .eq("organization_id", actor.organizationId).eq("role", "PJ").maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return Response.json({ error: "Colaborador não encontrado." }, { status: 404 });
    const update = { status: String(body.status), updated_at: new Date().toISOString() };
    const result = await admin.from("users").update(update).eq("id", body.id);
    if (result.error) throw result.error;
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "CONTRACTOR_STATUS_CHANGED", entity_type: "User", entity_id: body.id,
      previous_value: current.data, new_value: { ...current.data, ...update }, reason: cleanText(body.reason) || null,
    });
    if (audit.error) throw audit.error;
    return Response.json({ id: body.id, status: body.status });
  } catch (error) { return apiFailure(error, "contractor update"); }
}


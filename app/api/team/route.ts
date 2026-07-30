import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

function safeId(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const name = cleanText(body?.name, 200); const email = cleanText(body?.email, 320).toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Nome e e-mail válidos são obrigatórios." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode cadastrar prestadores." }, { status: 403 });
    const admin = getSupabaseAdmin();
    const existing = await admin.from("users").select("id").eq("email", email).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return Response.json({ error: "Este e-mail já possui cadastro." }, { status: 409 });
    const id = "usr_" + safeId(email);
    const row = { id, organization_id: actor.organizationId, name, email, role: "PJ", status: "ACTIVE" };
    const result = await admin.from("users").insert(row);
    if (result.error) throw result.error;

    const redirectTo = new URL("/auth/callback", request.url).toString();
    const accessEmail = await admin.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });
    const accessEmailSent = !accessEmail.error;
    if (accessEmail.error) {
      console.error("[horus] Contractor created, but access email could not be sent", accessEmail.error);
    }

    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "CONTRACTOR_CREATED", entity_type: "User", entity_id: id,
      new_value: { ...row, access_email_sent: accessEmailSent },
    });
    if (audit.error) throw audit.error;
    return Response.json({
      id,
      accessEmailSent,
      message: accessEmailSent
        ? "Prestador cadastrado e link de acesso enviado por e-mail."
        : "Prestador cadastrado, mas o e-mail de acesso não pôde ser enviado. Verifique o SMTP e tente o acesso pela tela de login.",
    }, { status: 201 });
  } catch (error) { return apiFailure(error, "contractor create"); }
}

export async function PATCH(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string" || !["ACTIVE", "INACTIVE"].includes(String(body.status))) {
    return Response.json({ error: "Dados do prestador inválidos." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode alterar prestadores." }, { status: 403 });
    const admin = getSupabaseAdmin();
    const current = await admin.from("users").select("*").eq("id", body.id)
      .eq("organization_id", actor.organizationId).eq("role", "PJ").maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return Response.json({ error: "Prestador não encontrado." }, { status: 404 });
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
  } catch (error) { return apiFailure(error, "contractor status"); }
}

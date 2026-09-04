import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, privateJson, readJson } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

function sectorName(value: unknown) {
  const name = cleanText(value, 121);
  return name.length >= 1 && name.length <= 120 ? name : null;
}

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

function sectorAccessFailure() {
  return privateJson({ error: "Apenas o RH pode gerenciar setores." }, { status: 403 });
}

export async function GET() {
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return sectorAccessFailure();
    const result = await getSupabaseAdmin().from("sectors").select("id,name,status,created_at,updated_at")
      .eq("organization_id", actor.organizationId).order("name").order("id");
    if (result.error) throw result.error;
    return privateJson({ sectors: result.data ?? [] });
  } catch (error) { return apiFailure(error, "sectors read"); }
}

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  const name = sectorName(body?.name);
  if (!name) return privateJson({ error: "Informe um nome de setor entre 1 e 120 caracteres." }, { status: 400 });

  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return sectorAccessFailure();
    const admin = getSupabaseAdmin();
    const existing = await admin.from("sectors").select("id,name").eq("organization_id", actor.organizationId);
    if (existing.error) throw existing.error;
    if ((existing.data ?? []).some((sector) => normalizedName(String(sector.name)) === normalizedName(name))) {
      return privateJson({ error: "Já existe um setor com este nome." }, { status: 409 });
    }
    const row = { id: "sec_" + crypto.randomUUID(), organization_id: actor.organizationId, name, status: "ACTIVE" };
    const created = await admin.from("sectors").insert(row);
    if (created.error) throw created.error;
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "SECTOR_CREATED", entity_type: "Sector", entity_id: row.id, new_value: row,
    });
    if (audit.error) throw audit.error;
    return privateJson({ id: row.id, name: row.name, status: row.status }, { status: 201 });
  } catch (error) { return apiFailure(error, "sector create"); }
}

export async function PATCH(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const name = sectorName(body?.name);
  const status = typeof body?.status === "string" ? body.status : "";
  const reason = cleanText(body?.reason);
  if (!id || !name || !["ACTIVE", "INACTIVE"].includes(status) || reason.length < 5) {
    return privateJson({ error: "Dados do setor inválidos. Informe uma justificativa de ao menos 5 caracteres." }, { status: 400 });
  }

  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return sectorAccessFailure();
    const admin = getSupabaseAdmin();
    const current = await admin.from("sectors").select("*").eq("id", id).eq("organization_id", actor.organizationId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return privateJson({ error: "Setor não encontrado." }, { status: 404 });
    const sameName = await admin.from("sectors").select("id,name").eq("organization_id", actor.organizationId);
    if (sameName.error) throw sameName.error;
    if ((sameName.data ?? []).some((sector) => sector.id !== id && normalizedName(String(sector.name)) === normalizedName(name))) {
      return privateJson({ error: "Já existe um setor com este nome." }, { status: 409 });
    }
    const update = { name, status, updated_at: new Date().toISOString() };
    const changed = await admin.from("sectors").update(update).eq("id", id).eq("organization_id", actor.organizationId);
    if (changed.error) throw changed.error;
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: current.data.status === status ? "SECTOR_UPDATED" : "SECTOR_STATUS_CHANGED",
      entity_type: "Sector", entity_id: id, previous_value: current.data, new_value: { ...current.data, ...update }, reason,
    });
    if (audit.error) throw audit.error;
    return privateJson({ id, name, status });
  } catch (error) { return apiFailure(error, "sector update"); }
}

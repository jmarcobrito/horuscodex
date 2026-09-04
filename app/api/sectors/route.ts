import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, privateJson, readJson } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

function sectorName(value: unknown) {
  const name = cleanText(value, 121);
  return name.length >= 1 && name.length <= 120 ? name : null;
}

function sectorAccessFailure() {
  return privateJson({ error: "Usuário sem permissão para gerenciar setores." }, { status: 403 });
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
    const created = await getSupabaseAdmin().rpc("create_sector", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id,
      p_sector_id: "sec_" + crypto.randomUUID(), p_name: name,
    });
    if (created.error) throw created.error;
    return privateJson(created.data, { status: 201 });
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
    const changed = await getSupabaseAdmin().rpc("update_sector", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id, p_sector_id: id,
      p_name: name, p_status: status, p_reason: reason,
    });
    if (changed.error) throw changed.error;
    return privateJson(changed.data);
  } catch (error) { return apiFailure(error, "sector update"); }
}

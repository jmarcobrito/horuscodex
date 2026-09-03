import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

const types = new Set(["VACATION", "JUSTIFIED_ABSENCE", "MEDICAL_CERTIFICATE", "BANK_LEAVE", "OTHER"]);
const effects = new Set(["CREDITS_HOURS", "DOES_NOT_CREDIT", "CONSUMES_BALANCE"]);

function defaultEffect(type: string) {
  if (type === "VACATION" || type === "MEDICAL_CERTIFICATE") return "CREDITS_HOURS";
  if (type === "BANK_LEAVE") return "CONSUMES_BALANCE";
  return "DOES_NOT_CREDIT";
}

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || !types.has(String(body.type)) || !validIsoDate(body.startDate) || !validIsoDate(body.endDate)
      || String(body.startDate) > String(body.endDate) || !Number.isInteger(body.minutes) || Number(body.minutes) < 0) {
    return Response.json({ error: "Dados da ocorrência inválidos." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return Response.json({ error: "Selecione o colaborador." }, { status: 400 });
    const requestedEffect = String(body.calculationEffect ?? "");
    const effect = actor.role === "PJ" || !effects.has(requestedEffect)
      ? defaultEffect(String(body.type)) : requestedEffect;
    const { data, error } = await getSupabaseAdmin().rpc("create_occurrence", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id, p_contractor_id: contractorId,
      p_type: String(body.type), p_start_date: body.startDate, p_end_date: body.endDate,
      p_minutes: Number(body.minutes), p_calculation_effect: effect, p_description: cleanText(body.description),
    });
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (error) { return apiFailure(error, "occurrence create"); }
}

export async function PATCH(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "CANCEL"].includes(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ" && action !== "CANCEL") return Response.json({ error: "Apenas o RH pode decidir ocorrências." }, { status: 403 });
    const { data, error } = await getSupabaseAdmin().rpc("decide_occurrence", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id, p_occurrence_id: body.id,
      p_action: action, p_notes: cleanText(body.notes),
    });
    if (error) throw error;
    return Response.json(data);
  } catch (error) { return apiFailure(error, "occurrence decision"); }
}


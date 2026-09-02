import { requireActor } from "../../../db/actor";
import { validateDailyAllocation } from "../../../db/daily-allocation";
import { apiDomainError, apiError, apiFailure, cleanText, readJson } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

const types = new Set(["VACATION", "JUSTIFIED_ABSENCE", "MEDICAL_CERTIFICATE", "OTHER"]);
const effects = new Set(["CREDITS_HOURS", "DOES_NOT_CREDIT", "CONSUMES_BALANCE"]);

function defaultEffect(type: string) {
  if (type === "VACATION" || type === "MEDICAL_CERTIFICATE") return "CREDITS_HOURS";
  return "DOES_NOT_CREDIT";
}

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || !types.has(String(body.type))) {
    return apiError("INVALID_OCCURRENCE_TYPE", "Selecione um tipo válido.", 400, "type");
  }
  const allocation = validateDailyAllocation({
    startDate: body.startDate,
    endDate: body.endDate,
    totalMinutes: body.minutes,
    days: body.days,
  });
  if (!allocation.ok) return apiDomainError(allocation.code, allocation.field);
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return apiError("CONTRACTOR_REQUIRED", "Selecione o colaborador.", 400, "contractorId");
    const requestedEffect = String(body.calculationEffect ?? "");
    const effect = actor.role === "PJ" || !effects.has(requestedEffect)
      ? defaultEffect(String(body.type)) : requestedEffect;
    const admin = getSupabaseAdmin();
    const result = await admin.rpc("create_occurrence_v2", {
      p_organization_id: actor.organizationId,
      p_actor_id: actor.id,
      p_contractor_id: contractorId,
      p_type: String(body.type),
      p_start_date: String(body.startDate),
      p_end_date: String(body.endDate),
      p_minutes: Number(body.minutes),
      p_calculation_effect: effect,
      p_description: cleanText(body.description),
      p_days: allocation.days,
    });
    if (result.error) throw result.error;
    return Response.json(result.data, { status: 201 });
  } catch (error) { return apiFailure(error, "occurrence create"); }
}

export async function PATCH(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "CANCEL"].includes(action)) {
    return apiDomainError("INVALID_ACTION", "action");
  }
  try {
    const actor = await requireActor();
    const admin = getSupabaseAdmin();
    const result = await admin.rpc("decide_occurrence_v2", {
      p_organization_id: actor.organizationId,
      p_actor_id: actor.id,
      p_occurrence_id: body.id,
      p_action: action,
      p_notes: cleanText(body.notes) || null,
    });
    if (result.error) throw result.error;
    return Response.json(result.data);
  } catch (error) { return apiFailure(error, "occurrence decision"); }
}


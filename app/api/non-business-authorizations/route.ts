import { requireActor } from "../../../db/actor";
import { apiDomainError, apiError, apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || !validIsoDate(body.workDate) || !Number.isInteger(body.estimatedMinutes)
      || Number(body.estimatedMinutes) <= 0 || Number(body.estimatedMinutes) > 1440) {
    return apiError("INVALID_AUTHORIZATION", "Revise a data e as horas da autorização.", 400, null);
  }
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return apiError("CONTRACTOR_REQUIRED", "Selecione o colaborador.", 400, "contractorId");
    const admin = getSupabaseAdmin();
    const result = await admin.rpc("create_non_business_authorization_v2", {
      p_organization_id: actor.organizationId,
      p_actor_id: actor.id,
      p_contractor_id: contractorId,
      p_work_date: String(body.workDate),
      p_estimated_minutes: Number(body.estimatedMinutes),
      p_reason: cleanText(body.reason),
    });
    if (result.error) throw result.error;
    return Response.json(result.data, { status: 201 });
  } catch (error) { return apiFailure(error, "non-business authorization create"); }
}

export async function PATCH(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "NEEDS_ADJUSTMENT"].includes(action)) {
    return apiDomainError("INVALID_ACTION", "action");
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return apiError("ACTOR_NOT_AUTHORIZED", "Apenas o RH pode analisar autorizações.", 403, null, "GO_BACK");
    const admin = getSupabaseAdmin();
    const result = await admin.rpc("decide_non_business_authorization_v2", {
      p_organization_id: actor.organizationId,
      p_actor_id: actor.id,
      p_authorization_id: body.id,
      p_action: action,
      p_approved_minutes: action === "APPROVE" ? Number(body.approvedMinutes) || null : null,
      p_notes: cleanText(body.notes) || null,
    });
    if (result.error) throw result.error;
    return Response.json(result.data);
  } catch (error) { return apiFailure(error, "non-business authorization decision"); }
}


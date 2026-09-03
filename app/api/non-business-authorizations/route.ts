import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || !validIsoDate(body.workDate) || !Number.isInteger(body.estimatedMinutes)
      || Number(body.estimatedMinutes) <= 0 || Number(body.estimatedMinutes) > 1440) {
    return Response.json({ error: "Dados da autorização inválidos." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return Response.json({ error: "Selecione o colaborador." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().rpc("request_non_business_authorization", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id, p_contractor_id: contractorId,
      p_work_date: body.workDate, p_estimated_minutes: Number(body.estimatedMinutes), p_reason: cleanText(body.reason),
    });
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (error) { return apiFailure(error, "non-business authorization create"); }
}

export async function PATCH(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "NEEDS_ADJUSTMENT"].includes(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }
  if (action === "APPROVE" && body.approvedMinutes !== undefined
      && (!Number.isInteger(body.approvedMinutes) || Number(body.approvedMinutes) < 1 || Number(body.approvedMinutes) > 1440)) {
    return Response.json({ error: "Informe entre 1 e 1440 minutos para aprovar." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode decidir autorizações." }, { status: 403 });
    // One database transaction owns the decision, daily version, calculation and audit.
    // Do not fall back to separate writes or retry an uncertain decision.
    const { data, error } = await getSupabaseAdmin().rpc("decide_non_business_authorization", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id, p_authorization_id: body.id,
      p_action: action, p_approved_minutes: action === "APPROVE" && body.approvedMinutes !== undefined ? Number(body.approvedMinutes) : null,
      p_notes: cleanText(body.notes),
    });
    if (error) throw error;
    return Response.json(data);
  } catch (error) { return apiFailure(error, "non-business authorization decision"); }
}


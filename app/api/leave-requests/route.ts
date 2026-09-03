import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || !validIsoDate(body.startDate) || !validIsoDate(body.endDate)
      || String(body.startDate) > String(body.endDate) || !Number.isInteger(body.requestedMinutes)
      || Number(body.requestedMinutes) <= 0) {
    return Response.json({ error: "Dados da solicitação de folga inválidos." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return Response.json({ error: "Selecione o colaborador." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const result = await admin.rpc("create_leave_request", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id, p_contractor_id: contractorId,
      p_start_date: body.startDate, p_end_date: body.endDate,
      p_requested_minutes: body.requestedMinutes, p_reason: cleanText(body.reason),
    });
    if (result.error) throw result.error;
    return Response.json(result.data, { status: 201 });
  } catch (error) { return apiFailure(error, "leave request create"); }
}

export async function PATCH(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "CANCEL", "UTILIZE"].includes(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const admin = getSupabaseAdmin();
    if (actor.role === "PJ" && action !== "CANCEL") {
      return Response.json({ error: "Apenas o RH pode realizar essa decisão." }, { status: 403 });
    }
    const result = await admin.rpc("decide_leave_request", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id,
      p_request_id: body.id, p_action: action, p_notes: cleanText(body.notes) || null,
    });
    if (result.error) throw result.error;
    return Response.json({ id: body.id, action });
  } catch (error) { return apiFailure(error, "leave request decision"); }
}


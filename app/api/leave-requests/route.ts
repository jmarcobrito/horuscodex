import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
    const { data: policy, error: policyError } = await admin.from("organization_policies")
      .select("minimum_leave_notice_days").eq("organization_id", actor.organizationId).maybeSingle();
    if (policyError) throw policyError;
    const minimum = policy?.minimum_leave_notice_days ?? 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(String(body.startDate) + "T00:00:00");
    const noticeDays = Math.round((start.getTime() - today.getTime()) / 86_400_000);
    if (noticeDays < minimum) return Response.json({ error: `A folga exige antecedência mínima de ${minimum} dia(s).` }, { status: 409 });
    const id = crypto.randomUUID();
    const row = {
      id, organization_id: actor.organizationId, contractor_id: contractorId,
      start_date: String(body.startDate), end_date: String(body.endDate),
      requested_minutes: Number(body.requestedMinutes), reason: cleanText(body.reason), status: "REQUESTED",
    };
    const result = await admin.from("leave_requests").insert(row);
    if (result.error) throw result.error;
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "LEAVE_REQUEST_CREATED", entity_type: "LeaveRequest", entity_id: id, new_value: row,
    });
    if (audit.error) throw audit.error;
    return Response.json({ id, status: "REQUESTED" }, { status: 201 });
  } catch (error) { return apiFailure(error, "leave request create"); }
}

export async function PATCH(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "CANCEL", "UTILIZE"].includes(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const admin = getSupabaseAdmin();
    const { data: leave, error } = await admin.from("leave_requests").select("contractor_id")
      .eq("id", body.id).eq("organization_id", actor.organizationId).maybeSingle();
    if (error) throw error;
    if (!leave) return Response.json({ error: "Solicitação não encontrada." }, { status: 404 });
    if (actor.role === "PJ" && (leave.contractor_id !== actor.id || action !== "CANCEL")) {
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


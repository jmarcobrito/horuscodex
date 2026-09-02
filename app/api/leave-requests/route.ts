import { requireActor } from "../../../db/actor";
import { validateDailyAllocation } from "../../../db/daily-allocation";
import { apiDomainError, apiError, apiFailure, cleanText, readJson } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body) return apiDomainError("INVALID_DAILY_ALLOCATION", "days");
  const allocation = validateDailyAllocation({
    startDate: body.startDate,
    endDate: body.endDate,
    totalMinutes: body.requestedMinutes,
    days: body.days,
  });
  if (!allocation.ok) return apiDomainError(allocation.code, allocation.field);
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return apiError("CONTRACTOR_REQUIRED", "Selecione o colaborador.", 400, "contractorId");
    const admin = getSupabaseAdmin();
    const { data: policy, error: policyError } = await admin.from("organization_policies")
      .select("minimum_leave_notice_days").eq("organization_id", actor.organizationId).maybeSingle();
    if (policyError) throw policyError;
    const minimum = policy?.minimum_leave_notice_days ?? 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(String(body.startDate) + "T00:00:00");
    const noticeDays = Math.round((start.getTime() - today.getTime()) / 86_400_000);
    if (noticeDays < minimum) {
      return apiError(
        "MINIMUM_NOTICE_REQUIRED",
        `Esta folga precisa ser solicitada com pelo menos ${minimum} dia(s) de antecedência.`,
        409,
        "startDate",
        "REVIEW_FIELDS",
      );
    }
    const result = await admin.rpc("create_leave_request_v2", {
      p_organization_id: actor.organizationId,
      p_actor_id: actor.id,
      p_contractor_id: contractorId,
      p_start_date: String(body.startDate),
      p_end_date: String(body.endDate),
      p_requested_minutes: Number(body.requestedMinutes),
      p_reason: cleanText(body.reason),
      p_days: allocation.days,
    });
    if (result.error) throw result.error;
    return Response.json(result.data, { status: 201 });
  } catch (error) { return apiFailure(error, "leave request create"); }
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
    const result = await admin.rpc("decide_leave_request", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id,
      p_request_id: body.id, p_action: action, p_notes: cleanText(body.notes) || null,
    });
    if (result.error) throw result.error;
    return Response.json({ id: body.id, action });
  } catch (error) { return apiFailure(error, "leave request decision"); }
}


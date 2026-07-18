import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || !validIsoDate(body.workDate) || !Number.isInteger(body.estimatedMinutes)
      || Number(body.estimatedMinutes) <= 0 || Number(body.estimatedMinutes) > 1440) {
    return Response.json({ error: "Dados da autorização inválidos." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return Response.json({ error: "Selecione o prestador." }, { status: 400 });
    const id = crypto.randomUUID();
    const row = {
      id, organization_id: actor.organizationId, contractor_id: contractorId,
      work_date: String(body.workDate), estimated_minutes: Number(body.estimatedMinutes),
      reason: cleanText(body.reason), status: "REQUESTED",
    };
    const admin = getSupabaseAdmin();
    const result = await admin.from("non_business_day_authorizations").upsert(row, {
      onConflict: "organization_id,contractor_id,work_date",
    }).select("id").single();
    if (result.error) throw result.error;
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "NON_BUSINESS_AUTH_REQUESTED", entity_type: "NonBusinessDayAuthorization",
      entity_id: result.data.id, new_value: row,
    });
    if (audit.error) throw audit.error;
    return Response.json({ id: result.data.id, status: "REQUESTED" }, { status: 201 });
  } catch (error) { return apiFailure(error, "non-business authorization create"); }
}

export async function PATCH(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "NEEDS_ADJUSTMENT"].includes(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode decidir autorizações." }, { status: 403 });
    const admin = getSupabaseAdmin();
    const { data: authorization, error } = await admin.from("non_business_day_authorizations").select("*")
      .eq("id", body.id).eq("organization_id", actor.organizationId).maybeSingle();
    if (error) throw error;
    if (!authorization) return Response.json({ error: "Autorização não encontrada." }, { status: 404 });
    if (authorization.status !== "REQUESTED") return Response.json({ error: "A autorização já foi decidida." }, { status: 409 });
    const entryResult = await admin.from("time_entries").select("id,timesheet_id,calculated_minutes")
      .eq("organization_id", actor.organizationId).eq("contractor_id", authorization.contractor_id)
      .eq("work_date", authorization.work_date).maybeSingle();
    if (entryResult.error) throw entryResult.error;
    const isRetroactive = Boolean(entryResult.data);
    const status = action === "APPROVE" ? (isRetroactive ? "RETROACTIVELY_APPROVED" : "APPROVED")
      : action === "REJECT" ? "REJECTED" : "NEEDS_ADJUSTMENT";
    const update = {
      status, approved_minutes: action === "APPROVE" ? Number(body.approvedMinutes ?? authorization.estimated_minutes) : null,
      decided_at: new Date().toISOString(), decided_by: actor.id, decision_notes: cleanText(body.notes),
    };
    const updated = await admin.from("non_business_day_authorizations").update(update).eq("id", authorization.id);
    if (updated.error) throw updated.error;
    if (entryResult.data) {
      const eligible = action === "APPROVE"
        ? Math.min(entryResult.data.calculated_minutes, Number(update.approved_minutes)) : 0;
      const entryUpdate = await admin.from("time_entries").update({
        eligible_minutes: eligible,
        non_business_day_status: action === "APPROVE" ? "AUTHORIZED" : action === "REJECT" ? "REJECTED" : "PENDING_AUTHORIZATION",
        updated_by: actor.id, updated_at: new Date().toISOString(),
      }).eq("id", entryResult.data.id);
      if (entryUpdate.error) throw entryUpdate.error;
      const recalc = await admin.rpc("recalculate_timesheet", { p_timesheet_id: entryResult.data.timesheet_id });
      if (recalc.error) throw recalc.error;
    }
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "NON_BUSINESS_AUTH_" + action, entity_type: "NonBusinessDayAuthorization",
      entity_id: authorization.id, previous_value: authorization, new_value: { ...authorization, ...update },
      reason: cleanText(body.notes) || null,
    });
    if (audit.error) throw audit.error;
    return Response.json({ id: authorization.id, status });
  } catch (error) { return apiFailure(error, "non-business authorization decision"); }
}


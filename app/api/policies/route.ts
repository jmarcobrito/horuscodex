import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const monthly = Number(body?.monthlyRequiredMinutes);
  const notice = body?.minimumLeaveNoticeDays === null || body?.minimumLeaveNoticeDays === ""
    ? null : Number(body?.minimumLeaveNoticeDays);
  const threshold = Number(body?.retroactiveBatchThreshold);
  const deadlinePolicy = String(body?.positiveBalanceAfterDeadlinePolicy ?? "");
  if (!body || !Number.isInteger(monthly) || monthly < 0 || !Number.isInteger(threshold) || threshold < 1
      || (notice !== null && (!Number.isInteger(notice) || notice < 0))
      || !["ALLOW_AFTER_DEADLINE", "BLOCK_AFTER_DEADLINE"].includes(deadlinePolicy)) {
    return Response.json({ error: "Configurações inválidas." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode alterar políticas." }, { status: 403 });
    const reason = cleanText(body.reason);
    if (reason.length < 5) return Response.json({ error: "Informe a justificativa da alteração." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const current = await admin.from("organization_policies").select("*")
      .eq("organization_id", actor.organizationId).maybeSingle();
    if (current.error) throw current.error;
    const update = {
      monthly_required_minutes: monthly, minimum_leave_notice_days: notice,
      retroactive_batch_threshold: threshold, positive_balance_after_deadline_policy: deadlinePolicy,
      updated_at: new Date().toISOString(),
    };
    const result = await admin.from("organization_policies").update(update)
      .eq("organization_id", actor.organizationId);
    if (result.error) throw result.error;
    if (body.applyToOpenBalances === true) {
      const refresh = await admin.rpc("refresh_hour_balance_statuses", { p_organization_id: actor.organizationId });
      if (refresh.error) throw refresh.error;
    }
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "ORGANIZATION_POLICY_CHANGED", entity_type: "OrganizationPolicy",
      entity_id: current.data?.id ?? actor.organizationId, previous_value: current.data,
      new_value: { ...(current.data ?? {}), ...update }, reason,
    });
    if (audit.error) throw audit.error;
    return Response.json({ updated: true });
  } catch (error) { return apiFailure(error, "policy update"); }
}


import { requireActor } from "../../../db/actor";
import { apiDomainError, apiError, apiFailure, cleanText, readJson } from "../../../db/http";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const year = Number(body?.year); const month = Number(body?.month);
  if (!body || typeof body.contractorId !== "string" || !["CLOSE", "REOPEN"].includes(action)
      || !Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    return apiDomainError("INVALID_PERIOD");
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return apiError("ACTOR_NOT_AUTHORIZED", "Apenas o RH pode fechar ou reabrir meses.", 403, null, "GO_BACK");
    const admin = getSupabaseAdmin();
    if (action === "CLOSE") {
      if (typeof body.reviewVersion !== "string" || !body.reviewVersion) {
        return apiDomainError("REVIEW_REQUIRED", "reviewVersion");
      }
      const result = await admin.rpc("close_timesheet_v2", {
        p_organization_id: actor.organizationId,
        p_actor_id: actor.id,
        p_contractor_id: body.contractorId,
        p_year: year,
        p_month: month,
        p_review_version: body.reviewVersion,
        p_allow_empty_month: body.allowEmptyMonth === true,
        p_empty_month_reason: cleanText(body.emptyMonthReason) || null,
      });
      if (result.error) throw result.error;
      return Response.json({ action, result: result.data });
    }
    const reason = cleanText(body.reason);
    if (reason.length < 5) return apiDomainError("REOPEN_REASON_REQUIRED", "reason");
    const result = await admin.rpc("reopen_timesheet_v2", {
      p_organization_id: actor.organizationId,
      p_actor_id: actor.id,
      p_contractor_id: body.contractorId,
      p_year: year,
      p_month: month,
      p_reason: reason,
    });
    if (result.error) throw result.error;
    return Response.json({ action, result: result.data });
  } catch (error) { return apiFailure(error, "timesheet action"); }
}


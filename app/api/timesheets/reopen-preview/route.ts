import { requireActor } from "../../../../db/actor";
import { apiDomainError, apiError, apiFailure } from "../../../../db/http";
import { getSupabaseAdmin } from "../../../../db/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contractorId = url.searchParams.get("contractorId") ?? "";
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!contractorId || !Number.isInteger(year) || !Number.isInteger(month)
      || year < 2000 || year > 2200 || month < 1 || month > 12) {
    return apiDomainError("INVALID_PERIOD");
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") {
      return apiError("ACTOR_NOT_AUTHORIZED", "Apenas o RH pode preparar uma reabertura.", 403, null, "GO_BACK");
    }
    const admin = getSupabaseAdmin();
    const result = await admin.rpc("reopen_timesheet_preview_v2", {
      p_organization_id: actor.organizationId,
      p_actor_id: actor.id,
      p_contractor_id: contractorId,
      p_year: year,
      p_month: month,
    });
    if (result.error) throw result.error;
    return Response.json(result.data, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error, "timesheet reopen preview");
  }
}

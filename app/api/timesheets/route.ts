import { requireActor } from "../../../db/actor";
import { monthClosingWriteEnabled } from "../../../db/feature-flags";
import { apiFailure, cleanText, readJson } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  if (!monthClosingWriteEnabled()) {
    return Response.json({ error: "O fechamento está temporariamente disponível somente para conferência." }, { status: 503 });
  }
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const year = Number(body?.year); const month = Number(body?.month);
  if (!body || typeof body.contractorId !== "string" || !["CLOSE", "REOPEN"].includes(action)
      || !Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "Dados da competência inválidos." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode fechar ou reabrir competências." }, { status: 403 });
    const admin = getSupabaseAdmin();
    const timesheetId = `ts_${body.contractorId}_${year}_${month}`;
    const contractor = await admin.from("users").select("id").eq("id", body.contractorId)
      .eq("organization_id", actor.organizationId).eq("role", "PJ").maybeSingle();
    if (contractor.error) throw contractor.error;
    if (!contractor.data) return Response.json({ error: "Colaborador não encontrado." }, { status: 404 });
    if (action === "CLOSE") {
      const result = await admin.rpc("close_timesheet", {
        p_organization_id: actor.organizationId, p_actor_id: actor.id, p_timesheet_id: timesheetId,
      });
      if (result.error) throw result.error;
      return Response.json({ action, result: result.data });
    }
    const reason = cleanText(body.reason);
    if (reason.length < 5) return Response.json({ error: "Informe a justificativa da reabertura." }, { status: 400 });
    const result = await admin.rpc("reopen_timesheet", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id,
      p_timesheet_id: timesheetId, p_reason: reason,
    });
    if (result.error) throw result.error;
    return Response.json({ action, id: result.data });
  } catch (error) { return apiFailure(error, "timesheet action"); }
}


import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

const types = new Set(["VACATION", "JUSTIFIED_ABSENCE", "MEDICAL_CERTIFICATE", "BANK_LEAVE", "OTHER"]);
const effects = new Set(["CREDITS_HOURS", "DOES_NOT_CREDIT", "CONSUMES_BALANCE"]);

function defaultEffect(type: string) {
  if (type === "VACATION" || type === "MEDICAL_CERTIFICATE") return "CREDITS_HOURS";
  if (type === "BANK_LEAVE") return "CONSUMES_BALANCE";
  return "DOES_NOT_CREDIT";
}

async function recalculate(admin: ReturnType<typeof getSupabaseAdmin>, organizationId: string, contractorId: string, startDate: string) {
  const [year, month] = startDate.split("-").map(Number);
  const { data, error } = await admin.from("monthly_timesheets").select("id")
    .eq("organization_id", organizationId).eq("contractor_id", contractorId)
    .eq("year", year).eq("month", month).maybeSingle();
  if (error) throw error;
  if (data?.id) {
    const result = await admin.rpc("recalculate_timesheet", { p_timesheet_id: data.id });
    if (result.error) throw result.error;
  }
}

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  if (!body || !types.has(String(body.type)) || !validIsoDate(body.startDate) || !validIsoDate(body.endDate)
      || String(body.startDate) > String(body.endDate) || !Number.isInteger(body.minutes) || Number(body.minutes) < 0) {
    return Response.json({ error: "Dados da ocorrência inválidos." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(body.contractorId, 200);
    if (!contractorId) return Response.json({ error: "Selecione o colaborador." }, { status: 400 });
    const requestedEffect = String(body.calculationEffect ?? "");
    const effect = actor.role === "PJ" || !effects.has(requestedEffect)
      ? defaultEffect(String(body.type)) : requestedEffect;
    const status = actor.role === "PJ" ? "REQUESTED" : "APPROVED";
    const id = crypto.randomUUID();
    const admin = getSupabaseAdmin();
    const row = {
      id, organization_id: actor.organizationId, contractor_id: contractorId,
      type: String(body.type), start_date: String(body.startDate), end_date: String(body.endDate),
      minutes: Number(body.minutes), calculation_effect: effect, status,
      description: cleanText(body.description), created_by: actor.id, updated_by: actor.id,
      decided_by: actor.role === "PJ" ? null : actor.id,
      decided_at: actor.role === "PJ" ? null : new Date().toISOString(),
    };
    const { error } = await admin.from("occurrences").insert(row);
    if (error) throw error;
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: status === "APPROVED" ? "OCCURRENCE_CREATED_APPROVED" : "OCCURRENCE_REQUESTED",
      entity_type: "Occurrence", entity_id: id, new_value: row,
    });
    if (audit.error) throw audit.error;
    if (status === "APPROVED") await recalculate(admin, actor.organizationId, contractorId, String(body.startDate));
    return Response.json({ id, status }, { status: 201 });
  } catch (error) { return apiFailure(error, "occurrence create"); }
}

export async function PATCH(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const body = await readJson(request) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  if (!body || typeof body.id !== "string" || !["APPROVE", "REJECT", "CANCEL"].includes(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }
  try {
    const actor = await requireActor();
    const admin = getSupabaseAdmin();
    let query = admin.from("occurrences").select("*").eq("id", body.id)
      .eq("organization_id", actor.organizationId);
    if (actor.role === "PJ") query = query.eq("contractor_id", actor.id);
    const { data: occurrence, error } = await query.maybeSingle();
    if (error) throw error;
    if (!occurrence) return Response.json({ error: "Ocorrência não encontrada." }, { status: 404 });
    if (actor.role === "PJ" && action !== "CANCEL") return Response.json({ error: "Apenas o RH pode decidir ocorrências." }, { status: 403 });
    if (occurrence.status !== "REQUESTED") return Response.json({ error: "A ocorrência já foi decidida." }, { status: 409 });
    const status = action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "CANCELLED";
    const update = {
      status, updated_by: actor.id, updated_at: new Date().toISOString(),
      decided_by: actor.role === "PJ" ? null : actor.id,
      decided_at: actor.role === "PJ" ? null : new Date().toISOString(),
      decision_notes: cleanText(body.notes),
    };
    const updated = await admin.from("occurrences").update(update).eq("id", occurrence.id);
    if (updated.error) throw updated.error;
    const audit = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
      action: "OCCURRENCE_" + action, entity_type: "Occurrence", entity_id: occurrence.id,
      previous_value: occurrence, new_value: { ...occurrence, ...update }, reason: cleanText(body.notes) || null,
    });
    if (audit.error) throw audit.error;
    await recalculate(admin, actor.organizationId, occurrence.contractor_id, occurrence.start_date);
    return Response.json({ id: occurrence.id, status });
  } catch (error) { return apiFailure(error, "occurrence decision"); }
}


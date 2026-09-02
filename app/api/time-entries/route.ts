import { requireActor } from "../../../db/actor";
import { apiFailure, cleanText, readJson, validIsoDate } from "../../../db/http";
import { sameOriginFailure } from "../../../db/request-security";
import { getSupabaseAdmin } from "../../../db/supabase";
import { calculateWorkedMinutes } from "../../../db/time-rules";

export const dynamic = "force-dynamic";

type Row = {
  id: string; contractor_id: string; work_date: string; start_time: string; end_time: string;
  break_minutes: number; calculated_minutes: number; eligible_minutes: number;
  non_business_day_status: string; notes: string; created_at: string; updated_at: string;
};
type Payload = {
  contractorId?: string; workDate: string; startTime: string; endTime: string;
  breakMinutes: number; notes?: string; changeReason?: string;
};
type RpcResult = { entry_id: string; was_created: boolean; non_business_status: string };

function serialize(row: Row) {
  return {
    id: row.id, contractorId: row.contractor_id, workDate: row.work_date,
    startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5),
    breakMinutes: row.break_minutes, calculatedMinutes: row.calculated_minutes,
    eligibleMinutes: row.eligible_minutes, nonBusinessDayStatus: row.non_business_day_status,
    notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function validPayload(payload: unknown): payload is Payload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Partial<Payload>;
  return Boolean(
    validIsoDate(value.workDate) &&
    typeof value.startTime === "string" && typeof value.endTime === "string" &&
    Number.isInteger(value.breakMinutes) &&
    (value.notes === undefined || (typeof value.notes === "string" && value.notes.length <= 2_000)),
  );
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const requestedId = new URL(request.url).searchParams.get("contractorId");
    let query = getSupabaseAdmin().from("time_entries").select("*")
      .eq("organization_id", actor.organizationId).order("work_date", { ascending: false }).limit(100);
    if (actor.role === "PJ") query = query.eq("contractor_id", actor.id);
    else if (requestedId) query = query.eq("contractor_id", requestedId);

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ entries: (data as Row[]).map(serialize) }, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error, "time entry read");
  }
}

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const payload = await readJson(request);

  if (!validPayload(payload)) {
    return Response.json({ error: "Dados de lan\u00e7amento inv\u00e1lidos." }, { status: 400 });
  }
  const calculated = calculateWorkedMinutes(payload.startTime, payload.endTime, payload.breakMinutes);
  if (!calculated) {
    return Response.json({ error: "Hor\u00e1rios ou intervalo inv\u00e1lidos." }, { status: 400 });
  }

  try {
    const actor = await requireActor();
    const contractorId = actor.role === "PJ" ? actor.id : cleanText(payload.contractorId, 200);
    if (!contractorId) return Response.json({ error: "Selecione o colaborador." }, { status: 400 });
    const changeReason = cleanText(payload.changeReason);
    if (actor.role !== "PJ" && changeReason.length < 5) {
      return Response.json({ error: "O RH deve informar a justificativa da correção." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("save_time_entry", {
      p_organization_id: actor.organizationId, p_actor_id: actor.id, p_contractor_id: contractorId,
      p_work_date: payload.workDate, p_start_time: payload.startTime, p_end_time: payload.endTime,
      p_break_minutes: payload.breakMinutes, p_calculated_minutes: calculated.workedMinutes,
      p_notes: cleanText(payload.notes), p_change_reason: changeReason || null,
    });
    if (error) throw error;

    const result = (Array.isArray(data) ? data[0] : data) as RpcResult | undefined;
    if (!result?.entry_id) throw new Error("Supabase returned no time entry id.");
    return Response.json(
      {
        id: result.entry_id, persisted: true, calculatedMinutes: calculated.workedMinutes,
        nonBusinessDayStatus: result.non_business_status,
      },
      { status: result.was_created ? 201 : 200 },
    );
  } catch (error) {
    return apiFailure(error, "time entry write");
  }
}

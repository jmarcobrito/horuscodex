import { getSupabaseAdmin, SupabaseConfigurationError } from "../../../db/supabase";
import { getChatGPTUser } from "../../chatgpt-auth";

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function actorContext() {
  const authenticated = await getChatGPTUser();
  const email = authenticated?.email ?? "marina@acme.com.br";
  const name = authenticated?.displayName ?? "Marina Costa";
  const domain = email.split("@")[1] ?? "acme.com.br";
  return { email, name, userId: `usr_${safeId(email)}`, organizationId: `org_${safeId(domain)}` };
}

type TimeEntryRow = {
  id: string;
  organization_id: string;
  timesheet_id: string;
  contractor_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  calculated_minutes: number;
  eligible_minutes: number;
  non_business_day_status: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
};

function serializeEntry(row: TimeEntryRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    timesheetId: row.timesheet_id,
    contractorId: row.contractor_id,
    workDate: row.work_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    breakMinutes: row.break_minutes,
    calculatedMinutes: row.calculated_minutes,
    eligibleMinutes: row.eligible_minutes,
    nonBusinessDayStatus: row.non_business_day_status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function databaseErrorResponse(error: unknown, operation: string) {
  console.error(`[horus] Supabase ${operation} failed`, error);

  if (error instanceof SupabaseConfigurationError) {
    return Response.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  return Response.json({ error: "Não foi possível acessar o banco de dados." }, { status: 502 });
}

export async function GET() {
  try {
    const actor = await actorContext();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("organization_id", actor.organizationId)
      .eq("contractor_id", actor.userId)
      .order("work_date", { ascending: false })
      .limit(40);

    if (error) throw error;
    return Response.json({ entries: (data as TimeEntryRow[]).map(serializeEntry) });
  } catch (error) {
    return databaseErrorResponse(error, "read");
  }
}


type TimeEntryPayload = {
  workDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  calculatedMinutes: number;
  notes?: string;
};

type UpsertTimeEntryResult = {
  entry_id: string;
  was_created: boolean;
};

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidPayload(payload: unknown): payload is TimeEntryPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Partial<TimeEntryPayload>;

  return Boolean(
    typeof value.workDate === "string" &&
      isValidDate(value.workDate) &&
      typeof value.startTime === "string" &&
      isValidTime(value.startTime) &&
      typeof value.endTime === "string" &&
      isValidTime(value.endTime) &&
      Number.isInteger(value.breakMinutes) &&
      (value.breakMinutes ?? -1) >= 0 &&
      (value.breakMinutes ?? 1_441) <= 1_440 &&
      Number.isInteger(value.calculatedMinutes) &&
      (value.calculatedMinutes ?? -1) >= 0 &&
      (value.calculatedMinutes ?? 1_441) <= 1_440 &&
      (value.notes === undefined || (typeof value.notes === "string" && value.notes.length <= 2_000)),
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return Response.json({ error: "Dados de lançamento inválidos." }, { status: 400 });
  }

  try {
    const actor = await actorContext();
    const [year, month] = payload.workDate.split("-").map(Number);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("upsert_time_entry", {
      p_organization_id: actor.organizationId,
      p_organization_name: actor.organizationId.replace(/^org_/, "").replaceAll("_", " "),
      p_user_id: actor.userId,
      p_user_name: actor.name,
      p_user_email: actor.email,
      p_timesheet_id: `ts_${actor.userId}_${year}_${month}`,
      p_year: year,
      p_month: month,
      p_work_date: payload.workDate,
      p_start_time: payload.startTime,
      p_end_time: payload.endTime,
      p_break_minutes: payload.breakMinutes,
      p_calculated_minutes: payload.calculatedMinutes,
      p_notes: payload.notes?.trim() ?? "",
    });

    if (error) throw error;

    const result = (Array.isArray(data) ? data[0] : data) as UpsertTimeEntryResult | undefined;
    if (!result?.entry_id) throw new Error("Supabase returned no time entry id.");

    return Response.json(
      { id: result.entry_id, persisted: true },
      { status: result.was_created ? 201 : 200 },
    );
  } catch (error) {
    return databaseErrorResponse(error, "write");
  }
}

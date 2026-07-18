import { requireActor } from "../../../../../db/actor";
import { apiFailure } from "../../../../../db/http";
import { getSupabaseAdmin } from "../../../../../db/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const admin = getSupabaseAdmin();
    let entryQuery = admin.from("time_entries").select("id,contractor_id")
      .eq("id", id).eq("organization_id", actor.organizationId);
    if (actor.role === "PJ") entryQuery = entryQuery.eq("contractor_id", actor.id);
    const { data: entry, error: entryError } = await entryQuery.maybeSingle();
    if (entryError) throw entryError;
    if (!entry) return Response.json({ error: "Lançamento não encontrado." }, { status: 404 });

    const { data, error } = await admin.from("time_entry_versions")
      .select("id,version_number,previous_data,new_data,changed_by,change_reason,changed_at")
      .eq("time_entry_id", id).order("version_number", { ascending: false });
    if (error) throw error;
    return Response.json({ versions: data ?? [] }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "time entry history");
  }
}

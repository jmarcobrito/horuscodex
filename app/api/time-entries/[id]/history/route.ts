import { requireActor } from "../../../../../db/actor";
import { apiFailure } from "../../../../../db/http";
import { getSupabaseAdmin } from "../../../../../db/supabase";
import { readAllRows } from "../../../../../db/read-all";
import { civilDate } from "../../../../../db/civil-date";
import type { HistoryVersion } from "../../../../EntryHistory";

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

    const query = admin.from("time_entry_versions")
      .select("id,version_number,previous_data,new_data,changed_by,change_reason,changed_at", { count: "exact" })
      .eq("time_entry_id", id).order("version_number", { ascending: false }).order("id");
    const data = await readAllRows<HistoryVersion>((from, to) => query.range(from, to));
    const { data: organization, error: organizationError } = await admin.from("organizations").select("timezone").eq("id", actor.organizationId).maybeSingle();
    if (organizationError) throw organizationError;
    const timezone = organization?.timezone;
    if (typeof timezone !== "string" || !timezone.trim()) throw new Error("Fuso horário da organização não informado.");
    civilDate(new Date().toISOString(), timezone); // Validate the configured timezone before returning history.
    const authorIds = [...new Set(data.map(version => version.changed_by).filter(Boolean))];
    const names = new Map<string, string>();
    // Bound URL size as well as response pages; never load the full user directory.
    for (let start = 0; start < authorIds.length; start += 100) {
      const authorsQuery = admin.from("users").select("id,name", { count: "exact" })
        .eq("organization_id", actor.organizationId).in("id", authorIds.slice(start, start + 100)).order("id");
      const authors = await readAllRows<{ id: string; name: string }>((from, to) => authorsQuery.range(from, to));
      for (const author of authors) names.set(author.id, author.name);
    }
    const versions = data.map(version => ({ ...version, changed_by_name: names.get(version.changed_by) ?? null }));
    return Response.json({ versions, timezone }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "time entry history");
  }
}

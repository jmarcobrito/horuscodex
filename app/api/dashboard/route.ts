import { actorErrorResponse, requireActor } from "../../../db/actor";
import { getDashboardData } from "../../../db/dashboard";
import { SupabaseConfigurationError } from "../../../db/supabase";

export const dynamic = "force-dynamic";

function numberParameter(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const data = await getDashboardData(actor, {
      year: numberParameter(url.searchParams.get("year")),
      month: numberParameter(url.searchParams.get("month")),
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return Response.json(data, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const actorResponse = actorErrorResponse(error);
    if (actorResponse) return actorResponse;
    console.error("[horus] Dashboard query failed", error);
    if (error instanceof SupabaseConfigurationError) {
      return Response.json({ error: "Database is not configured." }, { status: 503 });
    }
    return Response.json({ error: "Could not load dashboard data." }, { status: 502 });
  }
}

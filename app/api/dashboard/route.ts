import { requireActor, resolveViewActor } from "../../../db/actor";
import { getDashboardData } from "../../../db/dashboard";
import { apiFailure } from "../../../db/http";

export const dynamic = "force-dynamic";

function numberParameter(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const authenticatedActor = await requireActor();
    const url = new URL(request.url);
    const actor = await resolveViewActor(authenticatedActor, url.searchParams.get("viewAs") ?? undefined);
    const data = await getDashboardData(actor, {
      year: numberParameter(url.searchParams.get("year")),
      month: numberParameter(url.searchParams.get("month")),
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return Response.json(data, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "dashboard query");
  }
}

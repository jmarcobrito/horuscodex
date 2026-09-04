import { requireActor } from "../../../db/actor";
import { apiFailure } from "../../../db/http";
import { getReportPage, parseReportFilters, ReportInputError } from "../../../db/reports";

export const dynamic = "force-dynamic";

function reportFailure(error: unknown) {
  if (error instanceof ReportInputError) {
    return Response.json({ error: error.message }, { status: 400, headers: { "cache-control": "private, no-store" } });
  }
  return apiFailure(error, "report read");
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") {
      return Response.json({ error: "Apenas o RH pode consultar relatórios." }, { status: 403, headers: { "cache-control": "private, no-store" } });
    }
    const filters = parseReportFilters(new URL(request.url).searchParams);
    const report = await getReportPage(actor, filters);
    return Response.json(report, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return reportFailure(error);
  }
}

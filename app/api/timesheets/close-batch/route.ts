import { requireActor } from "../../../../db/actor";
import { domainErrorFromUnknown } from "../../../../db/domain-errors";
import { apiDomainError, apiError, apiFailure, cleanText, readJson } from "../../../../db/http";
import { getSupabaseAdmin } from "../../../../db/supabase";

export const dynamic = "force-dynamic";

type BatchPerson = {
  contractorId: string;
  reviewVersion: string;
  allowEmptyMonth?: boolean;
  emptyMonthReason?: string;
};

const reviewCodes = new Set([
  "REVIEW_OUTDATED",
  "NO_ENTRIES",
  "PENDING_LEAVE",
  "PENDING_OCCURRENCE",
  "PENDING_NON_BUSINESS_AUTH",
  "INCOMPLETE_DAILY_ALLOCATION",
  "RESERVED_CREDIT_MISMATCH",
]);

function isBatchPerson(value: unknown): value is BatchPerson {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.contractorId === "string" && row.contractorId.length > 0
    && typeof row.reviewVersion === "string" && row.reviewVersion.length > 0;
}

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | null;
  const year = Number(body?.year);
  const month = Number(body?.month);
  const people = Array.isArray(body?.people) ? body.people : [];
  if (!Number.isInteger(year) || !Number.isInteger(month)
      || year < 2000 || year > 2200 || month < 1 || month > 12) {
    return apiDomainError("INVALID_PERIOD");
  }
  if (people.length === 0 || people.length > 200 || !people.every(isBatchPerson)) {
    return apiError("INVALID_BATCH", "Selecione ao menos uma pessoa revisada.", 400, "people");
  }

  try {
    const actor = await requireActor();
    if (actor.role === "PJ") {
      return apiError("ACTOR_NOT_AUTHORIZED", "Apenas o RH pode fechar meses em grupo.", 403, null, "GO_BACK");
    }
    const admin = getSupabaseAdmin();
    const results = [];
    for (const person of people) {
      const result = await admin.rpc("close_timesheet_v2", {
        p_organization_id: actor.organizationId,
        p_actor_id: actor.id,
        p_contractor_id: person.contractorId,
        p_year: year,
        p_month: month,
        p_review_version: person.reviewVersion,
        p_allow_empty_month: person.allowEmptyMonth === true,
        p_empty_month_reason: cleanText(person.emptyMonthReason) || null,
      });
      if (!result.error) {
        results.push({
          contractorId: person.contractorId,
          status: result.data?.alreadyClosed ? "alreadyClosed" : "closed",
          result: result.data,
        });
        continue;
      }
      const domain = domainErrorFromUnknown(result.error);
      results.push({
        contractorId: person.contractorId,
        status: domain && reviewCodes.has(domain.code) ? "needsReview" : "failed",
        error: domain ?? { code: "UNEXPECTED_ERROR", field: null },
      });
    }
    return Response.json({ results });
  } catch (error) {
    return apiFailure(error, "batch month closing");
  }
}

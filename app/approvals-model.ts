import type { ApprovalsScope, DashboardData } from "./dashboard-types";

export type ApprovalFilters = {
  scope: ApprovalsScope;
  status: "pending" | "all" | "REQUESTED" | "NEEDS_ADJUSTMENT" | "APPROVED" | "REJECTED" | "CANCELLED" | "UTILIZED";
  kind: "all" | "leave" | "occurrence" | "authorization";
  personId: string;
};
export const defaultApprovalFilters: ApprovalFilters = { scope: "all", status: "pending", kind: "all", personId: "" };
export function isApprovalPending(status: string) { return status === "REQUESTED" || status === "NEEDS_ADJUSTMENT"; }
export function filterApprovals(data: DashboardData, filters: ApprovalFilters) {
  const matches = (item: {contractorId: string; status: string}) =>
    (!filters.personId || item.contractorId === filters.personId) &&
    (filters.status === "all" || (filters.status === "pending" ? isApprovalPending(item.status) : item.status === filters.status));
  return { ...data,
    requests: filters.kind === "all" || filters.kind === "leave" ? data.requests.filter(matches) : [],
    occurrences: filters.kind === "all" || filters.kind === "occurrence" ? data.occurrences.filter(matches) : [],
    authorizations: filters.kind === "all" || filters.kind === "authorization" ? data.authorizations.filter(matches) : [],
  };
}

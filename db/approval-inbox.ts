export type ApprovalInboxItem = {
  kind: "LEAVE" | "OCCURRENCE" | "NON_BUSINESS_AUTHORIZATION";
  id: string;
  contractorId: string;
  startDate: string;
  endDate: string;
  status: string;
  requestedAt: string;
};

export type ApprovalInbox = {
  pending: ApprovalInboxItem[];
  history: {
    items: ApprovalInboxItem[];
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
};

type LeaveInput = {
  id: string;
  contractorId: string;
  startDate: string;
  endDate: string;
  status: string;
  requestedAt: string;
};

type OccurrenceInput = {
  id: string;
  contractorId: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
};

type AuthorizationInput = {
  id: string;
  contractorId: string;
  workDate: string;
  status: string;
  requestedAt: string;
};

function overlaps(item: ApprovalInboxItem, from: string, to: string) {
  return item.startDate <= to && item.endDate >= from;
}

function newestFirst(left: ApprovalInboxItem, right: ApprovalInboxItem) {
  return right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id);
}

export function buildApprovalInbox(input: {
  from: string;
  to: string;
  requests: LeaveInput[];
  occurrences: OccurrenceInput[];
  authorizations: AuthorizationInput[];
  page?: number;
  pageSize?: number;
}): ApprovalInbox {
  const page = Number.isInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : 1;
  const pageSize = Number.isInteger(input.pageSize) && Number(input.pageSize) > 0
    ? Math.min(Number(input.pageSize), 100)
    : 20;
  const items: ApprovalInboxItem[] = [
    ...input.requests.map((item) => ({
      kind: "LEAVE" as const,
      id: item.id,
      contractorId: item.contractorId,
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.status,
      requestedAt: item.requestedAt,
    })),
    ...input.occurrences.map((item) => ({
      kind: "OCCURRENCE" as const,
      id: item.id,
      contractorId: item.contractorId,
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.status,
      requestedAt: item.createdAt,
    })),
    ...input.authorizations.map((item) => ({
      kind: "NON_BUSINESS_AUTHORIZATION" as const,
      id: item.id,
      contractorId: item.contractorId,
      startDate: item.workDate,
      endDate: item.workDate,
      status: item.status,
      requestedAt: item.requestedAt,
    })),
  ].filter((item) => overlaps(item, input.from, input.to));

  const pending = items.filter((item) => item.status === "REQUESTED").sort(newestFirst);
  const allHistory = items.filter((item) => item.status !== "REQUESTED").sort(newestFirst);
  const offset = (page - 1) * pageSize;
  return {
    pending,
    history: {
      items: allHistory.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: allHistory.length,
      hasNext: offset + pageSize < allHistory.length,
    },
  };
}

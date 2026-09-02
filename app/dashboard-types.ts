import type { ApprovalInbox } from "../db/approval-inbox";
import type { TimesheetPreview } from "../db/timesheet-preview";

export type DashboardPeriod = {
  from: string;
  to: string;
  year: number | null;
  month: number | null;
};

export type DashboardContractor = {
  id: string;
  name: string;
  email: string;
  initials: string;
  status: "ACTIVE" | "INACTIVE";
  lastEntryDate: string | null;
  lastEntryAt: string | null;
  workedMinutes: number;
  consideredMinutes: number;
  requiredMinutes: number;
  fillPercentage: number;
  averageDelayDays: number;
  retroactiveEntries: number;
  timesheetStatus: "NOT_STARTED" | "OPEN" | "CLOSED" | "REOPENED" | "MIXED";
  closingPreview: TimesheetPreview | null;
};

export type DashboardEntry = {
  id: string;
  contractorId: string;
  contractorName: string;
  workDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  calculatedMinutes: number;
  eligibleMinutes: number;
  nonBusinessDayStatus: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardBalanceLot = {
  id: string;
  contractorId: string;
  contractorName: string;
  type: "CREDIT" | "DEBIT";
  originalMinutes: number;
  remainingMinutes: number;
  reservedMinutes: number;
  originDate: string;
  deadlineDate: string;
  status: string;
};

export type DashboardBalanceTransaction = {
  id: string;
  contractorId: string;
  contractorName: string;
  lotId: string;
  type: string;
  minutes: number;
  description: string;
  createdAt: string;
};

export type DashboardRequest = {
  id: string;
  contractorId: string;
  contractorName: string;
  startDate: string;
  endDate: string;
  requestedMinutes: number;
  reservedMinutes: number;
  status: string;
  reason: string;
  requestedAt: string;
  decisionNotes: string;
};

export type DashboardOccurrence = {
  id: string;
  contractorId: string;
  contractorName: string;
  type: string;
  startDate: string;
  endDate: string;
  minutes: number;
  calculationEffect: string;
  status: string;
  description: string;
  createdAt: string;
  decisionNotes: string;
};

export type DashboardAuthorization = {
  id: string;
  contractorId: string;
  contractorName: string;
  workDate: string;
  estimatedMinutes: number;
  approvedMinutes: number | null;
  reason: string;
  status: string;
  requestedAt: string;
  decisionNotes: string;
};

export type DashboardAudit = {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  createdAt: string;
};

export type DashboardPolicy = {
  monthlyRequiredMinutes: number;
  positiveBalanceAfterDeadlinePolicy: "ALLOW_AFTER_DEADLINE" | "BLOCK_AFTER_DEADLINE";
  minimumLeaveNoticeDays: number | null;
  retroactiveBatchThreshold: number;
};

export type DashboardData = {
  period: DashboardPeriod;
  metrics: {
    activeContractors: number;
    workedMinutes: number;
    requiredMinutes: number;
    positiveBalanceMinutes: number;
    negativeBalanceMinutes: number;
    pendingRequests: number;
    pendingOccurrences: number;
    pendingAuthorizations: number;
  };
  timesheet: {
    workedMinutes: number;
    creditedMinutes: number;
    consideredMinutes: number;
    requiredMinutes: number;
    projectedBalanceMinutes: number;
    status: "NOT_STARTED" | "OPEN" | "CLOSED" | "REOPENED" | "MIXED";
  };
  policy: DashboardPolicy;
  closingPreviews: TimesheetPreview[];
  approvalInbox: ApprovalInbox;
  contractors: DashboardContractor[];
  entries: DashboardEntry[];
  balanceLots: DashboardBalanceLot[];
  balanceTransactions: DashboardBalanceTransaction[];
  requests: DashboardRequest[];
  occurrences: DashboardOccurrence[];
  authorizations: DashboardAuthorization[];
  audits: DashboardAudit[];
};


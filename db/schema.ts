import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const organizationPolicies = sqliteTable("organization_policies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  monthlyRequiredMinutes: integer("monthly_required_minutes").notNull().default(9720),
  positiveBalanceAfterDeadlinePolicy: text("positive_balance_after_deadline_policy").notNull().default("ALLOW_AFTER_DEADLINE"),
  minimumLeaveNoticeDays: integer("minimum_leave_notice_days"),
  retroactiveBatchThreshold: integer("retroactive_batch_threshold").notNull().default(3),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("org_policy_org_unique").on(table.organizationId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("PJ"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("users_org_email_unique").on(table.organizationId, table.email), index("users_org_idx").on(table.organizationId)]);

export const monthlyTimesheets = sqliteTable("monthly_timesheets", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  contractorId: text("contractor_id").notNull().references(() => users.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  requiredMinutes: integer("required_minutes").notNull().default(9720),
  workedMinutes: integer("worked_minutes").notNull().default(0),
  creditedMinutes: integer("credited_minutes").notNull().default(0),
  consideredMinutes: integer("considered_minutes").notNull().default(0),
  calculatedBalanceMinutes: integer("calculated_balance_minutes").notNull().default(0),
  status: text("status").notNull().default("OPEN"),
  closedAt: text("closed_at"),
  closedBy: text("closed_by"),
  reopenedAt: text("reopened_at"),
  reopenedBy: text("reopened_by"),
  reopenReason: text("reopen_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("timesheet_contractor_period_unique").on(table.organizationId, table.contractorId, table.year, table.month), index("timesheet_org_idx").on(table.organizationId)]);

export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  timesheetId: text("timesheet_id").notNull().references(() => monthlyTimesheets.id),
  contractorId: text("contractor_id").notNull().references(() => users.id),
  workDate: text("work_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").notNull().default(0),
  calculatedMinutes: integer("calculated_minutes").notNull(),
  eligibleMinutes: integer("eligible_minutes").notNull(),
  nonBusinessDayStatus: text("non_business_day_status").notNull().default("NOT_APPLICABLE"),
  notes: text("notes").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("entry_contractor_date_unique").on(table.organizationId, table.contractorId, table.workDate), index("entry_org_work_date_idx").on(table.organizationId, table.workDate)]);

export const timeEntryVersions = sqliteTable("time_entry_versions", {
  id: text("id").primaryKey(),
  timeEntryId: text("time_entry_id").notNull().references(() => timeEntries.id),
  versionNumber: integer("version_number").notNull(),
  previousData: text("previous_data").notNull(),
  newData: text("new_data").notNull(),
  changedBy: text("changed_by").notNull(),
  changeReason: text("change_reason"),
  changedAt: text("changed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("entry_version_entry_idx").on(table.timeEntryId)]);

export const hourBalanceLots = sqliteTable("hour_balance_lots", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  contractorId: text("contractor_id").notNull().references(() => users.id),
  originTimesheetId: text("origin_timesheet_id").notNull().references(() => monthlyTimesheets.id),
  type: text("type").notNull(),
  originalMinutes: integer("original_minutes").notNull(),
  remainingMinutes: integer("remaining_minutes").notNull(),
  reservedMinutes: integer("reserved_minutes").notNull().default(0),
  originDate: text("origin_date").notNull(),
  deadlineDate: text("deadline_date").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("balance_fifo_idx").on(table.organizationId, table.contractorId, table.originDate)]);

export const hourBalanceTransactions = sqliteTable("hour_balance_transactions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  contractorId: text("contractor_id").notNull().references(() => users.id),
  lotId: text("lot_id").notNull().references(() => hourBalanceLots.id),
  type: text("type").notNull(),
  minutes: integer("minutes").notNull(),
  relatedTimesheetId: text("related_timesheet_id"),
  relatedLeaveRequestId: text("related_leave_request_id"),
  description: text("description").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const leaveRequests = sqliteTable("leave_requests", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  contractorId: text("contractor_id").notNull().references(() => users.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  requestedMinutes: integer("requested_minutes").notNull(),
  reservedMinutes: integer("reserved_minutes").notNull().default(0),
  status: text("status").notNull().default("REQUESTED"),
  reason: text("reason").notNull().default(""),
  requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  decidedAt: text("decided_at"),
  decidedBy: text("decided_by"),
  decisionNotes: text("decision_notes"),
}, (table) => [index("leave_org_status_idx").on(table.organizationId, table.status)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId: text("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("audit_org_created_idx").on(table.organizationId, table.createdAt)]);

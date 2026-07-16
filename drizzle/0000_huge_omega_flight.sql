CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_org_created_idx` ON `audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `hour_balance_lots` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`origin_timesheet_id` text NOT NULL,
	`type` text NOT NULL,
	`original_minutes` integer NOT NULL,
	`remaining_minutes` integer NOT NULL,
	`reserved_minutes` integer DEFAULT 0 NOT NULL,
	`origin_date` text NOT NULL,
	`deadline_date` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contractor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`origin_timesheet_id`) REFERENCES `monthly_timesheets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `balance_fifo_idx` ON `hour_balance_lots` (`organization_id`,`contractor_id`,`origin_date`);--> statement-breakpoint
CREATE TABLE `hour_balance_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`lot_id` text NOT NULL,
	`type` text NOT NULL,
	`minutes` integer NOT NULL,
	`related_timesheet_id` text,
	`related_leave_request_id` text,
	`description` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contractor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `hour_balance_lots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`requested_minutes` integer NOT NULL,
	`reserved_minutes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	`decided_by` text,
	`decision_notes` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contractor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leave_org_status_idx` ON `leave_requests` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `monthly_timesheets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`required_minutes` integer DEFAULT 9720 NOT NULL,
	`worked_minutes` integer DEFAULT 0 NOT NULL,
	`credited_minutes` integer DEFAULT 0 NOT NULL,
	`considered_minutes` integer DEFAULT 0 NOT NULL,
	`calculated_balance_minutes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`closed_at` text,
	`closed_by` text,
	`reopened_at` text,
	`reopened_by` text,
	`reopen_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contractor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timesheet_contractor_period_unique` ON `monthly_timesheets` (`organization_id`,`contractor_id`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `timesheet_org_idx` ON `monthly_timesheets` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organization_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`monthly_required_minutes` integer DEFAULT 9720 NOT NULL,
	`positive_balance_after_deadline_policy` text DEFAULT 'ALLOW_AFTER_DEADLINE' NOT NULL,
	`minimum_leave_notice_days` integer,
	`retroactive_batch_threshold` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_policy_org_unique` ON `organization_policies` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`timesheet_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`work_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`calculated_minutes` integer NOT NULL,
	`eligible_minutes` integer NOT NULL,
	`non_business_day_status` text DEFAULT 'NOT_APPLICABLE' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`timesheet_id`) REFERENCES `monthly_timesheets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contractor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_contractor_date_unique` ON `time_entries` (`organization_id`,`contractor_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `entry_org_work_date_idx` ON `time_entries` (`organization_id`,`work_date`);--> statement-breakpoint
CREATE TABLE `time_entry_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`time_entry_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`previous_data` text NOT NULL,
	`new_data` text NOT NULL,
	`changed_by` text NOT NULL,
	`change_reason` text,
	`changed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`time_entry_id`) REFERENCES `time_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entry_version_entry_idx` ON `time_entry_versions` (`time_entry_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'PJ' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_org_email_unique` ON `users` (`organization_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`organization_id`);
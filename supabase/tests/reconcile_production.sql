-- Horus production reconciliation. This script returns aggregate values only.
-- Before the migration, run only the first SELECT. After the migration, run
-- the entire file. The second and third result sets require the new schema.

select
  now() as captured_at,
  (select count(*) from public.organizations) as organizations_count,
  (select count(*) from public.users) as users_count,
  (select count(*) from public.monthly_timesheets) as monthly_timesheets_count,
  (select coalesce(sum(required_minutes), 0) from public.monthly_timesheets) as timesheets_required_minutes,
  (select coalesce(sum(worked_minutes), 0) from public.monthly_timesheets) as timesheets_worked_minutes,
  (select coalesce(sum(credited_minutes), 0) from public.monthly_timesheets) as timesheets_credited_minutes,
  (select coalesce(sum(considered_minutes), 0) from public.monthly_timesheets) as timesheets_considered_minutes,
  (select coalesce(sum(calculated_balance_minutes), 0) from public.monthly_timesheets) as timesheets_balance_minutes,
  (select count(*) from public.time_entries) as time_entries_count,
  (select coalesce(sum(calculated_minutes), 0) from public.time_entries) as entries_calculated_minutes,
  (select coalesce(sum(eligible_minutes), 0) from public.time_entries) as entries_eligible_minutes,
  (select count(*) from public.time_entry_versions) as time_entry_versions_count,
  (select count(*) from public.hour_balance_lots) as balance_lots_count,
  (select coalesce(sum(original_minutes), 0) from public.hour_balance_lots) as lots_original_minutes,
  (select coalesce(sum(remaining_minutes), 0) from public.hour_balance_lots) as lots_remaining_minutes,
  (select coalesce(sum(reserved_minutes), 0) from public.hour_balance_lots) as lots_reserved_minutes,
  (select count(*) from public.leave_requests) as leave_requests_count,
  (select coalesce(sum(requested_minutes), 0) from public.leave_requests) as leave_requested_minutes,
  (select coalesce(sum(reserved_minutes), 0) from public.leave_requests) as leave_reserved_minutes,
  (select count(*) from public.leave_request_reservations) as leave_reservations_count,
  (select coalesce(sum(minutes), 0) from public.leave_request_reservations) as leave_reservations_minutes,
  (select count(*) from public.hour_balance_transactions) as balance_transactions_count,
  (select coalesce(sum(minutes), 0) from public.hour_balance_transactions) as balance_transactions_minutes,
  (select count(*) from public.occurrences) as occurrences_count,
  (select coalesce(sum(minutes), 0) from public.occurrences) as occurrences_minutes,
  (select count(*) from public.non_business_day_authorizations) as authorizations_count,
  (select coalesce(sum(estimated_minutes), 0) from public.non_business_day_authorizations) as authorizations_estimated_minutes,
  (select coalesce(sum(approved_minutes), 0) from public.non_business_day_authorizations) as authorizations_approved_minutes,
  (select count(*) from public.audit_logs) as audit_logs_count;

select
  (select count(*) from public.leave_request_days) as leave_request_days_count,
  (select coalesce(sum(minutes), 0) from public.leave_request_days) as leave_request_days_minutes,
  (select count(*) from public.occurrence_days) as occurrence_days_count,
  (select coalesce(sum(minutes), 0) from public.occurrence_days) as occurrence_days_minutes,
  (select count(*) from public.leave_requests where allocation_status = 'NEEDS_REVIEW') as leave_requests_needing_review,
  (select count(*) from public.occurrences where allocation_status = 'NEEDS_REVIEW') as occurrences_needing_review,
  (select count(*) from public.monthly_timesheets where status = 'CLOSED' and coalesce(closure_snapshot->>'ruleVersion', '') <> '2') as legacy_closed_months;

with leave_allocation as (
  select request.id, request.start_date, request.end_date, request.requested_minutes,
    request.allocation_status, coalesce(sum(day.minutes), 0) as daily_minutes,
    count(*) filter (where day.work_date < request.start_date or day.work_date > request.end_date) as days_outside_period
  from public.leave_requests request
  left join public.leave_request_days day on day.leave_request_id = request.id
  group by request.id
), occurrence_allocation as (
  select occurrence.id, occurrence.start_date, occurrence.end_date, occurrence.minutes,
    occurrence.allocation_status, coalesce(sum(day.minutes), 0) as daily_minutes,
    count(*) filter (where day.work_date < occurrence.start_date or day.work_date > occurrence.end_date) as days_outside_period
  from public.occurrences occurrence
  left join public.occurrence_days day on day.occurrence_id = occurrence.id
  group by occurrence.id
)
select
  (select count(*) from leave_allocation where allocation_status = 'COMPLETE' and daily_minutes <> requested_minutes) as complete_leave_sum_mismatches,
  (select coalesce(sum(days_outside_period), 0) from leave_allocation) as leave_days_outside_period,
  (select count(*) from occurrence_allocation where allocation_status = 'COMPLETE' and daily_minutes <> minutes) as complete_occurrence_sum_mismatches,
  (select coalesce(sum(days_outside_period), 0) from occurrence_allocation) as occurrence_days_outside_period,
  (select count(*) from public.leave_request_reservations where consumed_minutes < 0 or consumed_minutes > minutes) as invalid_consumed_reservations,
  (select count(*) from public.audit_logs where user_id is not null and (actor_name is null or actor_email is null)) as audit_snapshots_missing,
  (select count(*) from information_schema.routine_privileges where routine_schema = 'public' and grantee in ('anon', 'authenticated') and routine_name in (
    'preview_timesheet_v2', 'close_timesheet_v2', 'reopen_timesheet_preview_v2', 'reopen_timesheet_v2',
    'create_leave_request_v2', 'create_occurrence_v2', 'create_non_business_authorization_v2'
  )) as browser_role_v2_privileges;

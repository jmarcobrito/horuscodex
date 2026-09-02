insert into public.organizations (id, name, status)
values ('org_safe_test', 'Safe Migration Test', 'ACTIVE');

insert into public.organization_policies (
  id, organization_id, monthly_required_minutes, positive_balance_after_deadline_policy,
  retroactive_batch_threshold
)
values ('policy_safe_test', 'org_safe_test', 9720, 'ALLOW_AFTER_DEADLINE', 3);

insert into public.users (id, organization_id, name, email, role, status)
values
  ('usr_safe_rh', 'org_safe_test', 'Safe RH', 'safe-rh@example.invalid', 'RH', 'ACTIVE'),
  ('usr_safe_pj', 'org_safe_test', 'Safe PJ', 'safe-pj@example.invalid', 'PJ', 'ACTIVE');

insert into public.monthly_timesheets (
  id, organization_id, contractor_id, year, month, required_minutes,
  worked_minutes, credited_minutes, considered_minutes, calculated_balance_minutes, status
)
values ('ts_safe_2026_9', 'org_safe_test', 'usr_safe_pj', 2026, 9, 9720, 480, 0, 480, -9240, 'OPEN');

insert into public.time_entries (
  id, organization_id, timesheet_id, contractor_id, work_date,
  start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
  non_business_day_status, notes, created_by, updated_by
)
values (
  'entry_safe', 'org_safe_test', 'ts_safe_2026_9', 'usr_safe_pj', '2026-09-01',
  '08:00', '17:00', 60, 480, 480, 'NOT_APPLICABLE', '', 'usr_safe_pj', 'usr_safe_pj'
);

insert into public.hour_balance_lots (
  id, organization_id, contractor_id, origin_timesheet_id, type,
  original_minutes, remaining_minutes, reserved_minutes, origin_date, deadline_date, status
)
values (
  'lot_safe_credit', 'org_safe_test', 'usr_safe_pj', 'ts_safe_2026_9', 'CREDIT',
  600, 600, 120, '2026-09-01', '2026-11-30', 'RESERVED'
);

insert into public.leave_requests (
  id, organization_id, contractor_id, start_date, end_date,
  requested_minutes, reserved_minutes, status, reason, decided_at, decided_by
)
values
  ('leave_safe_single', 'org_safe_test', 'usr_safe_pj', '2026-09-02', '2026-09-02',
   120, 120, 'APPROVED', 'Single day', now(), 'usr_safe_rh'),
  ('leave_safe_multi', 'org_safe_test', 'usr_safe_pj', '2026-09-03', '2026-09-04',
   480, 0, 'REQUESTED', 'Legacy multi-day', null, null);

insert into public.leave_request_reservations (
  id, organization_id, leave_request_id, lot_id, minutes, status
)
values ('reservation_safe', 'org_safe_test', 'leave_safe_single', 'lot_safe_credit', 120, 'ACTIVE');

insert into public.hour_balance_transactions (
  id, organization_id, contractor_id, lot_id, type, minutes,
  related_timesheet_id, related_leave_request_id, description, created_by
)
values (
  'transaction_safe', 'org_safe_test', 'usr_safe_pj', 'lot_safe_credit', 'RESERVATION', 120,
  'ts_safe_2026_9', 'leave_safe_single', 'Legacy reservation', 'usr_safe_rh'
);

insert into public.occurrences (
  id, organization_id, contractor_id, type, start_date, end_date, minutes,
  calculation_effect, status, description, created_by, updated_by, decided_by, decided_at
)
values
  ('occ_safe_single', 'org_safe_test', 'usr_safe_pj', 'MEDICAL_CERTIFICATE',
   '2026-09-05', '2026-09-05', 60, 'CREDITS_HOURS', 'APPROVED', 'Single day',
   'usr_safe_rh', 'usr_safe_rh', 'usr_safe_rh', now()),
  ('occ_safe_multi', 'org_safe_test', 'usr_safe_pj', 'VACATION',
   '2026-09-06', '2026-09-07', 480, 'CREDITS_HOURS', 'REQUESTED', 'Legacy multi-day',
   'usr_safe_pj', 'usr_safe_pj', null, null);

insert into public.non_business_day_authorizations (
  id, organization_id, contractor_id, work_date, estimated_minutes, reason, status
)
values ('auth_safe', 'org_safe_test', 'usr_safe_pj', '2026-09-12', 240, 'Weekend', 'REQUESTED');

insert into public.audit_logs (
  id, organization_id, user_id, action, entity_type, entity_id, reason
)
values ('audit_safe', 'org_safe_test', 'usr_safe_rh', 'SAFE_TEST', 'Fixture', 'fixture_safe', 'Migration test');

-- Fictitious reporting data for a fresh local PostgreSQL test cluster only.
begin;

insert into public.organizations (id, name, timezone) values
  ('report-org', 'Organização fictícia de relatórios', 'America/Sao_Paulo'),
  ('other-report-org', 'Outra organização fictícia', 'America/Fortaleza');

insert into public.sectors (id, organization_id, name, status) values
  ('report-sector-engineering', 'report-org', 'Engenharia', 'ACTIVE'),
  ('report-sector-legacy', 'report-org', 'Legado', 'INACTIVE'),
  ('report-sector-other', 'other-report-org', 'Operações', 'ACTIVE'),
  ('report-sector-other-inactive', 'other-report-org', 'Arquivo', 'INACTIVE');

insert into public.users (id, organization_id, name, email, role, sector_id) values
  ('report-actor-a', 'report-org', 'Gestora fictícia', 'report-actor@example.com', 'RH', 'report-sector-engineering'),
  ('report-person-a', 'report-org', 'Pessoa A fictícia', 'report-person-a@example.com', 'PJ', 'report-sector-engineering'),
  ('report-person-b', 'report-org', 'Pessoa B fictícia', 'report-person-b@example.com', 'PJ', null),
  ('report-other-person', 'other-report-org', 'Pessoa externa fictícia', 'report-other@example.com', 'PJ', 'report-sector-other');

insert into public.monthly_timesheets (
  id, organization_id, contractor_id, year, month, required_minutes,
  worked_minutes, considered_minutes, calculated_balance_minutes
) values
  ('report-timesheet-a', 'report-org', 'report-person-a', 2026, 8, 9600, 480, 480, -9120),
  ('report-timesheet-b', 'report-org', 'report-person-b', 2026, 8, 9600, 420, 420, -9180),
  ('report-timesheet-other', 'other-report-org', 'report-other-person', 2026, 8, 9600, 480, 480, -9120);

insert into public.time_entries (
  id, organization_id, timesheet_id, contractor_id, work_date, start_time, end_time,
  break_minutes, calculated_minutes, eligible_minutes, non_business_day_status,
  notes, created_by, created_at, updated_by, updated_at
) values
  ('report-entry-a', 'report-org', 'report-timesheet-a', 'report-person-a', '2026-08-03', '08:00', '17:00', 60, 480, 480, 'NOT_APPLICABLE', 'Registro fictício', 'report-person-a', '2026-08-04 12:00:00+00', 'report-person-a', '2026-08-04 12:00:00+00'),
  ('report-entry-b', 'report-org', 'report-timesheet-b', 'report-person-b', '2026-08-04', '09:00', '17:00', 60, 420, 420, 'NOT_APPLICABLE', '', 'report-person-b', '2026-08-04 12:00:00+00', 'report-person-b', '2026-08-04 12:00:00+00'),
  ('report-entry-other', 'other-report-org', 'report-timesheet-other', 'report-other-person', '2026-08-03', '08:00', '17:00', 60, 480, 480, 'NOT_APPLICABLE', 'Outro registro fictício', 'report-other-person', '2026-08-03 12:00:00+00', 'report-other-person', '2026-08-03 12:00:00+00');

insert into public.time_entry_versions (
  id, time_entry_id, version_number, previous_data, new_data, changed_by, change_reason, changed_at
) values (
  'report-entry-version-a', 'report-entry-a', 1,
  '{"notes":"Antes"}'::jsonb, '{"notes":"Registro fictício"}'::jsonb,
  'report-person-a', 'Ajuste fictício', '2026-08-04 12:00:00+00'
);

insert into public.hour_balance_lots (
  id, organization_id, contractor_id, origin_timesheet_id, type, original_minutes,
  remaining_minutes, reserved_minutes, origin_date, deadline_date, status, created_at, updated_at
) values
  ('report-lot-a', 'report-org', 'report-person-a', 'report-timesheet-a', 'CREDIT', 120, 120, 60, '2026-08-31', '2026-11-29', 'RESERVED', '2026-09-01 12:00:00+00', '2026-09-01 12:00:00+00'),
  ('report-lot-other', 'other-report-org', 'report-other-person', 'report-timesheet-other', 'CREDIT', 60, 60, 0, '2026-08-31', '2026-11-29', 'AVAILABLE', '2026-09-01 12:00:00+00', '2026-09-01 12:00:00+00');

insert into public.leave_requests (
  id, organization_id, contractor_id, start_date, end_date, requested_minutes,
  reserved_minutes, status, reason, requested_at, decided_at, decided_by, decision_notes
) values (
  'report-leave-a', 'report-org', 'report-person-a', '2026-09-10', '2026-09-10',
  60, 60, 'APPROVED', 'Folga fictícia', '2026-09-01 12:00:00+00',
  '2026-09-02 12:00:00+00', 'report-actor-a', 'Aprovada para teste'
);

insert into public.leave_request_reservations (
  id, organization_id, leave_request_id, lot_id, minutes, status, created_at, updated_at
) values (
  'report-reservation-a', 'report-org', 'report-leave-a', 'report-lot-a', 60,
  'ACTIVE', '2026-09-02 12:00:00+00', '2026-09-02 12:00:00+00'
);

insert into public.hour_balance_transactions (
  id, organization_id, contractor_id, lot_id, type, minutes,
  related_timesheet_id, related_leave_request_id, description, created_by, created_at
) values (
  'report-transaction-a', 'report-org', 'report-person-a', 'report-lot-a',
  'RESERVATION', 60, null, 'report-leave-a', 'Reserva fictícia',
  'report-actor-a', '2026-09-02 12:00:00+00'
);

insert into public.occurrences (
  id, organization_id, contractor_id, type, start_date, end_date, minutes,
  calculation_effect, status, description, created_by, created_at, updated_by, updated_at
) values (
  'report-occurrence-a', 'report-org', 'report-person-a', 'OTHER', '2026-08-05',
  '2026-08-05', 60, 'CREDITS_HOURS', 'REQUESTED', 'Ocorrência fictícia',
  'report-person-a', '2026-08-05 12:00:00+00', 'report-person-a', '2026-08-05 12:00:00+00'
);

insert into public.non_business_day_authorizations (
  id, organization_id, contractor_id, work_date, estimated_minutes, reason, status, requested_at
) values (
  'report-authorization-a', 'report-org', 'report-person-a', '2026-08-09',
  60, 'Autorização fictícia', 'REQUESTED', '2026-08-06 12:00:00+00'
);

insert into public.audit_logs (
  id, organization_id, user_id, action, entity_type, entity_id,
  previous_value, new_value, reason, created_at
) values
  ('report-audit-old', 'report-org', 'report-actor-a', 'TIME_ENTRY_UPDATED', 'TimeEntry', 'report-entry-a', null, null, 'Resolução pela entidade', '2026-08-04 12:00:00+00'),
  ('report-audit-json', 'report-org', 'report-actor-a', 'CONTRACTOR_SECTOR_CHANGED', 'User', 'report-person-a', null, '{"contractor_id":"report-person-b"}'::jsonb, 'Resolução pelo JSON', '2026-08-05 12:00:00+00'),
  ('report-audit-authorization', 'report-org', 'report-actor-a', 'NON_BUSINESS_AUTH_REQUESTED', 'NonBusinessDayAuthorization', 'report-authorization-a', null, null, 'Entidade persistida real', '2026-08-06 12:00:00+00');

insert into public.audit_logs (
  id, organization_id, user_id, action, entity_type, entity_id, created_at
)
select
  'report-action-' || lpad(ordinality::text, 2, '0'),
  'report-org', 'report-actor-a', action, 'User', 'report-person-a',
  '2026-08-10 12:00:00+00'::timestamptz + (ordinality || ' minutes')::interval
from unnest(array[
  'TIME_ENTRY_CREATED', 'TIME_ENTRY_UPDATED', 'TIMESHEET_CLOSED', 'TIMESHEET_REOPENED',
  'NON_BUSINESS_AUTH_REQUESTED', 'NON_BUSINESS_AUTH_APPROVE', 'NON_BUSINESS_AUTH_REJECT', 'NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT',
  'OCCURRENCE_CREATED_APPROVED', 'OCCURRENCE_REQUESTED', 'OCCURRENCE_APPROVE', 'OCCURRENCE_REJECT', 'OCCURRENCE_CANCEL',
  'LEAVE_REQUEST_CREATED', 'LEAVE_REQUEST_APPROVE', 'LEAVE_REQUEST_REJECT', 'LEAVE_REQUEST_CANCEL', 'LEAVE_REQUEST_UTILIZE',
  'CONTRACTOR_CREATED', 'CONTRACTOR_PASSWORD_SET', 'CONTRACTOR_STATUS_CHANGED', 'CONTRACTOR_SECTOR_CHANGED',
  'USER_PASSWORD_SET', 'USER_ROLE_CHANGED', 'USER_STATUS_CHANGED', 'ORGANIZATION_POLICY_CHANGED',
  'SECTOR_CREATED', 'SECTOR_UPDATED', 'SECTOR_STATUS_CHANGED'
]::text[]) with ordinality as listed(action, ordinality);

commit;

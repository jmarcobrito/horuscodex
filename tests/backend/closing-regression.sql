-- Fixtures exclusively for a new local PostgreSQL test cluster.
insert into public.organizations(id, name) values ('test-org', 'Empresa fictícia');
insert into public.organization_policies(id, organization_id, monthly_required_minutes)
values ('test-policy', 'test-org', 480);
insert into public.users(id, organization_id, name, email, role)
values ('test-rh', 'test-org', 'RH de teste', 'rh@example.com', 'RH');
insert into public.users(id, organization_id, name, email, role)
select id, 'test-org', id, id || '@example.com', 'PJ'
from unnest(array['test-a', 'test-b', 'test-failure', 'test-pending', 'test-approved', 'test-race']) id;
insert into public.monthly_timesheets(id, organization_id, contractor_id, year, month, required_minutes)
select 'ts_' || id || '_2026_8', 'test-org', id, 2026, 8, 480
from public.users where role = 'PJ';
insert into public.time_entries(id, organization_id, timesheet_id, contractor_id, work_date, start_time, end_time,
  break_minutes, calculated_minutes, eligible_minutes, notes, created_by, updated_by)
select 'entry-' || id, 'test-org', 'ts_' || id || '_2026_8', id, '2026-08-03', '08:00', '17:00',
  60, 480, 480, 'Registro inteiramente fictício', 'test-rh', 'test-rh'
from public.users where role = 'PJ' and id <> 'test-pending';
insert into public.time_entries(id, organization_id, timesheet_id, contractor_id, work_date, start_time, end_time,
  break_minutes, calculated_minutes, eligible_minutes, notes, created_by, updated_by)
values ('entry-extra', 'test-org', 'ts_test-a_2026_8', 'test-a', '2026-08-04', '08:00', '09:00',
  0, 60, 60, 'Dia adicional fictício', 'test-rh', 'test-rh');
insert into public.time_entry_versions(id, time_entry_id, version_number, previous_data, new_data, changed_by, change_reason)
select 'version-' || id, id, 1, to_jsonb(e) || '{"notes":"Texto anterior fictício"}'::jsonb,
  to_jsonb(e), 'test-rh', 'Correção fictícia anterior' from public.time_entries e;
insert into public.non_business_day_authorizations(id, organization_id, contractor_id, work_date, estimated_minutes, reason)
values ('pending-auth', 'test-org', 'test-pending', '2026-08-09', 60, 'Solicitação fictícia sem lançamento');
insert into public.non_business_day_authorizations(id, organization_id, contractor_id, work_date, estimated_minutes, reason)
values ('later-auth', 'test-org', 'test-approved', '2026-08-03', 480, 'Autorização fictícia');

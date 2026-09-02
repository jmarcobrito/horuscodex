begin;

do $$
declare
  v_delete_action "char";
begin
  if to_regclass('public.leave_request_days') is null then
    raise exception 'leave_request_days missing';
  end if;
  if to_regclass('public.occurrence_days') is null then
    raise exception 'occurrence_days missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leave_requests'
      and column_name = 'allocation_status'
  ) then
    raise exception 'leave_requests allocation_status missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'occurrences'
      and column_name = 'allocation_status'
  ) then
    raise exception 'occurrences allocation_status missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leave_request_reservations'
      and column_name = 'consumed_minutes'
  ) then
    raise exception 'reservation consumed_minutes missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs'
      and column_name = 'actor_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs'
      and column_name = 'actor_email'
  ) then
    raise exception 'audit actor snapshot missing';
  end if;

  select confdeltype into v_delete_action
  from pg_constraint
  where conname = 'monthly_timesheets_contractor_id_fkey';
  if v_delete_action not in ('r', 'a') then
    raise exception 'monthly timesheet history is still cascade-deletable';
  end if;

  if has_table_privilege('anon', 'public.leave_request_days', 'select')
     or has_table_privilege('authenticated', 'public.leave_request_days', 'select')
     or has_table_privilege('anon', 'public.occurrence_days', 'select')
     or has_table_privilege('authenticated', 'public.occurrence_days', 'select') then
    raise exception 'daily tables exposed to browser roles';
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'entry_timesheet_auth_date_idx')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'leave_contractor_status_period_idx')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'occurrence_contractor_status_period_idx')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'leave_day_applied_timesheet_idx') then
    raise exception 'required closing indexes missing';
  end if;
end $$;

rollback;

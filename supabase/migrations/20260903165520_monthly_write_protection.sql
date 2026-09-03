-- Horus release: definitions only, no historical record repair, deletion or rewrite.
-- Row fingerprints never leave this transaction; they contain no exported row data.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

do $compatibility$
begin
  if (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
      where n.nspname='public' and p.proname='recalculate_timesheet'
        and md5(regexp_replace(p.prosrc, '\s+', '', 'g')) in ('6a78614cc6ccb98f9fa99c2b44214060','85f4cd912d780d6570e41af731fb25c5')) <> 1 then
    raise exception 'Horus release: incompatible function recalculate_timesheet';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
      where n.nspname='public' and p.proname='save_time_entry'
        and md5(regexp_replace(p.prosrc, '\s+', '', 'g')) in ('20a6c71a1bcd4f4cd5b4108db77e8736','aab9fc97e2a7fbb2117f19455c809ab8')) <> 1 then
    raise exception 'Horus release: incompatible function save_time_entry';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
      where n.nspname='public' and p.proname='close_timesheet'
        and md5(regexp_replace(p.prosrc, '\s+', '', 'g')) in ('aab8b7f381f07465dc4e37969b6b111e','9b2e59c8c00b3806e90b6d8ab8d34663')) <> 1 then
    raise exception 'Horus release: incompatible function close_timesheet';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
      where n.nspname='public' and p.proname='reopen_timesheet'
        and md5(regexp_replace(p.prosrc, '\s+', '', 'g')) in ('bf0167b1e042aefc7429a5cb72893530','b66e8e8bb3849a30557f768400283b94')) <> 1 then
    raise exception 'Horus release: incompatible function reopen_timesheet';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
      where n.nspname='public' and p.proname='decide_leave_request'
        and md5(regexp_replace(p.prosrc, '\s+', '', 'g')) in ('7e795461a84442afbfc020e957cd0f48','fd19b27ff32cbaa0396c72655bdfcbcb')) <> 1 then
    raise exception 'Horus release: incompatible function decide_leave_request';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
      where n.nspname='public' and p.proname='refresh_hour_balance_statuses'
        and md5(regexp_replace(p.prosrc, '\s+', '', 'g')) in ('7797ae906c77eaf4f8376bc1d67ac475','429277d6bab4cd0db3020b9fb80e4921')) <> 1 then
    raise exception 'Horus release: incompatible function refresh_hour_balance_statuses';
  end if;
end;
$compatibility$;

lock table public.organizations, public.organization_policies, public.users, public.monthly_timesheets, public.time_entries, public.time_entry_versions, public.hour_balance_lots, public.hour_balance_transactions, public.leave_requests, public.audit_logs, public.occurrences, public.non_business_day_authorizations, public.organization_non_business_days, public.leave_request_reservations in share mode;
do $preservation_before$
declare v_table text; v_hash text; v_meta jsonb; v_snapshot jsonb := '{}'::jsonb;
begin
  foreach v_table in array array['organizations','organization_policies','users','monthly_timesheets','time_entries','time_entry_versions','hour_balance_lots','hour_balance_transactions','leave_requests','audit_logs','occurrences','non_business_day_authorizations','organization_non_business_days','leave_request_reservations']
  loop
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), chr(10) order by t.id), '''')) from public.%I t', v_table) into v_hash;
    select jsonb_build_object('hash',v_hash,'rls',c.relrowsecurity,'acl',c.relacl::text)
      into v_meta from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relkind='r';
    v_snapshot := v_snapshot || jsonb_build_object(v_table,v_meta);
  end loop;
  perform set_config('horus.release_preservation',v_snapshot::text,true);
end;
$preservation_before$;

-- Installation changes definitions only; it does not update historical rows.

-- One transaction lock per company/person, including months with no row yet.
-- All supported write RPCs acquire this before locking individual rows.
create or replace function public.lock_monthly_workflow(p_organization_id text, p_contractor_id text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if nullif(trim(p_organization_id), '') is null or nullif(trim(p_contractor_id), '') is null then
    raise exception 'Invalid contractor' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('horus-monthly', p_organization_id, p_contractor_id)::text, 0
  ));
end;
$$;

create or replace function public.assert_open_months(
  p_organization_id text, p_contractor_id text, p_start_date date, p_end_date date
)
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_month public.monthly_timesheets%rowtype;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_start_date < date '2000-01-01' or p_end_date > date '2200-12-31' then
    raise exception 'Invalid period' using errcode = '22023';
  end if;
  perform public.lock_monthly_workflow(p_organization_id, p_contractor_id);
  for v_month in
    select * from public.monthly_timesheets
    where organization_id = p_organization_id and contractor_id = p_contractor_id
      and pg_catalog.make_date(year, month, 1) <= p_end_date
      and (pg_catalog.make_date(year, month, 1) + interval '1 month')::date > p_start_date
    order by year, month for update
  loop
    if v_month.status = 'CLOSED' then raise exception 'Timesheet is closed'; end if;
  end loop;
end;
$$;

create or replace function public.assert_monthly_actor(
  p_organization_id text, p_actor_id text, p_contractor_id text, p_rh_only boolean default false
)
returns text language plpgsql security invoker set search_path = ''
as $$
declare v_role text;
begin
  select u.role into v_role from public.users u
  join public.organizations o on o.id = u.organization_id
  where u.id = p_actor_id and u.organization_id = p_organization_id
    and u.status = 'ACTIVE' and o.status = 'ACTIVE';
  if v_role is null or v_role not in ('PJ','RH','ADMIN','DEV')
     or (v_role = 'PJ' and (p_rh_only or p_actor_id is distinct from p_contractor_id)) then
    raise exception 'Forbidden operation' using errcode = '42501';
  end if;
  -- Inactive people still have history that RH must be able to review/close.
  if not exists (select 1 from public.users
    where id = p_contractor_id and organization_id = p_organization_id and role = 'PJ') then
    raise exception 'Invalid contractor' using errcode = '22023';
  end if;
  return v_role;
end;
$$;

-- Defense in depth for legacy direct writes. A failure aborts their statement.
-- New RPCs provide the transaction spanning data, calculation and audit.
create or replace function public.protect_monthly_source()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_old jsonb; v_new jsonb; v_row jsonb; v_from date; v_to date;
begin
  if TG_OP <> 'INSERT' then v_old := pg_catalog.to_jsonb(OLD); end if;
  if TG_OP <> 'DELETE' then v_new := pg_catalog.to_jsonb(NEW); end if;
  if TG_OP = 'UPDATE' and (
    v_old->>'id' is distinct from v_new->>'id'
    or v_old->>'organization_id' is distinct from v_new->>'organization_id'
    or v_old->>'contractor_id' is distinct from v_new->>'contractor_id'
    or (TG_TABLE_NAME <> 'occurrences' and v_old->>'work_date' is distinct from v_new->>'work_date')
    or (TG_TABLE_NAME = 'time_entries' and v_old->>'timesheet_id' is distinct from v_new->>'timesheet_id')
  ) then
    raise exception 'Invalid record identity' using errcode = '22023';
  end if;
  for v_row in select value from pg_catalog.jsonb_array_elements(pg_catalog.jsonb_build_array(v_old, v_new))
  loop
    if v_row is null or v_row = 'null'::jsonb then continue; end if;
    if TG_TABLE_NAME = 'occurrences' then
      v_from := (v_row->>'start_date')::date; v_to := (v_row->>'end_date')::date;
    else
      v_from := (v_row->>'work_date')::date; v_to := v_from;
    end if;
    perform public.assert_open_months(v_row->>'organization_id', v_row->>'contractor_id', v_from, v_to);
  end loop;
  if TG_TABLE_NAME = 'time_entries' and TG_OP <> 'DELETE' and not exists (
    select 1 from public.monthly_timesheets m
    where m.id = v_new->>'timesheet_id'
      and m.organization_id = v_new->>'organization_id' and m.contractor_id = v_new->>'contractor_id'
      and m.year = extract(year from (v_new->>'work_date')::date)::integer
      and m.month = extract(month from (v_new->>'work_date')::date)::integer
  ) then raise exception 'Invalid timesheet reference' using errcode = '22023'; end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

create or replace trigger protect_monthly_entry
  before insert or update or delete on public.time_entries
  for each row execute function public.protect_monthly_source();
create or replace trigger protect_monthly_authorization
  before insert or update or delete on public.non_business_day_authorizations
  for each row execute function public.protect_monthly_source();
create or replace trigger protect_monthly_occurrence
  before insert or update or delete on public.occurrences
  for each row execute function public.protect_monthly_source();

revoke all on function public.lock_monthly_workflow(text,text) from public, anon, authenticated;
revoke all on function public.assert_open_months(text,text,date,date) from public, anon, authenticated;
revoke all on function public.assert_monthly_actor(text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.protect_monthly_source() from public, anon, authenticated;
grant execute on function public.lock_monthly_workflow(text,text) to service_role;
grant execute on function public.assert_open_months(text,text,date,date) to service_role;
grant execute on function public.assert_monthly_actor(text,text,text,boolean) to service_role;
grant execute on function public.protect_monthly_source() to service_role;

-- No historical migration is changed and no data is updated at installation.

create or replace function public.recalculate_timesheet(p_timesheet_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worked integer;
  v_eligible integer;
  v_credited integer;
  v_organization_id text;
  v_contractor_id text;
  v_year integer;
  v_month integer;
begin
  select organization_id, contractor_id, year, month
    into v_organization_id, v_contractor_id, v_year, v_month
  from public.monthly_timesheets
  where id = p_timesheet_id;

  if v_organization_id is null then
    return;
  end if;

  perform public.assert_open_months(v_organization_id, v_contractor_id,
    make_date(v_year, v_month, 1), make_date(v_year, v_month, 1));

  select
    coalesce(sum(calculated_minutes), 0)::integer,
    coalesce(sum(eligible_minutes), 0)::integer
    into v_worked, v_eligible
  from public.time_entries
  where timesheet_id = p_timesheet_id;

  select coalesce(sum(minutes), 0)::integer
    into v_credited
  from public.occurrences
  where organization_id = v_organization_id
    and contractor_id = v_contractor_id
    and status = 'APPROVED'
    and calculation_effect = 'CREDITS_HOURS'
    and extract(year from start_date)::integer = v_year
    and extract(month from start_date)::integer = v_month;

  update public.monthly_timesheets
  set worked_minutes = v_worked,
      credited_minutes = v_credited,
      considered_minutes = v_eligible + v_credited,
      calculated_balance_minutes = v_eligible + v_credited - required_minutes,
      updated_at = now()
  where id = p_timesheet_id;
end;
$$;

create or replace function public.save_time_entry(
  p_organization_id text,
  p_actor_id text,
  p_contractor_id text,
  p_work_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_break_minutes integer,
  p_calculated_minutes integer,
  p_notes text,
  p_change_reason text default null
)
returns table(entry_id text, was_created boolean, non_business_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_id text;
  v_timesheet_id text;
  v_previous jsonb;
  v_new jsonb;
  v_version bigint;
  v_created boolean := false;
  v_year integer := extract(year from p_work_date)::integer;
  v_month integer := extract(month from p_work_date)::integer;
  v_required integer;
  v_status text := 'NOT_APPLICABLE';
  v_eligible integer := p_calculated_minutes;
  v_is_non_business boolean;
  v_authorization public.non_business_day_authorizations%rowtype;
begin
  if p_break_minutes not between 0 and 1440
     or p_calculated_minutes not between 1 and 1440
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Invalid time entry values';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_contractor_id and organization_id = p_organization_id and role = 'PJ' and status = 'ACTIVE'
  ) then
    raise exception 'Invalid contractor';
  end if;

  perform public.assert_monthly_actor(p_organization_id, p_actor_id, p_contractor_id);
  perform public.assert_open_months(p_organization_id, p_contractor_id, p_work_date, p_work_date);

  v_timesheet_id := 'ts_' || p_contractor_id || '_' || v_year || '_' || v_month;
  select coalesce(monthly_required_minutes, 9720) into v_required
  from public.organization_policies where organization_id = p_organization_id;
  v_required := coalesce(v_required, 9720);

  insert into public.monthly_timesheets (
    id, organization_id, contractor_id, year, month, required_minutes
  ) values (
    v_timesheet_id, p_organization_id, p_contractor_id, v_year, v_month, v_required
  ) on conflict (organization_id, contractor_id, year, month) do nothing;

  if exists (select 1 from public.monthly_timesheets where id = v_timesheet_id and status = 'CLOSED') then
    raise exception 'Timesheet is closed';
  end if;

  v_is_non_business := extract(isodow from p_work_date)::integer in (6, 7)
    or exists (
      select 1 from public.organization_non_business_days
      where organization_id = p_organization_id and day = p_work_date
    );

  if v_is_non_business then
    select * into v_authorization from public.non_business_day_authorizations
      where organization_id = p_organization_id
        and contractor_id = p_contractor_id
        and work_date = p_work_date;
    if v_authorization.status in ('APPROVED', 'RETROACTIVELY_APPROVED') then
      v_status := 'AUTHORIZED';
      v_eligible := least(p_calculated_minutes, coalesce(v_authorization.approved_minutes, v_authorization.estimated_minutes));
    elsif v_authorization.status = 'REJECTED' then
      v_status := 'REJECTED';
      v_eligible := 0;
    else
      v_status := 'PENDING_AUTHORIZATION';
      v_eligible := 0;
    end if;
  end if;

  select to_jsonb(entry), entry.id
    into v_previous, v_entry_id
  from public.time_entries entry
  where entry.organization_id = p_organization_id
    and entry.contractor_id = p_contractor_id
    and entry.work_date = p_work_date
  for update;

  if v_entry_id is null then
    v_entry_id := gen_random_uuid()::text;
    v_created := true;
    insert into public.time_entries (
      id, organization_id, timesheet_id, contractor_id, work_date,
      start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
      non_business_day_status, notes, created_by, updated_by
    ) values (
      v_entry_id, p_organization_id, v_timesheet_id, p_contractor_id, p_work_date,
      p_start_time, p_end_time, p_break_minutes, p_calculated_minutes, v_eligible,
      v_status, coalesce(p_notes, ''), p_actor_id, p_actor_id
    );
  else
    select coalesce(max(version_number), 0) + 1 into v_version
    from public.time_entry_versions where time_entry_id = v_entry_id;

    update public.time_entries
    set start_time = p_start_time,
        end_time = p_end_time,
        break_minutes = p_break_minutes,
        calculated_minutes = p_calculated_minutes,
        eligible_minutes = v_eligible,
        non_business_day_status = v_status,
        notes = coalesce(p_notes, ''),
        updated_by = p_actor_id,
        updated_at = now()
    where id = v_entry_id;

    select to_jsonb(entry) into v_new from public.time_entries entry where id = v_entry_id;
    insert into public.time_entry_versions (
      id, time_entry_id, version_number, previous_data, new_data, changed_by, change_reason
    ) values (
      gen_random_uuid()::text, v_entry_id, v_version, v_previous, v_new, p_actor_id, p_change_reason
    );
  end if;

  select to_jsonb(entry) into v_new from public.time_entries entry where id = v_entry_id;
  perform public.recalculate_timesheet(v_timesheet_id);

  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id,
    previous_value, new_value, reason
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id,
    case when v_created then 'TIME_ENTRY_CREATED' else 'TIME_ENTRY_UPDATED' end,
    'TimeEntry', v_entry_id, v_previous, v_new, p_change_reason
  );

  return query select v_entry_id, v_created, v_status;
end;
$$;

create or replace function public.close_timesheet(
  p_organization_id text,
  p_actor_id text,
  p_timesheet_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timesheet public.monthly_timesheets%rowtype;
  v_lot public.hour_balance_lots%rowtype;
  v_balance integer;
  v_remaining integer;
  v_take integer;
  v_new_lot_id text;
  v_deadline date;
  v_changes jsonb := '[]'::jsonb;
  v_before integer;
  v_before_status text;
  v_allow_expired boolean;
  v_today date;
begin
  select * into v_timesheet from public.monthly_timesheets
  where id = p_timesheet_id and organization_id = p_organization_id;
  if v_timesheet.id is null then raise exception 'Timesheet not found'; end if;
  perform public.assert_monthly_actor(p_organization_id, p_actor_id, v_timesheet.contractor_id, true);
  perform public.lock_monthly_workflow(p_organization_id, v_timesheet.contractor_id);
  select coalesce(p.positive_balance_after_deadline_policy, 'ALLOW_AFTER_DEADLINE') = 'ALLOW_AFTER_DEADLINE',
    (now() at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date
    into v_allow_expired, v_today
  from public.organizations o left join public.organization_policies p on p.organization_id = o.id
  where o.id = p_organization_id;
  select * into v_timesheet from public.monthly_timesheets
  where id = p_timesheet_id and organization_id = p_organization_id for update;
  if v_timesheet.id is null then raise exception 'Timesheet not found'; end if;
  if v_timesheet.status = 'CLOSED' then
    return jsonb_build_object('alreadyClosed', true, 'timesheetId', v_timesheet.id);
  end if;

  perform public.recalculate_timesheet(v_timesheet.id);
  select * into v_timesheet from public.monthly_timesheets where id = p_timesheet_id for update;

  if exists (select 1 from public.time_entries where timesheet_id = v_timesheet.id and non_business_day_status = 'PENDING_AUTHORIZATION') then
    raise exception 'Pending non-business day authorization';
  end if;
  if exists (
    select 1 from public.non_business_day_authorizations
    where organization_id = p_organization_id and contractor_id = v_timesheet.contractor_id
      and status in ('REQUESTED', 'NEEDS_ADJUSTMENT')
      and work_date >= make_date(v_timesheet.year, v_timesheet.month, 1)
      and work_date < (make_date(v_timesheet.year, v_timesheet.month, 1) + interval '1 month')::date
  ) then raise exception 'Pending non-business day authorization'; end if;
  if exists (
    select 1 from public.occurrences
    where organization_id = p_organization_id and contractor_id = v_timesheet.contractor_id
      and status = 'REQUESTED'
      and start_date < (make_date(v_timesheet.year, v_timesheet.month, 1) + interval '1 month')::date
      and end_date >= make_date(v_timesheet.year, v_timesheet.month, 1)
  ) then
    raise exception 'Pending occurrence';
  end if;

  v_balance := v_timesheet.calculated_balance_minutes;
  v_remaining := abs(v_balance);
  v_deadline := ((make_date(v_timesheet.year, v_timesheet.month, 1) + interval '1 month - 1 day')::date + 90);

  if v_balance > 0 then
    for v_lot in
      select * from public.hour_balance_lots
      where organization_id = p_organization_id and contractor_id = v_timesheet.contractor_id
        and type = 'DEBIT' and remaining_minutes > 0
        and status not in ('CANCELLED', 'CONSUMED', 'SETTLED')
      order by origin_date, created_at for update
    loop
      exit when v_remaining = 0;
      v_before := v_lot.remaining_minutes;
      v_before_status := v_lot.status;
      v_take := least(v_remaining, v_lot.remaining_minutes);
      update public.hour_balance_lots
      set remaining_minutes = remaining_minutes - v_take,
          status = case when remaining_minutes - v_take = 0 then 'SETTLED' else 'PARTIALLY_COMPENSATED' end,
          updated_at = now() where id = v_lot.id;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, v_timesheet.contractor_id, v_lot.id,
        'COMPENSATION', v_take, v_timesheet.id, 'Compensação FIFO por saldo mensal positivo', p_actor_id
      );
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_lot.id, 'created', false, 'beforeRemaining', v_before,
        'beforeStatus', v_before_status, 'afterRemaining', v_before - v_take
      ));
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then
      v_new_lot_id := gen_random_uuid()::text;
      insert into public.hour_balance_lots (
        id, organization_id, contractor_id, origin_timesheet_id, type,
        original_minutes, remaining_minutes, origin_date, deadline_date, status
      ) values (
        v_new_lot_id, p_organization_id, v_timesheet.contractor_id, v_timesheet.id, 'CREDIT',
        v_remaining, v_remaining,
        (make_date(v_timesheet.year, v_timesheet.month, 1) + interval '1 month - 1 day')::date,
        v_deadline, 'AVAILABLE'
      );
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, v_timesheet.contractor_id, v_new_lot_id,
        'CREDIT', v_remaining, v_timesheet.id, 'Crédito criado no fechamento mensal', p_actor_id
      );
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_new_lot_id, 'created', true, 'beforeRemaining', 0,
        'beforeStatus', null, 'afterRemaining', v_remaining
      ));
    end if;
  elsif v_balance < 0 then
    for v_lot in
      select * from public.hour_balance_lots
      where organization_id = p_organization_id and contractor_id = v_timesheet.contractor_id
        and type = 'CREDIT' and remaining_minutes > reserved_minutes
        and status in ('AVAILABLE', 'RESERVED', 'OVERDUE_AVAILABLE', 'EXPIRED')
        and (deadline_date >= v_today or v_allow_expired)
      order by origin_date, created_at for update
    loop
      exit when v_remaining = 0;
      v_before := v_lot.remaining_minutes;
      v_before_status := v_lot.status;
      v_take := least(v_remaining, v_lot.remaining_minutes - v_lot.reserved_minutes);
      update public.hour_balance_lots
      set remaining_minutes = remaining_minutes - v_take,
          status = case when remaining_minutes - v_take = 0 then 'CONSUMED'
            when reserved_minutes > 0 then 'RESERVED'
            when deadline_date < v_today then 'OVERDUE_AVAILABLE' else 'AVAILABLE' end,
          updated_at = now() where id = v_lot.id;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, v_timesheet.contractor_id, v_lot.id,
        'COMPENSATION', v_take, v_timesheet.id, 'Compensação FIFO de déficit mensal', p_actor_id
      );
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_lot.id, 'created', false, 'beforeRemaining', v_before,
        'beforeStatus', v_before_status, 'afterRemaining', v_before - v_take
      ));
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then
      v_new_lot_id := gen_random_uuid()::text;
      insert into public.hour_balance_lots (
        id, organization_id, contractor_id, origin_timesheet_id, type,
        original_minutes, remaining_minutes, origin_date, deadline_date, status
      ) values (
        v_new_lot_id, p_organization_id, v_timesheet.contractor_id, v_timesheet.id, 'DEBIT',
        v_remaining, v_remaining,
        (make_date(v_timesheet.year, v_timesheet.month, 1) + interval '1 month - 1 day')::date,
        v_deadline, 'AVAILABLE'
      );
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, v_timesheet.contractor_id, v_new_lot_id,
        'DEBIT', v_remaining, v_timesheet.id, 'Déficit criado no fechamento mensal', p_actor_id
      );
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_new_lot_id, 'created', true, 'beforeRemaining', 0,
        'beforeStatus', null, 'afterRemaining', v_remaining
      ));
    end if;
  end if;

  update public.monthly_timesheets
  set status = 'CLOSED', closed_at = now(), closed_by = p_actor_id,
      closure_version = closure_version + 1,
      closure_snapshot = jsonb_build_object(
        'requiredMinutes', required_minutes, 'workedMinutes', worked_minutes,
        'creditedMinutes', credited_minutes, 'consideredMinutes', considered_minutes,
        'balanceMinutes', calculated_balance_minutes, 'lotChanges', v_changes
      ), updated_at = now()
  where id = v_timesheet.id;

  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id, new_value
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id, 'TIMESHEET_CLOSED',
    'MonthlyTimesheet', v_timesheet.id,
    (select closure_snapshot from public.monthly_timesheets where id = v_timesheet.id)
  );

  return jsonb_build_object('alreadyClosed', false, 'timesheetId', v_timesheet.id, 'balanceMinutes', v_balance);
end;
$$;

create or replace function public.reopen_timesheet(
  p_organization_id text,
  p_actor_id text,
  p_timesheet_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timesheet public.monthly_timesheets%rowtype;
  v_change jsonb;
  v_lot_id text;
  v_created boolean;
  v_before_remaining integer;
  v_before_status text;
begin
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Reopen reason is required'; end if;
  select * into v_timesheet from public.monthly_timesheets
  where id = p_timesheet_id and organization_id = p_organization_id;
  if v_timesheet.id is null then raise exception 'Timesheet not found'; end if;
  perform public.assert_monthly_actor(p_organization_id, p_actor_id, v_timesheet.contractor_id, true);
  perform public.lock_monthly_workflow(p_organization_id, v_timesheet.contractor_id);
  select * into v_timesheet from public.monthly_timesheets
  where id = p_timesheet_id and organization_id = p_organization_id for update;
  if v_timesheet.id is null then raise exception 'Timesheet not found'; end if;
  if v_timesheet.status <> 'CLOSED' then raise exception 'Timesheet is not closed'; end if;

  for v_change in select * from jsonb_array_elements(coalesce(v_timesheet.closure_snapshot->'lotChanges', '[]'::jsonb))
  loop
    v_lot_id := v_change->>'lotId';
    if exists (
      select 1 from public.hour_balance_transactions
      where lot_id = v_lot_id and created_at > v_timesheet.closed_at
        and coalesce(related_timesheet_id, '') <> v_timesheet.id
    ) then
      raise exception 'Later balance movements prevent reopening';
    end if;
  end loop;

  for v_change in select * from jsonb_array_elements(coalesce(v_timesheet.closure_snapshot->'lotChanges', '[]'::jsonb))
  loop
    v_lot_id := v_change->>'lotId';
    v_created := coalesce((v_change->>'created')::boolean, false);
    v_before_remaining := coalesce((v_change->>'beforeRemaining')::integer, 0);
    v_before_status := v_change->>'beforeStatus';
    if v_created then
      update public.hour_balance_lots set remaining_minutes = 0, reserved_minutes = 0,
        status = 'CANCELLED', updated_at = now() where id = v_lot_id;
    else
      update public.hour_balance_lots set remaining_minutes = v_before_remaining,
        status = coalesce(v_before_status, 'AVAILABLE'), updated_at = now() where id = v_lot_id;
    end if;
    insert into public.hour_balance_transactions (
      id, organization_id, contractor_id, lot_id, type, minutes,
      related_timesheet_id, description, created_by
    ) select
      gen_random_uuid()::text, p_organization_id, v_timesheet.contractor_id, v_lot_id,
      'REVERSAL', greatest(1, abs(coalesce((v_change->>'afterRemaining')::integer, 0) - v_before_remaining)),
      v_timesheet.id, 'Estorno por reabertura da competência', p_actor_id;
  end loop;

  update public.monthly_timesheets
  set status = 'REOPENED', reopened_at = now(), reopened_by = p_actor_id,
      reopen_reason = trim(p_reason), updated_at = now()
  where id = v_timesheet.id;
  perform public.recalculate_timesheet(v_timesheet.id);

  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id, reason, new_value
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id, 'TIMESHEET_REOPENED',
    'MonthlyTimesheet', v_timesheet.id, trim(p_reason),
    jsonb_build_object('status', 'REOPENED')
  );
  return v_timesheet.id;
end;
$$;

revoke all on function public.recalculate_timesheet(text) from public, anon, authenticated;
revoke all on function public.save_time_entry(text, text, text, date, time without time zone, time without time zone, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.close_timesheet(text, text, text) from public, anon, authenticated;
revoke all on function public.reopen_timesheet(text, text, text, text) from public, anon, authenticated;
grant execute on function public.recalculate_timesheet(text) to service_role;
grant execute on function public.save_time_entry(text, text, text, date, time without time zone, time without time zone, integer, integer, text, text) to service_role;
grant execute on function public.close_timesheet(text, text, text) to service_role;
grant execute on function public.reopen_timesheet(text, text, text, text) to service_role;

create or replace function public.request_non_business_authorization(
  p_organization_id text, p_actor_id text, p_contractor_id text,
  p_work_date date, p_estimated_minutes integer, p_reason text
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_previous public.non_business_day_authorizations%rowtype;
  v_new public.non_business_day_authorizations%rowtype;
begin
  perform public.assert_monthly_actor(p_organization_id, p_actor_id, p_contractor_id);
  if p_estimated_minutes is null or p_estimated_minutes not between 1 and 1440
     or length(coalesce(p_reason, '')) > 2000 then
    raise exception 'Invalid authorization values' using errcode = '22023';
  end if;
  perform public.assert_open_months(p_organization_id, p_contractor_id, p_work_date, p_work_date);
  select * into v_previous from public.non_business_day_authorizations
  where organization_id = p_organization_id and contractor_id = p_contractor_id and work_date = p_work_date
  for update;
  if v_previous.id is not null then
    if v_previous.status not in ('REQUESTED','NEEDS_ADJUSTMENT') then raise exception 'Request is not pending'; end if;
    update public.non_business_day_authorizations
    set estimated_minutes = p_estimated_minutes, reason = coalesce(p_reason, ''), status = 'REQUESTED',
        approved_minutes = null, requested_at = now(), decided_at = null, decided_by = null, decision_notes = null
    where id = v_previous.id returning * into v_new;
  else
    insert into public.non_business_day_authorizations(
      id, organization_id, contractor_id, work_date, estimated_minutes, reason, status
    ) values (
      pg_catalog.gen_random_uuid()::text, p_organization_id, p_contractor_id,
      p_work_date, p_estimated_minutes, coalesce(p_reason, ''), 'REQUESTED'
    ) returning * into v_new;
  end if;
  insert into public.audit_logs(id,organization_id,user_id,action,entity_type,entity_id,previous_value,new_value)
  values (pg_catalog.gen_random_uuid()::text,p_organization_id,p_actor_id,'NON_BUSINESS_AUTH_REQUESTED',
    'NonBusinessDayAuthorization',v_new.id,
    case when v_previous.id is null then null else to_jsonb(v_previous) end,to_jsonb(v_new));
  return jsonb_build_object('id',v_new.id,'status',v_new.status);
end;
$$;

create or replace function public.decide_non_business_authorization(
  p_organization_id text, p_actor_id text, p_authorization_id text,
  p_action text, p_approved_minutes integer, p_notes text
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_previous public.non_business_day_authorizations%rowtype;
  v_new public.non_business_day_authorizations%rowtype;
  v_entry public.time_entries%rowtype;
  v_entry_new public.time_entries%rowtype;
  v_minutes integer;
  v_status text;
  v_version bigint;
begin
  if p_action is null or p_action not in ('APPROVE','REJECT','NEEDS_ADJUSTMENT')
     or length(coalesce(p_notes, '')) > 2000
     or (p_action = 'APPROVE' and p_approved_minutes is not null and p_approved_minutes not between 1 and 1440) then
    raise exception 'Invalid authorization values' using errcode = '22023';
  end if;
  select * into v_previous from public.non_business_day_authorizations
  where id = p_authorization_id and organization_id = p_organization_id;
  if v_previous.id is null then raise exception 'Request not found'; end if;
  perform public.assert_monthly_actor(p_organization_id,p_actor_id,v_previous.contractor_id,true);
  perform public.assert_open_months(p_organization_id,v_previous.contractor_id,v_previous.work_date,v_previous.work_date);
  select * into v_previous from public.non_business_day_authorizations
  where id = p_authorization_id and organization_id = p_organization_id for update;
  if v_previous.id is null then raise exception 'Request not found'; end if;
  if v_previous.status <> 'REQUESTED' then raise exception 'Request is not pending'; end if;
  select * into v_entry from public.time_entries
  where organization_id = p_organization_id and contractor_id = v_previous.contractor_id
    and work_date = v_previous.work_date for update;
  v_minutes := case when p_action = 'APPROVE' then coalesce(p_approved_minutes,v_previous.estimated_minutes) else null end;
  v_status := case when p_action = 'APPROVE' then
    case when v_entry.id is null then 'APPROVED' else 'RETROACTIVELY_APPROVED' end
    when p_action = 'REJECT' then 'REJECTED' else 'NEEDS_ADJUSTMENT' end;
  update public.non_business_day_authorizations
  set status = v_status, approved_minutes = v_minutes, decided_at = now(),
      decided_by = p_actor_id, decision_notes = coalesce(p_notes,'')
  where id = v_previous.id returning * into v_new;
  if v_entry.id is not null then
    update public.time_entries
    set eligible_minutes = case when p_action = 'APPROVE' then least(calculated_minutes,v_minutes) else 0 end,
        non_business_day_status = case when p_action = 'APPROVE' then 'AUTHORIZED'
          when p_action = 'REJECT' then 'REJECTED' else 'PENDING_AUTHORIZATION' end,
        updated_by = p_actor_id, updated_at = now()
    where id = v_entry.id returning * into v_entry_new;
    select coalesce(max(version_number),0)+1 into v_version
    from public.time_entry_versions where time_entry_id = v_entry.id;
    insert into public.time_entry_versions(
      id,time_entry_id,version_number,previous_data,new_data,changed_by,change_reason
    ) values (pg_catalog.gen_random_uuid()::text,v_entry.id,v_version,to_jsonb(v_entry),to_jsonb(v_entry_new),
      p_actor_id,coalesce(nullif(trim(p_notes),''),'Decisão de autorização de dia não útil'));
    perform public.recalculate_timesheet(v_entry.timesheet_id);
  end if;
  insert into public.audit_logs(id,organization_id,user_id,action,entity_type,entity_id,previous_value,new_value,reason)
  values (pg_catalog.gen_random_uuid()::text,p_organization_id,p_actor_id,'NON_BUSINESS_AUTH_'||p_action,
    'NonBusinessDayAuthorization',v_new.id,to_jsonb(v_previous),to_jsonb(v_new),nullif(trim(p_notes),''));
  return jsonb_build_object('id',v_new.id,'status',v_new.status);
end;
$$;

create or replace function public.create_occurrence(
  p_organization_id text, p_actor_id text, p_contractor_id text, p_type text,
  p_start_date date, p_end_date date, p_minutes integer, p_calculation_effect text, p_description text
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare v_role text; v_effect text; v_new public.occurrences%rowtype; v_timesheet_id text;
begin
  v_role := public.assert_monthly_actor(p_organization_id,p_actor_id,p_contractor_id);
  if p_type is null or p_type not in ('VACATION','JUSTIFIED_ABSENCE','MEDICAL_CERTIFICATE','BANK_LEAVE','OTHER')
     or p_minutes is null or p_minutes < 0 or length(coalesce(p_description,'')) > 2000 then
    raise exception 'Invalid occurrence values' using errcode = '22023';
  end if;
  v_effect := case when p_type in ('VACATION','MEDICAL_CERTIFICATE') then 'CREDITS_HOURS'
    when p_type = 'BANK_LEAVE' then 'CONSUMES_BALANCE' else 'DOES_NOT_CREDIT' end;
  if v_role <> 'PJ' and p_calculation_effect in ('CREDITS_HOURS','DOES_NOT_CREDIT','CONSUMES_BALANCE') then
    v_effect := p_calculation_effect;
  end if;
  perform public.assert_open_months(p_organization_id,p_contractor_id,p_start_date,p_end_date);
  insert into public.occurrences(
    id,organization_id,contractor_id,type,start_date,end_date,minutes,calculation_effect,status,
    description,created_by,updated_by,decided_by,decided_at
  ) values (
    pg_catalog.gen_random_uuid()::text,p_organization_id,p_contractor_id,p_type,p_start_date,p_end_date,p_minutes,
    v_effect,case when v_role = 'PJ' then 'REQUESTED' else 'APPROVED' end,
    coalesce(p_description,''),p_actor_id,p_actor_id,
    case when v_role = 'PJ' then null else p_actor_id end,
    case when v_role = 'PJ' then null else now() end
  ) returning * into v_new;
  if v_new.status = 'APPROVED' then
    -- Preserve the existing start-month credit rule; this is not a proration change.
    select id into v_timesheet_id from public.monthly_timesheets
    where organization_id = p_organization_id and contractor_id = p_contractor_id
      and year = extract(year from p_start_date)::integer and month = extract(month from p_start_date)::integer;
    if v_timesheet_id is not null then perform public.recalculate_timesheet(v_timesheet_id); end if;
  end if;
  insert into public.audit_logs(id,organization_id,user_id,action,entity_type,entity_id,new_value)
  values (pg_catalog.gen_random_uuid()::text,p_organization_id,p_actor_id,
    case when v_new.status = 'APPROVED' then 'OCCURRENCE_CREATED_APPROVED' else 'OCCURRENCE_REQUESTED' end,
    'Occurrence',v_new.id,to_jsonb(v_new));
  return jsonb_build_object('id',v_new.id,'status',v_new.status);
end;
$$;

create or replace function public.decide_occurrence(
  p_organization_id text, p_actor_id text, p_occurrence_id text, p_action text, p_notes text
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_role text;
  v_previous public.occurrences%rowtype;
  v_new public.occurrences%rowtype;
  v_timesheet_id text;
begin
  if p_action is null or p_action not in ('APPROVE','REJECT','CANCEL') or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'Invalid occurrence values' using errcode = '22023';
  end if;
  select * into v_previous from public.occurrences where id = p_occurrence_id and organization_id = p_organization_id;
  if v_previous.id is null then raise exception 'Request not found'; end if;
  v_role := public.assert_monthly_actor(p_organization_id,p_actor_id,v_previous.contractor_id,p_action <> 'CANCEL');
  perform public.assert_open_months(p_organization_id,v_previous.contractor_id,v_previous.start_date,v_previous.end_date);
  select * into v_previous from public.occurrences
  where id = p_occurrence_id and organization_id = p_organization_id for update;
  if v_previous.id is null then raise exception 'Request not found'; end if;
  if v_previous.status <> 'REQUESTED' then raise exception 'Request is not pending'; end if;
  update public.occurrences
  set status = case when p_action = 'APPROVE' then 'APPROVED' when p_action = 'REJECT' then 'REJECTED' else 'CANCELLED' end,
      updated_by = p_actor_id, updated_at = now(),
      decided_by = case when v_role = 'PJ' then null else p_actor_id end,
      decided_at = case when v_role = 'PJ' then null else now() end, decision_notes = coalesce(p_notes,'')
  where id = v_previous.id returning * into v_new;
  select id into v_timesheet_id from public.monthly_timesheets
  where organization_id = p_organization_id and contractor_id = v_previous.contractor_id
    and year = extract(year from v_previous.start_date)::integer and month = extract(month from v_previous.start_date)::integer;
  if v_timesheet_id is not null then perform public.recalculate_timesheet(v_timesheet_id); end if;
  insert into public.audit_logs(id,organization_id,user_id,action,entity_type,entity_id,previous_value,new_value,reason)
  values (pg_catalog.gen_random_uuid()::text,p_organization_id,p_actor_id,'OCCURRENCE_'||p_action,
    'Occurrence',v_new.id,to_jsonb(v_previous),to_jsonb(v_new),nullif(trim(p_notes),''));
  return jsonb_build_object('id',v_new.id,'status',v_new.status);
end;
$$;

revoke all on function public.request_non_business_authorization(text,text,text,date,integer,text) from public, anon, authenticated;
revoke all on function public.decide_non_business_authorization(text,text,text,text,integer,text) from public, anon, authenticated;
revoke all on function public.create_occurrence(text,text,text,text,date,date,integer,text,text) from public, anon, authenticated;
revoke all on function public.decide_occurrence(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.request_non_business_authorization(text,text,text,date,integer,text) to service_role;
grant execute on function public.decide_non_business_authorization(text,text,text,text,integer,text) to service_role;
grant execute on function public.create_occurrence(text,text,text,text,date,date,integer,text,text) to service_role;
grant execute on function public.decide_occurrence(text,text,text,text,text) to service_role;

-- Installation changes function definitions only; no existing row is rewritten.

create or replace function public.create_leave_request(
  p_organization_id text, p_actor_id text, p_contractor_id text,
  p_start_date date, p_end_date date, p_requested_minutes integer, p_reason text
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_id text := gen_random_uuid()::text;
  v_today date;
  v_notice integer;
  v_new jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_start_date < date '2000-01-01' or p_end_date > date '2200-12-31'
     or p_requested_minutes is null or p_requested_minutes <= 0
     or length(coalesce(p_reason,'')) > 2000 then
    raise exception 'Invalid leave request values' using errcode = '22023';
  end if;
  perform public.assert_monthly_actor(p_organization_id, p_actor_id, p_contractor_id);
  perform public.lock_monthly_workflow(p_organization_id, p_contractor_id);
  select (now() at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date,
    coalesce(p.minimum_leave_notice_days, 0) into v_today, v_notice
  from public.organizations o left join public.organization_policies p on p.organization_id = o.id
  where o.id = p_organization_id;
  if p_start_date - v_today < v_notice then raise exception 'Insufficient leave notice'; end if;
  insert into public.leave_requests (
    id, organization_id, contractor_id, start_date, end_date, requested_minutes, reason, status
  ) values (
    v_id, p_organization_id, p_contractor_id, p_start_date, p_end_date, p_requested_minutes,
    coalesce(p_reason,''), 'REQUESTED'
  );
  select to_jsonb(r) into v_new from public.leave_requests r where id = v_id;
  insert into public.audit_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value)
  values (gen_random_uuid()::text, p_organization_id, p_actor_id, 'LEAVE_REQUEST_CREATED', 'LeaveRequest', v_id, v_new);
  return jsonb_build_object('id',v_id,'status','REQUESTED');
end;
$$;

create or replace function public.decide_leave_request(
  p_organization_id text,
  p_actor_id text,
  p_request_id text,
  p_action text,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
  v_lot public.hour_balance_lots%rowtype;
  v_reservation public.leave_request_reservations%rowtype;
  v_needed integer;
  v_take integer;
  v_available integer;
  v_previous jsonb;
  v_new jsonb;
  v_allow_expired boolean;
  v_today date;
begin
  if p_action is null or p_action not in ('APPROVE','REJECT','CANCEL','UTILIZE') or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'Invalid leave request values' using errcode = '22023';
  end if;
  select * into v_request from public.leave_requests
  where id = p_request_id and organization_id = p_organization_id;
  if v_request.id is null then raise exception 'Request not found'; end if;
  perform public.assert_monthly_actor(p_organization_id, p_actor_id, v_request.contractor_id, p_action <> 'CANCEL');
  perform public.lock_monthly_workflow(p_organization_id, v_request.contractor_id);
  select coalesce(p.positive_balance_after_deadline_policy, 'ALLOW_AFTER_DEADLINE') = 'ALLOW_AFTER_DEADLINE',
    (now() at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date
    into v_allow_expired, v_today
  from public.organizations o left join public.organization_policies p on p.organization_id = o.id
  where o.id = p_organization_id;
  select * into v_request from public.leave_requests
  where id = p_request_id and organization_id = p_organization_id for update;
  if v_request.id is null then raise exception 'Request not found'; end if;
  v_previous := to_jsonb(v_request);

  if p_action = 'APPROVE' then
    if v_request.status <> 'REQUESTED' then raise exception 'Request is not pending'; end if;
    v_needed := v_request.requested_minutes;
    for v_lot in
      select * from public.hour_balance_lots
      where organization_id = p_organization_id
        and contractor_id = v_request.contractor_id
        and type = 'CREDIT'
        and status in ('AVAILABLE', 'RESERVED', 'OVERDUE_AVAILABLE', 'EXPIRED')
        and (deadline_date >= v_today or v_allow_expired)
        and remaining_minutes > reserved_minutes
      order by origin_date, created_at
      for update
    loop
      exit when v_needed = 0;
      v_available := v_lot.remaining_minutes - v_lot.reserved_minutes;
      v_take := least(v_needed, v_available);
      insert into public.leave_request_reservations (
        id, organization_id, leave_request_id, lot_id, minutes
      ) values (
        gen_random_uuid()::text, p_organization_id, v_request.id, v_lot.id, v_take
      );
      update public.hour_balance_lots
      set reserved_minutes = reserved_minutes + v_take,
          status = 'RESERVED', updated_at = now()
      where id = v_lot.id;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_leave_request_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, v_request.contractor_id, v_lot.id,
        'RESERVATION', v_take, v_request.id, 'Reserva para folga aprovada', p_actor_id
      );
      v_needed := v_needed - v_take;
    end loop;
    if v_needed > 0 then raise exception 'Insufficient credit balance'; end if;
    update public.leave_requests set status = 'APPROVED', reserved_minutes = requested_minutes,
      decided_at = now(), decided_by = p_actor_id, decision_notes = p_notes where id = v_request.id;

  elsif p_action = 'REJECT' then
    if v_request.status <> 'REQUESTED' then raise exception 'Request is not pending'; end if;
    update public.leave_requests set status = 'REJECTED', decided_at = now(),
      decided_by = p_actor_id, decision_notes = p_notes where id = v_request.id;

  elsif p_action = 'CANCEL' then
    if v_request.status not in ('REQUESTED', 'APPROVED') then raise exception 'Request cannot be cancelled'; end if;
    for v_reservation in select * from public.leave_request_reservations
      where leave_request_id = v_request.id and status = 'ACTIVE' for update
    loop
      update public.hour_balance_lots
      set reserved_minutes = greatest(0, reserved_minutes - v_reservation.minutes),
          status = case when remaining_minutes <= 0 then 'CONSUMED'
            when reserved_minutes - v_reservation.minutes > 0 then 'RESERVED'
            when deadline_date < v_today then case when v_allow_expired then 'OVERDUE_AVAILABLE' else 'EXPIRED' end
            else 'AVAILABLE' end,
          updated_at = now()
      where id = v_reservation.lot_id;
      update public.leave_request_reservations set status = 'RELEASED', updated_at = now()
      where id = v_reservation.id;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_leave_request_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, v_request.contractor_id, v_reservation.lot_id,
        'RELEASE', v_reservation.minutes, v_request.id, 'Liberação por cancelamento de folga', p_actor_id
      );
    end loop;
    update public.leave_requests set status = 'CANCELLED', reserved_minutes = 0,
      decision_notes = coalesce(p_notes, decision_notes) where id = v_request.id;

  elsif p_action = 'UTILIZE' then
    if v_request.status <> 'APPROVED' then raise exception 'Request is not approved'; end if;
    for v_reservation in select * from public.leave_request_reservations
      where leave_request_id = v_request.id and status = 'ACTIVE' for update
    loop
      update public.hour_balance_lots
      set remaining_minutes = greatest(0, remaining_minutes - v_reservation.minutes),
          reserved_minutes = greatest(0, reserved_minutes - v_reservation.minutes),
          status = case when remaining_minutes - v_reservation.minutes <= 0 then 'CONSUMED'
            when reserved_minutes - v_reservation.minutes > 0 then 'RESERVED'
            when deadline_date < v_today then case when v_allow_expired then 'OVERDUE_AVAILABLE' else 'EXPIRED' end
            else 'AVAILABLE' end,
          updated_at = now()
      where id = v_reservation.lot_id;
      update public.leave_request_reservations set status = 'CONSUMED', updated_at = now()
      where id = v_reservation.id;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_leave_request_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, v_request.contractor_id, v_reservation.lot_id,
        'CONSUMPTION', v_reservation.minutes, v_request.id, 'Crédito utilizado como folga', p_actor_id
      );
    end loop;
    update public.leave_requests set status = 'UTILIZED', reserved_minutes = 0 where id = v_request.id;
  else
    raise exception 'Invalid action';
  end if;

  select to_jsonb(request_row) into v_new from public.leave_requests request_row where id = v_request.id;
  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id, previous_value, new_value, reason
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id, 'LEAVE_REQUEST_' || p_action,
    'LeaveRequest', v_request.id, v_previous, v_new, p_notes
  );
  return p_action;
end;
$$;

-- Backward-compatible read endpoint for the previous UI. Expiry is projected on
-- reads and checked inside each authorized balance operation, never by a GET.
create or replace function public.refresh_hour_balance_statuses(p_organization_id text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  return;
end;
$$;

revoke all on function public.create_leave_request(text,text,text,date,date,integer,text) from public, anon, authenticated;
revoke all on function public.decide_leave_request(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.refresh_hour_balance_statuses(text) from public, anon, authenticated;
grant execute on function public.create_leave_request(text,text,text,date,date,integer,text) to service_role;
grant execute on function public.decide_leave_request(text,text,text,text,text) to service_role;
grant execute on function public.refresh_hour_balance_statuses(text) to service_role;

do $preservation_after$
declare v_table text; v_hash text; v_meta jsonb; v_snapshot jsonb := '{}'::jsonb;
begin
  foreach v_table in array array['organizations','organization_policies','users','monthly_timesheets','time_entries','time_entry_versions','hour_balance_lots','hour_balance_transactions','leave_requests','audit_logs','occurrences','non_business_day_authorizations','organization_non_business_days','leave_request_reservations']
  loop
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), chr(10) order by t.id), '''')) from public.%I t', v_table) into v_hash;
    select jsonb_build_object('hash',v_hash,'rls',c.relrowsecurity,'acl',c.relacl::text)
      into v_meta from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relkind='r';
    v_snapshot := v_snapshot || jsonb_build_object(v_table,v_meta);
  end loop;
  if v_snapshot is distinct from current_setting('horus.release_preservation')::jsonb then
    raise exception 'Horus release aborted: records or table permissions changed';
  end if;
end;
$preservation_after$;
notify pgrst, 'reload schema';
commit;

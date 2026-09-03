-- LOCAL CANDIDATE ONLY. Not an automatic migration or a production command.
-- Installation changes definitions only; it does not update historical rows.
begin;

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
commit;

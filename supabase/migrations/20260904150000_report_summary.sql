begin;

create or replace view public.report_audit_events
with (security_invoker = true) as
with resolved as (
  select a.id, a.organization_id, a.user_id as actor_id, a.action,
         a.entity_type, a.entity_id, a.reason, a.previous_value, a.new_value, a.created_at,
         coalesce(
           nullif(a.new_value ->> 'contractor_id', ''),
           nullif(a.previous_value ->> 'contractor_id', ''),
           case when a.entity_type in ('User', 'Contractor') then a.entity_id end,
           te.contractor_id, mt.contractor_id, bl.contractor_id,
           lr.contractor_id, oc.contractor_id, nb.contractor_id
         ) as affected_user_id,
         coalesce(te.work_date, make_date(mt.year, mt.month, 1), bl.origin_date, lr.start_date,
           oc.start_date, nb.work_date) as related_date,
         case
           when left(a.action, 11) = 'TIME_ENTRY_' then 'entries'
           when left(a.action, 10) = 'TIMESHEET_' then 'closing'
           when a.action = 'OCCURRENCE_CREATED_APPROVED'
             or right(a.action, 8) = '_APPROVE' or right(a.action, 7) = '_REJECT'
             or right(a.action, 17) = '_NEEDS_ADJUSTMENT' then 'approval'
           when a.action in ('NON_BUSINESS_AUTH_REQUESTED', 'OCCURRENCE_REQUESTED',
             'OCCURRENCE_CANCEL', 'LEAVE_REQUEST_CREATED', 'LEAVE_REQUEST_CANCEL',
             'LEAVE_REQUEST_UTILIZE') then 'request'
           when a.action = 'CONTRACTOR_CREATED' or a.action = 'CONTRACTOR_SECTOR_CHANGED'
             or left(a.action, 7) = 'SECTOR_' then 'registration'
           when a.action in ('CONTRACTOR_PASSWORD_SET', 'CONTRACTOR_STATUS_CHANGED')
             or left(a.action, 5) = 'USER_' then 'access'
           when a.action = 'ORGANIZATION_POLICY_CHANGED' then 'policy'
           else 'unknown'
         end as category
  from public.audit_logs a
  join public.organizations org on org.id = a.organization_id
  left join public.time_entries te
    on a.entity_type = 'TimeEntry' and te.id = a.entity_id and te.organization_id = a.organization_id
  left join public.monthly_timesheets mt
    on a.entity_type in ('MonthlyTimesheet', 'Timesheet') and mt.id = a.entity_id and mt.organization_id = a.organization_id
  left join public.hour_balance_lots bl
    on a.entity_type in ('HourBalanceLot', 'BalanceLot') and bl.id = a.entity_id and bl.organization_id = a.organization_id
  left join public.leave_requests lr
    on a.entity_type in ('LeaveRequest', 'Leave') and lr.id = a.entity_id and lr.organization_id = a.organization_id
  left join public.occurrences oc
    on a.entity_type = 'Occurrence' and oc.id = a.entity_id and oc.organization_id = a.organization_id
  left join public.non_business_day_authorizations nb
    on a.entity_type in ('NonBusinessDayAuthorization', 'NonBusinessAuthorization')
      and nb.id = a.entity_id and nb.organization_id = a.organization_id
)
select r.*, (r.created_at at time zone org.timezone)::date as event_date,
       actor.name as actor_name, affected.name as affected_user_name,
       affected.sector_id,
       case when affected.id is null then 'Não identificado'
            else coalesce(sector.name, 'Sem setor definido') end as sector_name
from resolved r
join public.organizations org on org.id = r.organization_id
left join public.users actor
  on actor.id = r.actor_id and actor.organization_id = r.organization_id
left join public.users affected
  on affected.id = r.affected_user_id and affected.organization_id = r.organization_id
left join public.sectors sector
  on sector.id = affected.sector_id and sector.organization_id = affected.organization_id;

create or replace function public.report_summary(
  p_organization_id text,
  p_kind text,
  p_from date,
  p_to date,
  p_person_id text default null,
  p_sector_id text default null,
  p_category text default null,
  p_actor_id text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_result jsonb;
begin
  select o.timezone into v_timezone
  from public.organizations o
  where o.id = p_organization_id;
  if v_timezone is null then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  if p_kind = 'entries' then
    select pg_catalog.jsonb_build_object(
      'rowCount', count(*),
      'timezone', v_timezone,
      'workedMinutes', coalesce(sum(r.calculated_minutes), 0),
      'consideredMinutes', coalesce(sum(r.eligible_minutes), 0)
    ) into v_result
    from public.report_time_entries r
    where r.organization_id = p_organization_id
      and r.work_date between p_from and p_to
      and (p_person_id is null or r.person_id = p_person_id)
      and (p_sector_id is null
        or (p_sector_id = 'UNASSIGNED' and r.sector_id is null)
        or (p_sector_id <> 'UNASSIGNED' and r.sector_id = p_sector_id))
      and (p_category is null
        or (p_category = 'regular' and not r.is_retroactive and r.non_business_day_status = 'NOT_APPLICABLE')
        or (p_category = 'retroactive' and r.is_retroactive)
        or (p_category = 'non_business' and r.non_business_day_status <> 'NOT_APPLICABLE')
        or (p_category = 'with_notes' and r.has_notes));
  elsif p_kind = 'balances' then
    select pg_catalog.jsonb_build_object(
      'rowCount', count(*),
      'timezone', v_timezone,
      'creditMinutes', coalesce(sum(case
        when r.type = 'CREDIT' or (r.type = 'COMPENSATION' and r.lot_type = 'DEBIT') then r.minutes else 0 end), 0),
      'debitMinutes', coalesce(sum(case
        when r.type in ('DEBIT', 'CONSUMPTION', 'EXPIRATION')
          or (r.type = 'COMPENSATION' and r.lot_type = 'CREDIT') then r.minutes else 0 end), 0),
      'reservationMinutes', coalesce(sum(case when r.type = 'RESERVATION' then r.minutes else 0 end), 0),
      'utilizationMinutes', coalesce(sum(case when r.type = 'CONSUMPTION' then r.minutes else 0 end), 0)
    ) into v_result
    from public.report_balance_transactions r
    where r.organization_id = p_organization_id
      and r.event_date between p_from and p_to
      and (p_person_id is null or r.person_id = p_person_id)
      and (p_sector_id is null
        or (p_sector_id = 'UNASSIGNED' and r.sector_id is null)
        or (p_sector_id <> 'UNASSIGNED' and r.sector_id = p_sector_id))
      and (p_category is null or r.type = p_category);
  elsif p_kind = 'history' then
    select pg_catalog.jsonb_build_object(
      'rowCount', count(*),
      'timezone', v_timezone,
      'events', count(*),
      'affectedPeople', count(distinct r.affected_user_id)
    ) into v_result
    from public.report_audit_events r
    where r.organization_id = p_organization_id
      and r.event_date between p_from and p_to
      and (p_person_id is null or r.affected_user_id = p_person_id)
      and (p_sector_id is null
        or (p_sector_id = 'UNASSIGNED' and r.sector_id is null and r.affected_user_id is not null)
        or (p_sector_id <> 'UNASSIGNED' and r.sector_id = p_sector_id))
      and (p_category is null or r.category = p_category)
      and (p_actor_id is null or r.actor_id = p_actor_id);
  else
    raise exception 'Invalid report kind' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

revoke all on function public.report_summary(text,text,date,date,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.report_summary(text,text,date,date,text,text,text,text)
  to service_role;

commit;

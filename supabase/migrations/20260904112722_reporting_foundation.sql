begin;

create table if not exists public.sectors (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sectors_id_organization_unique unique (id, organization_id)
);

create unique index if not exists sectors_org_name_unique
  on public.sectors (organization_id, lower(btrim(name)));
create index if not exists sectors_org_status_name_idx
  on public.sectors (organization_id, status, name);

alter table public.users add column if not exists sector_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_sector_organization_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_sector_organization_fkey
      foreign key (sector_id, organization_id)
      references public.sectors(id, organization_id)
      on update cascade on delete restrict;
  end if;
end $$;

create index if not exists users_org_sector_idx
  on public.users (organization_id, sector_id);

create index if not exists report_entries_org_person_date_idx
  on public.time_entries (organization_id, contractor_id, work_date desc, id desc);
create index if not exists report_transactions_org_person_date_idx
  on public.hour_balance_transactions (organization_id, contractor_id, created_at desc, id desc);
create index if not exists report_audit_org_actor_date_idx
  on public.audit_logs (organization_id, user_id, created_at desc, id desc);

create or replace view public.report_time_entries
with (security_invoker = true) as
select e.id, e.organization_id, e.contractor_id as person_id, u.name as person_name,
       u.email as person_email, u.sector_id, coalesce(s.name, 'Sem setor definido') as sector_name,
       e.work_date, e.start_time, e.end_time, e.break_minutes, e.calculated_minutes,
       e.eligible_minutes, e.non_business_day_status, e.notes, e.created_at, e.updated_at,
       ((e.created_at at time zone org.timezone)::date > e.work_date) as is_retroactive,
       (length(btrim(e.notes)) > 0) as has_notes
from public.time_entries e
join public.organizations org on org.id = e.organization_id
join public.users u on u.id = e.contractor_id and u.organization_id = e.organization_id
left join public.sectors s on s.id = u.sector_id and s.organization_id = u.organization_id;

create or replace view public.report_balance_transactions
with (security_invoker = true) as
select t.id, t.organization_id, t.contractor_id as person_id, u.name as person_name,
       u.email as person_email, u.sector_id, coalesce(s.name, 'Sem setor definido') as sector_name,
       t.lot_id, l.type as lot_type, t.type, t.minutes, t.description,
       t.related_timesheet_id, t.related_leave_request_id, t.created_at,
       (t.created_at at time zone org.timezone)::date as event_date, l.status as lot_status
from public.hour_balance_transactions t
join public.organizations org on org.id = t.organization_id
join public.users u on u.id = t.contractor_id and u.organization_id = t.organization_id
left join public.sectors s on s.id = u.sector_id and s.organization_id = u.organization_id
left join public.hour_balance_lots l on l.id = t.lot_id and l.organization_id = t.organization_id;

create or replace view public.report_balance_lots
with (security_invoker = true) as
select l.id, l.organization_id, l.contractor_id as person_id, u.name as person_name,
       u.email as person_email, u.sector_id, coalesce(s.name, 'Sem setor definido') as sector_name,
       l.type, l.original_minutes, l.remaining_minutes, l.reserved_minutes,
       l.origin_date, l.deadline_date, l.status, l.created_at
from public.hour_balance_lots l
join public.users u on u.id = l.contractor_id and u.organization_id = l.organization_id
left join public.sectors s on s.id = u.sector_id and s.organization_id = u.organization_id;

create or replace view public.report_audit_events
with (security_invoker = true) as
with resolved as (
  select a.id, a.organization_id, a.user_id as actor_id, a.action,
         a.entity_type, a.entity_id, a.reason, a.previous_value, a.new_value, a.created_at,
         coalesce(
           nullif(a.new_value ->> 'contractor_id', ''),
           nullif(a.previous_value ->> 'contractor_id', ''),
           case when a.entity_type = 'User' then a.entity_id end,
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
    on a.entity_type = 'MonthlyTimesheet' and mt.id = a.entity_id and mt.organization_id = a.organization_id
  left join public.hour_balance_lots bl
    on a.entity_type = 'HourBalanceLot' and bl.id = a.entity_id and bl.organization_id = a.organization_id
  left join public.leave_requests lr
    on a.entity_type = 'LeaveRequest' and lr.id = a.entity_id and lr.organization_id = a.organization_id
  left join public.occurrences oc
    on a.entity_type = 'Occurrence' and oc.id = a.entity_id and oc.organization_id = a.organization_id
  left join public.non_business_day_authorizations nb
    on a.entity_type = 'NonBusinessAuthorization' and nb.id = a.entity_id and nb.organization_id = a.organization_id
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

alter table public.sectors enable row level security;

revoke all on table public.sectors from public, anon, authenticated;
grant select, insert, update on table public.sectors to service_role;

revoke all on table public.report_time_entries, public.report_balance_transactions,
  public.report_balance_lots, public.report_audit_events from public, anon, authenticated;
grant select on table public.report_time_entries, public.report_balance_transactions,
  public.report_balance_lots, public.report_audit_events to service_role;

commit;

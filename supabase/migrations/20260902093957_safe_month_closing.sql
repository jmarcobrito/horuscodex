begin;

alter table public.leave_requests
  add column if not exists allocation_status text not null default 'COMPLETE';

alter table public.leave_requests
  drop constraint if exists leave_requests_allocation_status_check;
alter table public.leave_requests
  add constraint leave_requests_allocation_status_check
  check (allocation_status in ('COMPLETE', 'NEEDS_REVIEW'));

alter table public.leave_requests
  drop constraint if exists leave_requests_status_check;
alter table public.leave_requests
  add constraint leave_requests_status_check
  check (status in (
    'REQUESTED', 'APPROVED', 'PARTIALLY_APPLIED', 'APPLIED',
    'REJECTED', 'CANCELLED', 'UTILIZED'
  ));

alter table public.occurrences
  add column if not exists allocation_status text not null default 'COMPLETE';

alter table public.occurrences
  drop constraint if exists occurrences_allocation_status_check;
alter table public.occurrences
  add constraint occurrences_allocation_status_check
  check (allocation_status in ('COMPLETE', 'NEEDS_REVIEW'));

alter table public.leave_request_reservations
  add column if not exists consumed_minutes integer not null default 0;

update public.leave_request_reservations
set consumed_minutes = case when status = 'CONSUMED' then minutes else 0 end;

alter table public.leave_request_reservations
  drop constraint if exists leave_request_reservations_consumed_minutes_check;
alter table public.leave_request_reservations
  add constraint leave_request_reservations_consumed_minutes_check
  check (consumed_minutes >= 0 and consumed_minutes <= minutes);

create table if not exists public.leave_request_days (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete restrict,
  leave_request_id text not null references public.leave_requests(id) on delete restrict,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  application_status text not null default 'PENDING'
    check (application_status in ('PENDING', 'APPROVED', 'APPLIED', 'CANCELLED')),
  applied_timesheet_id text references public.monthly_timesheets(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_request_day_unique unique (leave_request_id, work_date)
);

create table if not exists public.occurrence_days (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete restrict,
  occurrence_id text not null references public.occurrences(id) on delete restrict,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occurrence_day_unique unique (occurrence_id, work_date)
);

insert into public.leave_request_days (
  id,
  organization_id,
  leave_request_id,
  work_date,
  minutes,
  application_status,
  applied_at
)
select
  'lrd_' || request.id,
  request.organization_id,
  request.id,
  request.start_date,
  request.requested_minutes,
  case request.status
    when 'REQUESTED' then 'PENDING'
    when 'APPROVED' then 'APPROVED'
    when 'UTILIZED' then 'APPLIED'
    else 'CANCELLED'
  end,
  case when request.status = 'UTILIZED' then request.decided_at else null end
from public.leave_requests as request
where request.start_date = request.end_date
  and request.requested_minutes > 0
on conflict (leave_request_id, work_date) do nothing;

update public.leave_requests
set allocation_status = case
  when start_date = end_date and requested_minutes > 0 then 'COMPLETE'
  else 'NEEDS_REVIEW'
end;

insert into public.occurrence_days (
  id,
  organization_id,
  occurrence_id,
  work_date,
  minutes
)
select
  'ocd_' || occurrence.id,
  occurrence.organization_id,
  occurrence.id,
  occurrence.start_date,
  occurrence.minutes
from public.occurrences as occurrence
where occurrence.start_date = occurrence.end_date
  and occurrence.minutes > 0
on conflict (occurrence_id, work_date) do nothing;

update public.occurrences
set allocation_status = case
  when start_date = end_date and minutes > 0 then 'COMPLETE'
  else 'NEEDS_REVIEW'
end;

alter table public.audit_logs
  add column if not exists actor_name text,
  add column if not exists actor_email text;

update public.audit_logs as audit
set actor_name = coalesce(audit.actor_name, actor.name),
    actor_email = coalesce(audit.actor_email, actor.email)
from public.users as actor
where actor.id = audit.user_id
  and (audit.actor_name is null or audit.actor_email is null);

alter table public.audit_logs
  alter column user_id drop not null;
alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

create or replace function public.populate_audit_actor_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is not null and (new.actor_name is null or new.actor_email is null) then
    select
      coalesce(new.actor_name, actor.name),
      coalesce(new.actor_email, actor.email)
    into new.actor_name, new.actor_email
    from public.users as actor
    where actor.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_actor_snapshot_before_insert on public.audit_logs;
create trigger audit_actor_snapshot_before_insert
before insert on public.audit_logs
for each row execute function public.populate_audit_actor_snapshot();

alter table public.monthly_timesheets
  drop constraint if exists monthly_timesheets_contractor_id_fkey;
alter table public.monthly_timesheets
  add constraint monthly_timesheets_contractor_id_fkey
  foreign key (contractor_id) references public.users(id) on delete restrict;

alter table public.time_entries
  drop constraint if exists time_entries_contractor_id_fkey,
  drop constraint if exists time_entries_timesheet_id_fkey;
alter table public.time_entries
  add constraint time_entries_contractor_id_fkey
    foreign key (contractor_id) references public.users(id) on delete restrict,
  add constraint time_entries_timesheet_id_fkey
    foreign key (timesheet_id) references public.monthly_timesheets(id) on delete restrict;

alter table public.hour_balance_lots
  drop constraint if exists hour_balance_lots_contractor_id_fkey,
  drop constraint if exists hour_balance_lots_origin_timesheet_id_fkey;
alter table public.hour_balance_lots
  add constraint hour_balance_lots_contractor_id_fkey
    foreign key (contractor_id) references public.users(id) on delete restrict,
  add constraint hour_balance_lots_origin_timesheet_id_fkey
    foreign key (origin_timesheet_id) references public.monthly_timesheets(id) on delete restrict;

alter table public.leave_requests
  drop constraint if exists leave_requests_contractor_id_fkey;
alter table public.leave_requests
  add constraint leave_requests_contractor_id_fkey
  foreign key (contractor_id) references public.users(id) on delete restrict;

alter table public.occurrences
  drop constraint if exists occurrences_contractor_id_fkey;
alter table public.occurrences
  add constraint occurrences_contractor_id_fkey
  foreign key (contractor_id) references public.users(id) on delete restrict;

alter table public.non_business_day_authorizations
  drop constraint if exists non_business_day_authorizations_contractor_id_fkey;
alter table public.non_business_day_authorizations
  add constraint non_business_day_authorizations_contractor_id_fkey
  foreign key (contractor_id) references public.users(id) on delete restrict;

alter table public.hour_balance_transactions
  drop constraint if exists hour_balance_transactions_contractor_id_fkey,
  drop constraint if exists hour_balance_transactions_lot_id_fkey;
alter table public.hour_balance_transactions
  add constraint hour_balance_transactions_contractor_id_fkey
    foreign key (contractor_id) references public.users(id) on delete restrict,
  add constraint hour_balance_transactions_lot_id_fkey
    foreign key (lot_id) references public.hour_balance_lots(id) on delete restrict;

alter table public.leave_request_reservations
  drop constraint if exists leave_request_reservations_leave_request_id_fkey,
  drop constraint if exists leave_request_reservations_lot_id_fkey;
alter table public.leave_request_reservations
  add constraint leave_request_reservations_leave_request_id_fkey
    foreign key (leave_request_id) references public.leave_requests(id) on delete restrict,
  add constraint leave_request_reservations_lot_id_fkey
    foreign key (lot_id) references public.hour_balance_lots(id) on delete restrict;

create index if not exists entry_timesheet_auth_date_idx
  on public.time_entries (timesheet_id, non_business_day_status, work_date);
create index if not exists leave_contractor_status_period_idx
  on public.leave_requests (organization_id, contractor_id, status, start_date, end_date);
create index if not exists leave_day_org_date_status_idx
  on public.leave_request_days (organization_id, work_date, application_status);
create index if not exists leave_day_applied_timesheet_idx
  on public.leave_request_days (applied_timesheet_id)
  where applied_timesheet_id is not null;
create index if not exists occurrence_contractor_status_period_idx
  on public.occurrences (organization_id, contractor_id, status, start_date, end_date);
create index if not exists occurrence_day_org_date_idx
  on public.occurrence_days (organization_id, work_date);
create index if not exists authorization_contractor_date_status_idx
  on public.non_business_day_authorizations (organization_id, contractor_id, work_date, status);
create index if not exists leave_reservation_lot_status_idx
  on public.leave_request_reservations (lot_id, status);
create index if not exists balance_transaction_timesheet_created_idx
  on public.hour_balance_transactions (related_timesheet_id, created_at);
create index if not exists balance_transaction_leave_created_idx
  on public.hour_balance_transactions (related_leave_request_id, created_at);
create index if not exists audit_user_created_idx
  on public.audit_logs (user_id, created_at desc);

alter table public.leave_request_days enable row level security;
alter table public.occurrence_days enable row level security;

revoke all on table public.leave_request_days, public.occurrence_days
from public, anon, authenticated;
grant all on table public.leave_request_days, public.occurrence_days to service_role;

revoke all on function public.populate_audit_actor_snapshot()
from public, anon, authenticated;
grant execute on function public.populate_audit_actor_snapshot() to service_role;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

comment on column public.leave_requests.allocation_status is
  'Whether legacy or current requests have a complete explicit daily allocation.';
comment on column public.occurrences.allocation_status is
  'Whether legacy or current occurrences have a complete explicit daily allocation.';
comment on column public.leave_request_reservations.consumed_minutes is
  'Reservation amount already consumed by completed monthly closings.';

commit;

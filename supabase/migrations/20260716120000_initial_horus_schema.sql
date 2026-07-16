begin;

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_policies (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  monthly_required_minutes integer not null default 9720 check (monthly_required_minutes >= 0),
  positive_balance_after_deadline_policy text not null default 'ALLOW_AFTER_DEADLINE',
  minimum_leave_notice_days integer check (minimum_leave_notice_days is null or minimum_leave_notice_days >= 0),
  retroactive_batch_threshold integer not null default 3 check (retroactive_batch_threshold >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_policies_organization_unique unique (organization_id)
);

create table if not exists public.users (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'PJ' check (role in ('PJ', 'RH', 'ADMIN')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_org_email_unique
  on public.users (organization_id, lower(email));
create index if not exists users_org_idx
  on public.users (organization_id);

create table if not exists public.monthly_timesheets (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  contractor_id text not null references public.users(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  month integer not null check (month between 1 and 12),
  required_minutes integer not null default 9720 check (required_minutes >= 0),
  worked_minutes integer not null default 0 check (worked_minutes >= 0),
  credited_minutes integer not null default 0 check (credited_minutes >= 0),
  considered_minutes integer not null default 0 check (considered_minutes >= 0),
  calculated_balance_minutes integer not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'REOPENED')),
  closed_at timestamptz,
  closed_by text,
  reopened_at timestamptz,
  reopened_by text,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timesheet_contractor_period_unique unique (organization_id, contractor_id, year, month)
);

create index if not exists timesheet_org_idx
  on public.monthly_timesheets (organization_id);

create table if not exists public.time_entries (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  timesheet_id text not null references public.monthly_timesheets(id) on delete cascade,
  contractor_id text not null references public.users(id) on delete cascade,
  work_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 1440),
  calculated_minutes integer not null check (calculated_minutes between 0 and 1440),
  eligible_minutes integer not null check (eligible_minutes between 0 and 1440),
  non_business_day_status text not null default 'NOT_APPLICABLE',
  notes text not null default '' check (length(notes) <= 2000),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text not null,
  updated_at timestamptz not null default now(),
  constraint entry_contractor_date_unique unique (organization_id, contractor_id, work_date)
);

create index if not exists entry_org_work_date_idx
  on public.time_entries (organization_id, work_date desc);

create table if not exists public.time_entry_versions (
  id text primary key,
  time_entry_id text not null references public.time_entries(id) on delete cascade,
  version_number bigint not null,
  previous_data jsonb not null,
  new_data jsonb not null,
  changed_by text not null,
  change_reason text,
  changed_at timestamptz not null default now(),
  constraint entry_version_number_unique unique (time_entry_id, version_number)
);

create index if not exists entry_version_entry_idx
  on public.time_entry_versions (time_entry_id, version_number desc);

create table if not exists public.hour_balance_lots (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  contractor_id text not null references public.users(id) on delete cascade,
  origin_timesheet_id text not null references public.monthly_timesheets(id) on delete cascade,
  type text not null check (type in ('CREDIT', 'DEBIT')),
  original_minutes integer not null check (original_minutes >= 0),
  remaining_minutes integer not null check (remaining_minutes >= 0),
  reserved_minutes integer not null default 0 check (reserved_minutes >= 0),
  origin_date date not null,
  deadline_date date not null,
  status text not null check (status in ('AVAILABLE', 'RESERVED', 'CONSUMED', 'EXPIRED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint balance_lot_reservation_valid check (reserved_minutes <= remaining_minutes),
  constraint balance_lot_deadline_valid check (deadline_date >= origin_date)
);

create index if not exists balance_fifo_idx
  on public.hour_balance_lots (organization_id, contractor_id, origin_date, created_at);

create table if not exists public.leave_requests (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  contractor_id text not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  requested_minutes integer not null check (requested_minutes >= 0),
  reserved_minutes integer not null default 0 check (reserved_minutes >= 0),
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reason text not null default '',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decision_notes text,
  constraint leave_period_valid check (end_date >= start_date),
  constraint leave_reservation_valid check (reserved_minutes <= requested_minutes)
);

create index if not exists leave_org_status_idx
  on public.leave_requests (organization_id, status, requested_at desc);

create table if not exists public.hour_balance_transactions (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  contractor_id text not null references public.users(id) on delete cascade,
  lot_id text not null references public.hour_balance_lots(id) on delete cascade,
  type text not null check (type in ('CREDIT', 'DEBIT', 'RESERVATION', 'RELEASE', 'EXPIRATION', 'ADJUSTMENT')),
  minutes integer not null check (minutes > 0),
  related_timesheet_id text references public.monthly_timesheets(id) on delete set null,
  related_leave_request_id text references public.leave_requests(id) on delete set null,
  description text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists balance_transaction_lot_idx
  on public.hour_balance_transactions (lot_id, created_at);

create table if not exists public.audit_logs (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_policies enable row level security;
alter table public.users enable row level security;
alter table public.monthly_timesheets enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_entry_versions enable row level security;
alter table public.hour_balance_lots enable row level security;
alter table public.hour_balance_transactions enable row level security;
alter table public.leave_requests enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.upsert_time_entry(
  p_organization_id text,
  p_organization_name text,
  p_user_id text,
  p_user_name text,
  p_user_email text,
  p_timesheet_id text,
  p_year integer,
  p_month integer,
  p_work_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_break_minutes integer,
  p_calculated_minutes integer,
  p_notes text
)
returns table(entry_id text, was_created boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_entry_id text;
  v_previous jsonb;
  v_new jsonb;
  v_version bigint;
  v_worked integer;
  v_eligible integer;
  v_was_created boolean := false;
begin
  if p_year not between 2000 and 2200 or p_month not between 1 and 12 then
    raise exception 'Invalid timesheet period';
  end if;

  if extract(year from p_work_date)::integer <> p_year
     or extract(month from p_work_date)::integer <> p_month then
    raise exception 'Work date does not match timesheet period';
  end if;

  if p_break_minutes not between 0 and 1440
     or p_calculated_minutes not between 0 and 1440
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Invalid time entry values';
  end if;

  insert into public.organizations (id, name)
  values (p_organization_id, p_organization_name)
  on conflict (id) do update
    set name = excluded.name,
        updated_at = now();

  insert into public.users (id, organization_id, name, email, role)
  values (p_user_id, p_organization_id, p_user_name, lower(p_user_email), 'PJ')
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        name = excluded.name,
        email = excluded.email,
        updated_at = now();

  insert into public.monthly_timesheets (
    id, organization_id, contractor_id, year, month
  ) values (
    p_timesheet_id, p_organization_id, p_user_id, p_year, p_month
  )
  on conflict (id) do nothing;

  select to_jsonb(entry), entry.id
    into v_previous, v_entry_id
  from public.time_entries as entry
  where entry.organization_id = p_organization_id
    and entry.contractor_id = p_user_id
    and entry.work_date = p_work_date
  for update;

  if v_entry_id is null then
    v_entry_id := gen_random_uuid()::text;
    v_was_created := true;

    insert into public.time_entries (
      id, organization_id, timesheet_id, contractor_id, work_date,
      start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
      notes, created_by, updated_by
    ) values (
      v_entry_id, p_organization_id, p_timesheet_id, p_user_id, p_work_date,
      p_start_time, p_end_time, p_break_minutes, p_calculated_minutes, p_calculated_minutes,
      coalesce(p_notes, ''), p_user_id, p_user_id
    );
  else
    select coalesce(max(version.version_number), 0) + 1
      into v_version
    from public.time_entry_versions as version
    where version.time_entry_id = v_entry_id;

    update public.time_entries
      set timesheet_id = p_timesheet_id,
          start_time = p_start_time,
          end_time = p_end_time,
          break_minutes = p_break_minutes,
          calculated_minutes = p_calculated_minutes,
          eligible_minutes = p_calculated_minutes,
          notes = coalesce(p_notes, ''),
          updated_by = p_user_id,
          updated_at = now()
    where id = v_entry_id;

    select to_jsonb(entry)
      into v_new
    from public.time_entries as entry
    where entry.id = v_entry_id;

    insert into public.time_entry_versions (
      id, time_entry_id, version_number, previous_data, new_data, changed_by
    ) values (
      gen_random_uuid()::text, v_entry_id, v_version, v_previous, v_new, p_user_id
    );
  end if;

  select to_jsonb(entry)
    into v_new
  from public.time_entries as entry
  where entry.id = v_entry_id;

  select
    coalesce(sum(entry.calculated_minutes), 0)::integer,
    coalesce(sum(entry.eligible_minutes), 0)::integer
    into v_worked, v_eligible
  from public.time_entries as entry
  where entry.timesheet_id = p_timesheet_id;

  update public.monthly_timesheets
    set worked_minutes = v_worked,
        considered_minutes = v_eligible + credited_minutes,
        calculated_balance_minutes = (v_eligible + credited_minutes) - required_minutes,
        updated_at = now()
  where id = p_timesheet_id;

  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id,
    previous_value, new_value
  ) values (
    gen_random_uuid()::text,
    p_organization_id,
    p_user_id,
    case when v_was_created then 'TIME_ENTRY_CREATED' else 'TIME_ENTRY_UPDATED' end,
    'TimeEntry',
    v_entry_id,
    v_previous,
    v_new
  );

  return query select v_entry_id, v_was_created;
end;
$$;

revoke all on table
  public.organizations,
  public.organization_policies,
  public.users,
  public.monthly_timesheets,
  public.time_entries,
  public.time_entry_versions,
  public.hour_balance_lots,
  public.hour_balance_transactions,
  public.leave_requests,
  public.audit_logs
from anon, authenticated;

grant select, insert, update, delete on table
  public.organizations,
  public.organization_policies,
  public.users,
  public.monthly_timesheets,
  public.time_entries,
  public.time_entry_versions,
  public.hour_balance_lots,
  public.hour_balance_transactions,
  public.leave_requests,
  public.audit_logs
to service_role;

revoke all on function public.upsert_time_entry(
  text, text, text, text, text, text, integer, integer, date,
  time without time zone, time without time zone, integer, integer, text
) from public, anon, authenticated;

grant execute on function public.upsert_time_entry(
  text, text, text, text, text, text, integer, integer, date,
  time without time zone, time without time zone, integer, integer, text
) to service_role;

commit;

begin;

alter table public.monthly_timesheets
  add column if not exists closure_snapshot jsonb,
  add column if not exists closure_version integer not null default 0;

alter table public.leave_requests drop constraint if exists leave_requests_status_check;
alter table public.leave_requests
  add constraint leave_requests_status_check
  check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'UTILIZED'));

alter table public.hour_balance_lots drop constraint if exists hour_balance_lots_status_check;
alter table public.hour_balance_lots
  add constraint hour_balance_lots_status_check
  check (status in (
    'AVAILABLE', 'RESERVED', 'CONSUMED', 'EXPIRED', 'CANCELLED',
    'OVERDUE_AVAILABLE', 'OVERDUE', 'PARTIALLY_COMPENSATED', 'SETTLED', 'ADJUSTED'
  ));

alter table public.hour_balance_transactions drop constraint if exists hour_balance_transactions_type_check;
alter table public.hour_balance_transactions
  add constraint hour_balance_transactions_type_check
  check (type in (
    'CREDIT', 'DEBIT', 'RESERVATION', 'RELEASE', 'EXPIRATION', 'ADJUSTMENT',
    'COMPENSATION', 'CONSUMPTION', 'REVERSAL'
  ));

create table if not exists public.occurrences (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  contractor_id text not null references public.users(id) on delete cascade,
  type text not null check (type in ('VACATION', 'JUSTIFIED_ABSENCE', 'MEDICAL_CERTIFICATE', 'BANK_LEAVE', 'OTHER')),
  start_date date not null,
  end_date date not null,
  minutes integer not null check (minutes >= 0),
  calculation_effect text not null check (calculation_effect in ('CREDITS_HOURS', 'DOES_NOT_CREDIT', 'CONSUMES_BALANCE')),
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  description text not null default '' check (length(description) <= 2000),
  attachment_url text,
  created_by text not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_by text not null references public.users(id),
  updated_at timestamptz not null default now(),
  decided_by text references public.users(id),
  decided_at timestamptz,
  decision_notes text,
  constraint occurrence_period_valid check (end_date >= start_date)
);

create index if not exists occurrence_org_period_idx
  on public.occurrences (organization_id, start_date desc, status);

create table if not exists public.non_business_day_authorizations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  contractor_id text not null references public.users(id) on delete cascade,
  work_date date not null,
  estimated_minutes integer not null check (estimated_minutes > 0 and estimated_minutes <= 1440),
  approved_minutes integer check (approved_minutes is null or (approved_minutes > 0 and approved_minutes <= 1440)),
  reason text not null default '' check (length(reason) <= 2000),
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'NEEDS_ADJUSTMENT', 'RETROACTIVELY_APPROVED', 'CANCELLED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text references public.users(id),
  decision_notes text,
  constraint non_business_authorization_unique unique (organization_id, contractor_id, work_date)
);

create index if not exists non_business_authorization_org_status_idx
  on public.non_business_day_authorizations (organization_id, status, work_date);

create table if not exists public.organization_non_business_days (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  day date not null,
  name text not null,
  scope text not null default 'COMPANY' check (scope in ('NATIONAL', 'STATE', 'CITY', 'COMPANY')),
  created_by text not null references public.users(id),
  created_at timestamptz not null default now(),
  constraint organization_non_business_day_unique unique (organization_id, day)
);

create table if not exists public.leave_request_reservations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  leave_request_id text not null references public.leave_requests(id) on delete cascade,
  lot_id text not null references public.hour_balance_lots(id) on delete cascade,
  minutes integer not null check (minutes > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RELEASED', 'CONSUMED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_reservation_lot_unique unique (leave_request_id, lot_id)
);

create index if not exists leave_reservation_request_idx
  on public.leave_request_reservations (leave_request_id, status);

alter table public.occurrences enable row level security;
alter table public.non_business_day_authorizations enable row level security;
alter table public.organization_non_business_days enable row level security;
alter table public.leave_request_reservations enable row level security;

revoke all on table
  public.occurrences,
  public.non_business_day_authorizations,
  public.organization_non_business_days,
  public.leave_request_reservations
from anon, authenticated;

grant select, insert, update, delete on table
  public.occurrences,
  public.non_business_day_authorizations,
  public.organization_non_business_days,
  public.leave_request_reservations
to service_role;

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
    if exists (
      select 1 from public.non_business_day_authorizations
      where organization_id = p_organization_id
        and contractor_id = p_contractor_id
        and work_date = p_work_date
        and status in ('APPROVED', 'RETROACTIVELY_APPROVED')
    ) then
      v_status := 'AUTHORIZED';
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
begin
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
        and status in ('AVAILABLE', 'RESERVED', 'OVERDUE_AVAILABLE')
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
          status = case when remaining_minutes > 0 then 'AVAILABLE' else 'CONSUMED' end,
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
          status = case when remaining_minutes - v_reservation.minutes <= 0 then 'CONSUMED' else 'AVAILABLE' end,
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
begin
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
    select 1 from public.occurrences
    where organization_id = p_organization_id and contractor_id = v_timesheet.contractor_id
      and status = 'REQUESTED'
      and extract(year from start_date)::integer = v_timesheet.year
      and extract(month from start_date)::integer = v_timesheet.month
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
        and status in ('AVAILABLE', 'RESERVED', 'OVERDUE_AVAILABLE')
      order by origin_date, created_at for update
    loop
      exit when v_remaining = 0;
      v_before := v_lot.remaining_minutes;
      v_before_status := v_lot.status;
      v_take := least(v_remaining, v_lot.remaining_minutes - v_lot.reserved_minutes);
      update public.hour_balance_lots
      set remaining_minutes = remaining_minutes - v_take,
          status = case when remaining_minutes - v_take = 0 then 'CONSUMED' else 'AVAILABLE' end,
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

create or replace function public.refresh_hour_balance_statuses(p_organization_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy text;
begin
  select positive_balance_after_deadline_policy into v_policy
  from public.organization_policies where organization_id = p_organization_id;
  v_policy := coalesce(v_policy, 'ALLOW_AFTER_DEADLINE');

  update public.hour_balance_lots
  set status = case
    when type = 'CREDIT' and v_policy = 'ALLOW_AFTER_DEADLINE' then 'OVERDUE_AVAILABLE'
    when type = 'CREDIT' then 'EXPIRED'
    else 'OVERDUE'
  end, updated_at = now()
  where organization_id = p_organization_id
    and deadline_date < current_date
    and remaining_minutes > 0
    and status in ('AVAILABLE', 'OVERDUE_AVAILABLE', 'OVERDUE', 'EXPIRED');
end;
$$;

revoke all on function public.recalculate_timesheet(text) from public, anon, authenticated;
revoke all on function public.save_time_entry(text, text, text, date, time without time zone, time without time zone, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.decide_leave_request(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.close_timesheet(text, text, text) from public, anon, authenticated;
revoke all on function public.reopen_timesheet(text, text, text, text) from public, anon, authenticated;
revoke all on function public.refresh_hour_balance_statuses(text) from public, anon, authenticated;

grant execute on function public.recalculate_timesheet(text) to service_role;
grant execute on function public.save_time_entry(text, text, text, date, time without time zone, time without time zone, integer, integer, text, text) to service_role;
grant execute on function public.decide_leave_request(text, text, text, text, text) to service_role;
grant execute on function public.close_timesheet(text, text, text) to service_role;
grant execute on function public.reopen_timesheet(text, text, text, text) to service_role;
grant execute on function public.refresh_hour_balance_statuses(text) to service_role;

commit;

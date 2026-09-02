begin;

alter table public.hour_balance_transactions
  add column if not exists related_leave_request_day_id text;

alter table public.hour_balance_transactions
  drop constraint if exists hour_balance_transactions_related_leave_request_day_id_fkey;
alter table public.hour_balance_transactions
  add constraint hour_balance_transactions_related_leave_request_day_id_fkey
  foreign key (related_leave_request_day_id)
  references public.leave_request_days(id) on delete set null;

create index if not exists balance_transaction_leave_day_created_idx
  on public.hour_balance_transactions (related_leave_request_day_id, created_at)
  where related_leave_request_day_id is not null;

create or replace function public.assert_month_closing_actor(
  p_organization_id text,
  p_actor_id text,
  p_contractor_id text,
  p_requires_hr boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_status text;
begin
  select role, status into v_role, v_status
  from public.users
  where id = p_actor_id and organization_id = p_organization_id;

  if v_role is null or v_status <> 'ACTIVE' then
    raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED';
  end if;
  if p_requires_hr and v_role not in ('RH', 'ADMIN', 'DEV') then
    raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED';
  end if;
  if not p_requires_hr and v_role = 'PJ' and p_actor_id <> p_contractor_id then
    raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED';
  end if;
  if not exists (
    select 1 from public.users
    where id = p_contractor_id and organization_id = p_organization_id and role = 'PJ'
  ) then
    raise exception 'HORUS_DOMAIN:CONTRACTOR_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.recalculate_timesheet(p_timesheet_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_worked integer;
  v_eligible integer;
  v_occurrence integer;
  v_leave integer;
  v_organization_id text;
  v_contractor_id text;
  v_period_start date;
  v_period_end date;
begin
  select
    organization_id,
    contractor_id,
    make_date(year, month, 1),
    (make_date(year, month, 1) + interval '1 month - 1 day')::date
  into v_organization_id, v_contractor_id, v_period_start, v_period_end
  from public.monthly_timesheets
  where id = p_timesheet_id;

  if v_organization_id is null then return; end if;

  select
    coalesce(sum(calculated_minutes), 0)::integer,
    coalesce(sum(eligible_minutes), 0)::integer
  into v_worked, v_eligible
  from public.time_entries
  where organization_id = v_organization_id
    and contractor_id = v_contractor_id
    and work_date between v_period_start and v_period_end;

  select coalesce(sum(day.minutes), 0)::integer into v_occurrence
  from public.occurrence_days day
  join public.occurrences occurrence on occurrence.id = day.occurrence_id
  where day.organization_id = v_organization_id
    and occurrence.contractor_id = v_contractor_id
    and occurrence.status = 'APPROVED'
    and occurrence.calculation_effect = 'CREDITS_HOURS'
    and day.work_date between v_period_start and v_period_end;

  select coalesce(sum(day.minutes), 0)::integer into v_leave
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  where day.organization_id = v_organization_id
    and request.contractor_id = v_contractor_id
    and day.application_status = 'APPLIED'
    and day.work_date between v_period_start and v_period_end;

  update public.monthly_timesheets
  set worked_minutes = v_worked,
      credited_minutes = v_occurrence + v_leave,
      considered_minutes = v_eligible + v_occurrence + v_leave,
      calculated_balance_minutes = v_eligible + v_occurrence + v_leave - required_minutes,
      updated_at = now()
  where id = p_timesheet_id;
end;
$$;

create or replace function public.preview_timesheet_v2(
  p_organization_id text,
  p_actor_id text,
  p_contractor_id text,
  p_year integer,
  p_month integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period_start date;
  v_period_end date;
  v_required integer;
  v_worked integer;
  v_eligible integer;
  v_entry_count integer;
  v_occurrence integer;
  v_leave integer;
  v_credited integer;
  v_considered integer;
  v_balance integer;
  v_timesheet_status text;
  v_reopened_at timestamptz;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_review_data jsonb;
  v_review_version text;
  v_state text;
begin
  if p_year not between 2000 and 2200 or p_month not between 1 and 12 then
    raise exception 'HORUS_DOMAIN:INVALID_PERIOD';
  end if;
  perform public.assert_month_closing_actor(
    p_organization_id, p_actor_id, p_contractor_id, false
  );

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;

  select coalesce(monthly_required_minutes, 9720)
  into v_required
  from public.organization_policies
  where organization_id = p_organization_id;
  v_required := coalesce(v_required, 9720);

  select status, reopened_at
  into v_timesheet_status, v_reopened_at
  from public.monthly_timesheets
  where organization_id = p_organization_id
    and contractor_id = p_contractor_id
    and year = p_year and month = p_month;
  v_timesheet_status := coalesce(v_timesheet_status, 'OPEN');

  select
    count(*)::integer,
    coalesce(sum(calculated_minutes), 0)::integer,
    coalesce(sum(eligible_minutes), 0)::integer
  into v_entry_count, v_worked, v_eligible
  from public.time_entries
  where organization_id = p_organization_id
    and contractor_id = p_contractor_id
    and work_date between v_period_start and v_period_end;

  select coalesce(sum(day.minutes), 0)::integer into v_occurrence
  from public.occurrence_days day
  join public.occurrences occurrence on occurrence.id = day.occurrence_id
  where day.organization_id = p_organization_id
    and occurrence.contractor_id = p_contractor_id
    and occurrence.status = 'APPROVED'
    and occurrence.calculation_effect = 'CREDITS_HOURS'
    and day.work_date between v_period_start and v_period_end;

  select coalesce(sum(day.minutes), 0)::integer into v_leave
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  where day.organization_id = p_organization_id
    and request.contractor_id = p_contractor_id
    and request.status in ('APPROVED', 'PARTIALLY_APPLIED')
    and day.application_status = 'APPROVED'
    and day.work_date between v_period_start and v_period_end;

  v_credited := v_occurrence + v_leave;
  v_considered := v_eligible + v_credited;
  v_balance := v_considered - v_required;

  if exists (
    select 1 from public.leave_requests request
    where request.organization_id = p_organization_id
      and request.contractor_id = p_contractor_id
      and request.status = 'REQUESTED'
      and request.start_date <= v_period_end and request.end_date >= v_period_start
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'PENDING_LEAVE',
      'message', 'Há uma folga aguardando análise.',
      'action', 'REVIEW_LEAVE'
    ));
  end if;

  if exists (
    select 1 from public.occurrences occurrence
    where occurrence.organization_id = p_organization_id
      and occurrence.contractor_id = p_contractor_id
      and occurrence.status = 'REQUESTED'
      and occurrence.start_date <= v_period_end and occurrence.end_date >= v_period_start
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'PENDING_OCCURRENCE',
      'message', 'Há uma ausência ou justificativa aguardando análise.',
      'action', 'REVIEW_OCCURRENCE'
    ));
  end if;

  if exists (
    select 1 from public.non_business_day_authorizations auth_request
    where auth_request.organization_id = p_organization_id
      and auth_request.contractor_id = p_contractor_id
      and auth_request.work_date between v_period_start and v_period_end
      and auth_request.status = 'REQUESTED'
  ) or exists (
    select 1 from public.time_entries entry
    where entry.organization_id = p_organization_id
      and entry.contractor_id = p_contractor_id
      and entry.work_date between v_period_start and v_period_end
      and entry.non_business_day_status = 'PENDING_AUTHORIZATION'
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'PENDING_NON_BUSINESS_AUTH',
      'message', 'Há trabalho em dia não útil aguardando autorização.',
      'action', 'REVIEW_AUTHORIZATION'
    ));
  end if;

  if exists (
    select 1 from public.leave_requests request
    where request.organization_id = p_organization_id
      and request.contractor_id = p_contractor_id
      and request.allocation_status = 'NEEDS_REVIEW'
      and request.start_date <= v_period_end and request.end_date >= v_period_start
      and request.status not in ('REJECTED', 'CANCELLED')
  ) or exists (
    select 1 from public.occurrences occurrence
    where occurrence.organization_id = p_organization_id
      and occurrence.contractor_id = p_contractor_id
      and occurrence.allocation_status = 'NEEDS_REVIEW'
      and occurrence.start_date <= v_period_end and occurrence.end_date >= v_period_start
      and occurrence.status not in ('REJECTED', 'CANCELLED')
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'INCOMPLETE_DAILY_ALLOCATION',
      'message', 'As horas de alguns dias precisam ser distribuídas.',
      'action', 'DISTRIBUTE_HOURS'
    ));
  end if;

  if v_entry_count = 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'NO_ENTRIES',
      'message', 'Nenhuma hora foi registrada neste mês.',
      'action', 'REVIEW_EMPTY_MONTH'
    ));
  end if;

  if v_timesheet_status = 'CLOSED' then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'ALREADY_CLOSED',
      'message', 'Este mês já está fechado.',
      'action', 'VIEW_CLOSING'
    ));
  end if;

  if v_leave > 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'APPROVED_LEAVE',
      'message', 'Há folgas aprovadas que serão aplicadas neste mês.'
    ));
  end if;
  if v_balance < 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'PROJECTED_NEGATIVE_BALANCE',
      'message', 'O fechamento projeta saldo negativo.'
    ));
  end if;
  if v_reopened_at is not null then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'PREVIOUSLY_REOPENED',
      'message', 'Este mês já foi reaberto anteriormente.'
    ));
  end if;

  v_review_data := jsonb_build_object(
    'ruleVersion', 2,
    'organizationId', p_organization_id,
    'contractorId', p_contractor_id,
    'year', p_year,
    'month', p_month,
    'policy', coalesce((
      select to_jsonb(policy) - 'created_at' - 'updated_at'
      from public.organization_policies policy
      where policy.organization_id = p_organization_id
    ), '{}'::jsonb),
    'timesheet', jsonb_build_object(
      'status', v_timesheet_status,
      'closureVersion', coalesce((
        select closure_version from public.monthly_timesheets
        where organization_id = p_organization_id and contractor_id = p_contractor_id
          and year = p_year and month = p_month
      ), 0)
    ),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.id)
      from public.time_entries entry
      where entry.organization_id = p_organization_id
        and entry.contractor_id = p_contractor_id
        and entry.work_date between v_period_start and v_period_end
    ), '[]'::jsonb),
    'leaveRequests', coalesce((
      select jsonb_agg(to_jsonb(request) order by request.id)
      from public.leave_requests request
      where request.organization_id = p_organization_id
        and request.contractor_id = p_contractor_id
        and request.start_date <= v_period_end and request.end_date >= v_period_start
    ), '[]'::jsonb),
    'leaveDays', coalesce((
      select jsonb_agg(to_jsonb(day) order by day.id)
      from public.leave_request_days day
      join public.leave_requests request on request.id = day.leave_request_id
      where day.organization_id = p_organization_id
        and request.contractor_id = p_contractor_id
        and day.work_date between v_period_start and v_period_end
    ), '[]'::jsonb),
    'occurrences', coalesce((
      select jsonb_agg(to_jsonb(occurrence) order by occurrence.id)
      from public.occurrences occurrence
      where occurrence.organization_id = p_organization_id
        and occurrence.contractor_id = p_contractor_id
        and occurrence.start_date <= v_period_end and occurrence.end_date >= v_period_start
    ), '[]'::jsonb),
    'occurrenceDays', coalesce((
      select jsonb_agg(to_jsonb(day) order by day.id)
      from public.occurrence_days day
      join public.occurrences occurrence on occurrence.id = day.occurrence_id
      where day.organization_id = p_organization_id
        and occurrence.contractor_id = p_contractor_id
        and day.work_date between v_period_start and v_period_end
    ), '[]'::jsonb),
    'authorizations', coalesce((
      select jsonb_agg(to_jsonb(auth_request) order by auth_request.id)
      from public.non_business_day_authorizations auth_request
      where auth_request.organization_id = p_organization_id
        and auth_request.contractor_id = p_contractor_id
        and auth_request.work_date between v_period_start and v_period_end
    ), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(to_jsonb(reservation) order by reservation.id)
      from public.leave_request_reservations reservation
      join public.leave_requests request on request.id = reservation.leave_request_id
      where reservation.organization_id = p_organization_id
        and request.contractor_id = p_contractor_id
        and request.start_date <= v_period_end and request.end_date >= v_period_start
    ), '[]'::jsonb),
    'lots', coalesce((
      select jsonb_agg(to_jsonb(lot) order by lot.id)
      from public.hour_balance_lots lot
      where lot.organization_id = p_organization_id
        and lot.contractor_id = p_contractor_id
    ), '[]'::jsonb)
  );
  v_review_version := md5(v_review_data::text);

  v_state := case
    when v_timesheet_status = 'CLOSED' then 'CLOSED'
    when jsonb_array_length(v_blockers) > 0 then 'NEEDS_REVIEW'
    else 'READY'
  end;

  return jsonb_build_object(
    'organizationId', p_organization_id,
    'contractorId', p_contractor_id,
    'year', p_year,
    'month', p_month,
    'state', v_state,
    'workedMinutes', v_worked,
    'occurrenceMinutes', v_occurrence,
    'leaveMinutes', v_leave,
    'creditedMinutes', v_credited,
    'consideredMinutes', v_considered,
    'requiredMinutes', v_required,
    'projectedBalanceMinutes', v_balance,
    'bankImpact', jsonb_build_object(
      'direction', case when v_balance > 0 then 'CREDIT' when v_balance < 0 then 'DEBIT' else 'NONE' end,
      'minutes', abs(v_balance)
    ),
    'blockers', v_blockers,
    'warnings', v_warnings,
    'reviewVersion', v_review_version
  );
end;
$$;

create or replace function public.close_timesheet_v2(
  p_organization_id text,
  p_actor_id text,
  p_contractor_id text,
  p_year integer,
  p_month integer,
  p_review_version text,
  p_allow_empty_month boolean default false,
  p_empty_month_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period_start date;
  v_period_end date;
  v_required integer;
  v_timesheet public.monthly_timesheets%rowtype;
  v_timesheet_id text;
  v_preview jsonb;
  v_blocker jsonb;
  v_day record;
  v_reservation public.leave_request_reservations%rowtype;
  v_lot public.hour_balance_lots%rowtype;
  v_needed integer;
  v_take integer;
  v_available integer;
  v_balance integer;
  v_remaining integer;
  v_deadline date;
  v_new_lot_id text;
  v_lot_changes jsonb := '[]'::jsonb;
  v_reservation_changes jsonb := '[]'::jsonb;
  v_leave_day_changes jsonb := '[]'::jsonb;
  v_before_remaining integer;
  v_before_reserved integer;
  v_before_consumed integer;
  v_before_status text;
  v_after_status text;
  v_transaction_id text;
  v_snapshot jsonb;
begin
  if p_year not between 2000 and 2200 or p_month not between 1 and 12 then
    raise exception 'HORUS_DOMAIN:INVALID_PERIOD';
  end if;
  if coalesce(length(p_review_version), 0) = 0 then
    raise exception 'HORUS_DOMAIN:REVIEW_REQUIRED';
  end if;
  perform public.assert_month_closing_actor(
    p_organization_id, p_actor_id, p_contractor_id, true
  );

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id || ':' || p_contractor_id || ':' || p_year || ':' || p_month,
    0
  ));

  select * into v_timesheet
  from public.monthly_timesheets
  where organization_id = p_organization_id
    and contractor_id = p_contractor_id
    and year = p_year and month = p_month
  for update;

  if v_timesheet.id is not null and v_timesheet.status = 'CLOSED' then
    return jsonb_build_object(
      'alreadyClosed', true,
      'timesheetId', v_timesheet.id,
      'balanceMinutes', v_timesheet.calculated_balance_minutes
    );
  end if;

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;
  select coalesce(monthly_required_minutes, 9720) into v_required
  from public.organization_policies
  where organization_id = p_organization_id;
  v_required := coalesce(v_required, 9720);

  v_timesheet_id := 'ts_' || p_contractor_id || '_' || p_year || '_' || p_month;
  insert into public.monthly_timesheets (
    id, organization_id, contractor_id, year, month, required_minutes
  ) values (
    v_timesheet_id, p_organization_id, p_contractor_id, p_year, p_month, v_required
  ) on conflict (organization_id, contractor_id, year, month) do nothing;

  select * into v_timesheet
  from public.monthly_timesheets
  where organization_id = p_organization_id
    and contractor_id = p_contractor_id
    and year = p_year and month = p_month
  for update;
  v_timesheet_id := v_timesheet.id;

  perform entry.id
  from public.time_entries entry
  where entry.organization_id = p_organization_id
    and entry.contractor_id = p_contractor_id
    and entry.work_date between v_period_start and v_period_end
  order by entry.id for update;

  perform request.id
  from public.leave_requests request
  where request.organization_id = p_organization_id
    and request.contractor_id = p_contractor_id
    and request.start_date <= v_period_end and request.end_date >= v_period_start
  order by request.id for update;

  perform day.id
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  where day.organization_id = p_organization_id
    and request.contractor_id = p_contractor_id
    and day.work_date between v_period_start and v_period_end
  order by day.id for update of day;

  perform reservation.id
  from public.leave_request_reservations reservation
  join public.leave_requests request on request.id = reservation.leave_request_id
  where reservation.organization_id = p_organization_id
    and request.contractor_id = p_contractor_id
    and request.start_date <= v_period_end and request.end_date >= v_period_start
  order by reservation.id for update of reservation;

  perform lot.id
  from public.hour_balance_lots lot
  where lot.organization_id = p_organization_id
    and lot.contractor_id = p_contractor_id
  order by lot.id for update;

  v_preview := public.preview_timesheet_v2(
    p_organization_id, p_actor_id, p_contractor_id, p_year, p_month
  );
  if v_preview->>'reviewVersion' <> p_review_version then
    raise exception 'HORUS_DOMAIN:REVIEW_OUTDATED';
  end if;

  for v_blocker in select value from jsonb_array_elements(v_preview->'blockers')
  loop
    if v_blocker->>'code' = 'NO_ENTRIES' and p_allow_empty_month then
      if length(trim(coalesce(p_empty_month_reason, ''))) < 5 then
        raise exception 'HORUS_DOMAIN:EMPTY_MONTH_REASON_REQUIRED';
      end if;
    elsif v_blocker->>'code' <> 'ALREADY_CLOSED' then
      raise exception 'HORUS_DOMAIN:%', v_blocker->>'code';
    end if;
  end loop;

  if p_allow_empty_month
     and not (v_preview->'blockers' @> '[{"code":"NO_ENTRIES"}]'::jsonb) then
    raise exception 'HORUS_DOMAIN:EMPTY_MONTH_EXCEPTION_NOT_APPLICABLE';
  end if;

  for v_day in
    select
      day.*,
      request.contractor_id,
      request.id as request_id
    from public.leave_request_days day
    join public.leave_requests request on request.id = day.leave_request_id
    where day.organization_id = p_organization_id
      and request.contractor_id = p_contractor_id
      and request.status in ('APPROVED', 'PARTIALLY_APPLIED')
      and day.application_status = 'APPROVED'
      and day.work_date between v_period_start and v_period_end
    order by day.work_date, day.id
    for update of day
  loop
    v_leave_day_changes := v_leave_day_changes || jsonb_build_array(jsonb_build_object(
      'dayId', v_day.id,
      'requestId', v_day.request_id,
      'minutes', v_day.minutes,
      'beforeStatus', v_day.application_status,
      'beforeAppliedTimesheetId', v_day.applied_timesheet_id,
      'beforeAppliedAt', v_day.applied_at
    ));
    v_needed := v_day.minutes;

    for v_reservation in
      select reservation.*
      from public.leave_request_reservations reservation
      join public.hour_balance_lots lot on lot.id = reservation.lot_id
      where reservation.leave_request_id = v_day.request_id
        and reservation.status = 'ACTIVE'
        and reservation.consumed_minutes < reservation.minutes
      order by lot.origin_date, lot.created_at, reservation.id
      for update of reservation
    loop
      exit when v_needed = 0;
      select * into v_lot from public.hour_balance_lots
      where id = v_reservation.lot_id for update;

      v_available := least(
        v_reservation.minutes - v_reservation.consumed_minutes,
        least(v_lot.remaining_minutes, v_lot.reserved_minutes)
      );
      v_take := least(v_needed, v_available);
      if v_take <= 0 then continue; end if;

      v_before_remaining := v_lot.remaining_minutes;
      v_before_reserved := v_lot.reserved_minutes;
      v_before_status := v_lot.status;
      v_before_consumed := v_reservation.consumed_minutes;
      v_after_status := case
        when v_lot.remaining_minutes - v_take = 0 then 'CONSUMED'
        when v_lot.reserved_minutes - v_take > 0 then 'RESERVED'
        else 'AVAILABLE'
      end;

      update public.hour_balance_lots
      set remaining_minutes = remaining_minutes - v_take,
          reserved_minutes = reserved_minutes - v_take,
          status = v_after_status,
          updated_at = now()
      where id = v_lot.id;

      update public.leave_request_reservations
      set consumed_minutes = consumed_minutes + v_take,
          status = case when consumed_minutes + v_take = minutes then 'CONSUMED' else 'ACTIVE' end,
          updated_at = now()
      where id = v_reservation.id;

      v_transaction_id := gen_random_uuid()::text;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, related_leave_request_id, related_leave_request_day_id,
        description, created_by
      ) values (
        v_transaction_id, p_organization_id, p_contractor_id, v_lot.id,
        'CONSUMPTION', v_take, v_timesheet_id, v_day.request_id, v_day.id,
        'Crédito aplicado como folga no fechamento mensal', p_actor_id
      );

      v_lot_changes := v_lot_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_lot.id,
        'created', false,
        'beforeRemaining', v_before_remaining,
        'beforeReserved', v_before_reserved,
        'beforeStatus', v_before_status,
        'afterRemaining', v_before_remaining - v_take,
        'afterReserved', v_before_reserved - v_take,
        'afterStatus', v_after_status,
        'transactionId', v_transaction_id
      ));
      v_reservation_changes := v_reservation_changes || jsonb_build_array(jsonb_build_object(
        'reservationId', v_reservation.id,
        'beforeConsumed', v_before_consumed,
        'beforeStatus', v_reservation.status,
        'afterConsumed', v_before_consumed + v_take,
        'afterStatus', case
          when v_before_consumed + v_take = v_reservation.minutes then 'CONSUMED'
          else 'ACTIVE'
        end
      ));
      v_needed := v_needed - v_take;
    end loop;

    if v_needed > 0 then
      raise exception 'HORUS_DOMAIN:RESERVED_CREDIT_MISMATCH';
    end if;

    update public.leave_request_days
    set application_status = 'APPLIED',
        applied_timesheet_id = v_timesheet_id,
        applied_at = now(),
        updated_at = now()
    where id = v_day.id;
  end loop;

  update public.leave_requests request
  set status = case
        when not exists (
          select 1 from public.leave_request_days day
          where day.leave_request_id = request.id
            and day.application_status not in ('APPLIED', 'CANCELLED')
        ) then 'APPLIED'
        else 'PARTIALLY_APPLIED'
      end,
      reserved_minutes = coalesce((
        select sum(greatest(reservation.minutes - reservation.consumed_minutes, 0))::integer
        from public.leave_request_reservations reservation
        where reservation.leave_request_id = request.id
          and reservation.status = 'ACTIVE'
      ), 0)
  where exists (
    select 1 from public.leave_request_days day
    where day.leave_request_id = request.id
      and day.applied_timesheet_id = v_timesheet_id
  );

  perform public.recalculate_timesheet(v_timesheet_id);
  select * into v_timesheet from public.monthly_timesheets
  where id = v_timesheet_id for update;
  v_balance := v_timesheet.calculated_balance_minutes;
  v_remaining := abs(v_balance);
  v_deadline := v_period_end + 90;

  if v_balance > 0 then
    for v_lot in
      select * from public.hour_balance_lots
      where organization_id = p_organization_id and contractor_id = p_contractor_id
        and type = 'DEBIT' and remaining_minutes > 0
        and status not in ('CANCELLED', 'CONSUMED', 'SETTLED')
      order by origin_date, created_at, id for update
    loop
      exit when v_remaining = 0;
      v_before_remaining := v_lot.remaining_minutes;
      v_before_reserved := v_lot.reserved_minutes;
      v_before_status := v_lot.status;
      v_take := least(v_remaining, v_lot.remaining_minutes);
      v_after_status := case
        when v_lot.remaining_minutes - v_take = 0 then 'SETTLED'
        else 'PARTIALLY_COMPENSATED'
      end;
      update public.hour_balance_lots
      set remaining_minutes = remaining_minutes - v_take,
          status = v_after_status, updated_at = now()
      where id = v_lot.id;
      v_transaction_id := gen_random_uuid()::text;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        v_transaction_id, p_organization_id, p_contractor_id, v_lot.id,
        'COMPENSATION', v_take, v_timesheet_id,
        'Compensação FIFO por saldo mensal positivo', p_actor_id
      );
      v_lot_changes := v_lot_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_lot.id, 'created', false,
        'beforeRemaining', v_before_remaining, 'beforeReserved', v_before_reserved,
        'beforeStatus', v_before_status,
        'afterRemaining', v_before_remaining - v_take, 'afterReserved', v_before_reserved,
        'afterStatus', v_after_status, 'transactionId', v_transaction_id
      ));
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then
      v_new_lot_id := gen_random_uuid()::text;
      insert into public.hour_balance_lots (
        id, organization_id, contractor_id, origin_timesheet_id, type,
        original_minutes, remaining_minutes, origin_date, deadline_date, status
      ) values (
        v_new_lot_id, p_organization_id, p_contractor_id, v_timesheet_id, 'CREDIT',
        v_remaining, v_remaining, v_period_end, v_deadline, 'AVAILABLE'
      );
      v_transaction_id := gen_random_uuid()::text;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        v_transaction_id, p_organization_id, p_contractor_id, v_new_lot_id,
        'CREDIT', v_remaining, v_timesheet_id,
        'Crédito criado no fechamento mensal', p_actor_id
      );
      v_lot_changes := v_lot_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_new_lot_id, 'created', true,
        'beforeRemaining', 0, 'beforeReserved', 0, 'beforeStatus', null,
        'afterRemaining', v_remaining, 'afterReserved', 0,
        'afterStatus', 'AVAILABLE', 'transactionId', v_transaction_id
      ));
    end if;
  elsif v_balance < 0 then
    for v_lot in
      select * from public.hour_balance_lots
      where organization_id = p_organization_id and contractor_id = p_contractor_id
        and type = 'CREDIT' and remaining_minutes > reserved_minutes
        and status in ('AVAILABLE', 'RESERVED', 'OVERDUE_AVAILABLE')
      order by origin_date, created_at, id for update
    loop
      exit when v_remaining = 0;
      v_before_remaining := v_lot.remaining_minutes;
      v_before_reserved := v_lot.reserved_minutes;
      v_before_status := v_lot.status;
      v_take := least(v_remaining, v_lot.remaining_minutes - v_lot.reserved_minutes);
      v_after_status := case
        when v_lot.remaining_minutes - v_take = 0 then 'CONSUMED'
        when v_lot.reserved_minutes > 0 then 'RESERVED'
        else 'AVAILABLE'
      end;
      update public.hour_balance_lots
      set remaining_minutes = remaining_minutes - v_take,
          status = v_after_status, updated_at = now()
      where id = v_lot.id;
      v_transaction_id := gen_random_uuid()::text;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        v_transaction_id, p_organization_id, p_contractor_id, v_lot.id,
        'COMPENSATION', v_take, v_timesheet_id,
        'Compensação FIFO de déficit mensal', p_actor_id
      );
      v_lot_changes := v_lot_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_lot.id, 'created', false,
        'beforeRemaining', v_before_remaining, 'beforeReserved', v_before_reserved,
        'beforeStatus', v_before_status,
        'afterRemaining', v_before_remaining - v_take, 'afterReserved', v_before_reserved,
        'afterStatus', v_after_status, 'transactionId', v_transaction_id
      ));
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then
      v_new_lot_id := gen_random_uuid()::text;
      insert into public.hour_balance_lots (
        id, organization_id, contractor_id, origin_timesheet_id, type,
        original_minutes, remaining_minutes, origin_date, deadline_date, status
      ) values (
        v_new_lot_id, p_organization_id, p_contractor_id, v_timesheet_id, 'DEBIT',
        v_remaining, v_remaining, v_period_end, v_deadline, 'AVAILABLE'
      );
      v_transaction_id := gen_random_uuid()::text;
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        v_transaction_id, p_organization_id, p_contractor_id, v_new_lot_id,
        'DEBIT', v_remaining, v_timesheet_id,
        'Déficit criado no fechamento mensal', p_actor_id
      );
      v_lot_changes := v_lot_changes || jsonb_build_array(jsonb_build_object(
        'lotId', v_new_lot_id, 'created', true,
        'beforeRemaining', 0, 'beforeReserved', 0, 'beforeStatus', null,
        'afterRemaining', v_remaining, 'afterReserved', 0,
        'afterStatus', 'AVAILABLE', 'transactionId', v_transaction_id
      ));
    end if;
  end if;

  v_snapshot := jsonb_build_object(
    'ruleVersion', 2,
    'reviewVersion', p_review_version,
    'requiredMinutes', v_timesheet.required_minutes,
    'workedMinutes', v_timesheet.worked_minutes,
    'creditedMinutes', v_timesheet.credited_minutes,
    'consideredMinutes', v_timesheet.considered_minutes,
    'balanceMinutes', v_timesheet.calculated_balance_minutes,
    'leaveDayChanges', v_leave_day_changes,
    'reservationChanges', v_reservation_changes,
    'lotChanges', v_lot_changes,
    'emptyMonthException', case
      when p_allow_empty_month then jsonb_build_object(
        'used', true, 'reason', trim(p_empty_month_reason)
      )
      else jsonb_build_object('used', false)
    end,
    'actorId', p_actor_id,
    'closedAt', now()
  );

  update public.monthly_timesheets
  set status = 'CLOSED',
      closed_at = now(),
      closed_by = p_actor_id,
      closure_version = closure_version + 1,
      closure_snapshot = v_snapshot,
      updated_at = now()
  where id = v_timesheet_id;

  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id, new_value, reason
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id,
    case when p_allow_empty_month then 'TIMESHEET_CLOSED_EMPTY_EXCEPTION' else 'TIMESHEET_CLOSED' end,
    'MonthlyTimesheet', v_timesheet_id, v_snapshot,
    case when p_allow_empty_month then trim(p_empty_month_reason) else null end
  );

  return jsonb_build_object(
    'alreadyClosed', false,
    'timesheetId', v_timesheet_id,
    'balanceMinutes', v_balance,
    'snapshotVersion', 2
  );
end;
$$;

create or replace function public.reopen_timesheet_preview_v2(
  p_organization_id text,
  p_actor_id text,
  p_contractor_id text,
  p_year integer,
  p_month integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timesheet public.monthly_timesheets%rowtype;
  v_has_later_movement boolean;
begin
  perform public.assert_month_closing_actor(
    p_organization_id, p_actor_id, p_contractor_id, true
  );
  select * into v_timesheet
  from public.monthly_timesheets
  where organization_id = p_organization_id
    and contractor_id = p_contractor_id
    and year = p_year and month = p_month;

  if v_timesheet.id is null or v_timesheet.status <> 'CLOSED' then
    return jsonb_build_object(
      'canReopen', false,
      'code', 'TIMESHEET_NOT_CLOSED',
      'timesheetId', v_timesheet.id
    );
  end if;
  if coalesce(v_timesheet.closure_snapshot->>'ruleVersion', '') <> '2' then
    return jsonb_build_object(
      'canReopen', false,
      'code', 'LEGACY_CLOSING_REQUIRES_MANUAL_REVIEW',
      'timesheetId', v_timesheet.id
    );
  end if;

  select exists (
    select 1
    from public.hour_balance_transactions transaction
    where transaction.lot_id in (
      select distinct change->>'lotId'
      from jsonb_array_elements(
        coalesce(v_timesheet.closure_snapshot->'lotChanges', '[]'::jsonb)
      ) change
    )
      and transaction.created_at > v_timesheet.closed_at
      and transaction.type <> 'REVERSAL'
  ) into v_has_later_movement;

  if v_has_later_movement then
    return jsonb_build_object(
      'canReopen', false,
      'code', 'BALANCE_ALREADY_USED',
      'timesheetId', v_timesheet.id,
      'message', 'Não é possível reabrir automaticamente porque este saldo já foi utilizado.'
    );
  end if;

  return jsonb_build_object(
    'canReopen', true,
    'code', null,
    'timesheetId', v_timesheet.id,
    'closedAt', v_timesheet.closed_at,
    'totals', jsonb_build_object(
      'workedMinutes', v_timesheet.closure_snapshot->'workedMinutes',
      'creditedMinutes', v_timesheet.closure_snapshot->'creditedMinutes',
      'consideredMinutes', v_timesheet.closure_snapshot->'consideredMinutes',
      'requiredMinutes', v_timesheet.closure_snapshot->'requiredMinutes',
      'balanceMinutes', v_timesheet.closure_snapshot->'balanceMinutes'
    ),
    'leaveDays', coalesce(v_timesheet.closure_snapshot->'leaveDayChanges', '[]'::jsonb),
    'reservations', coalesce(v_timesheet.closure_snapshot->'reservationChanges', '[]'::jsonb),
    'lots', coalesce(v_timesheet.closure_snapshot->'lotChanges', '[]'::jsonb)
  );
end;
$$;

create or replace function public.reopen_timesheet_v2(
  p_organization_id text,
  p_actor_id text,
  p_contractor_id text,
  p_year integer,
  p_month integer,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timesheet public.monthly_timesheets%rowtype;
  v_preview jsonb;
  v_change jsonb;
  v_ordinality bigint;
  v_delta integer;
begin
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'HORUS_DOMAIN:REOPEN_REASON_REQUIRED';
  end if;
  perform public.assert_month_closing_actor(
    p_organization_id, p_actor_id, p_contractor_id, true
  );
  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id || ':' || p_contractor_id || ':' || p_year || ':' || p_month,
    0
  ));

  select * into v_timesheet
  from public.monthly_timesheets
  where organization_id = p_organization_id
    and contractor_id = p_contractor_id
    and year = p_year and month = p_month
  for update;
  if v_timesheet.id is null or v_timesheet.status <> 'CLOSED' then
    raise exception 'HORUS_DOMAIN:TIMESHEET_NOT_CLOSED';
  end if;

  perform lot.id
  from public.hour_balance_lots lot
  where lot.id in (
    select distinct change->>'lotId'
    from jsonb_array_elements(
      coalesce(v_timesheet.closure_snapshot->'lotChanges', '[]'::jsonb)
    ) change
  )
  order by lot.id for update;

  perform reservation.id
  from public.leave_request_reservations reservation
  where reservation.id in (
    select distinct change->>'reservationId'
    from jsonb_array_elements(
      coalesce(v_timesheet.closure_snapshot->'reservationChanges', '[]'::jsonb)
    ) change
  )
  order by reservation.id for update;

  perform day.id
  from public.leave_request_days day
  where day.id in (
    select distinct change->>'dayId'
    from jsonb_array_elements(
      coalesce(v_timesheet.closure_snapshot->'leaveDayChanges', '[]'::jsonb)
    ) change
  )
  order by day.id for update;

  v_preview := public.reopen_timesheet_preview_v2(
    p_organization_id, p_actor_id, p_contractor_id, p_year, p_month
  );
  if not coalesce((v_preview->>'canReopen')::boolean, false) then
    raise exception 'HORUS_DOMAIN:%', coalesce(v_preview->>'code', 'REOPEN_BLOCKED');
  end if;

  for v_change, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(
      coalesce(v_timesheet.closure_snapshot->'lotChanges', '[]'::jsonb)
    ) with ordinality
    order by ordinality desc
  loop
    if coalesce((v_change->>'created')::boolean, false) then
      update public.hour_balance_lots
      set remaining_minutes = 0,
          reserved_minutes = 0,
          status = 'CANCELLED',
          updated_at = now()
      where id = v_change->>'lotId';
    else
      update public.hour_balance_lots
      set remaining_minutes = coalesce((v_change->>'beforeRemaining')::integer, 0),
          reserved_minutes = coalesce((v_change->>'beforeReserved')::integer, 0),
          status = coalesce(v_change->>'beforeStatus', 'AVAILABLE'),
          updated_at = now()
      where id = v_change->>'lotId';
    end if;

    v_delta := abs(
      coalesce((v_change->>'afterRemaining')::integer, 0)
      - coalesce((v_change->>'beforeRemaining')::integer, 0)
    );
    if v_delta > 0 then
      insert into public.hour_balance_transactions (
        id, organization_id, contractor_id, lot_id, type, minutes,
        related_timesheet_id, description, created_by
      ) values (
        gen_random_uuid()::text, p_organization_id, p_contractor_id,
        v_change->>'lotId', 'REVERSAL', v_delta, v_timesheet.id,
        'Estorno por reabertura da competência', p_actor_id
      );
    end if;
  end loop;

  for v_change, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(
      coalesce(v_timesheet.closure_snapshot->'reservationChanges', '[]'::jsonb)
    ) with ordinality
    order by ordinality desc
  loop
    update public.leave_request_reservations
    set consumed_minutes = coalesce((v_change->>'beforeConsumed')::integer, 0),
        status = coalesce(v_change->>'beforeStatus', 'ACTIVE'),
        updated_at = now()
    where id = v_change->>'reservationId';
  end loop;

  for v_change, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(
      coalesce(v_timesheet.closure_snapshot->'leaveDayChanges', '[]'::jsonb)
    ) with ordinality
    order by ordinality desc
  loop
    update public.leave_request_days
    set application_status = coalesce(v_change->>'beforeStatus', 'APPROVED'),
        applied_timesheet_id = nullif(v_change->>'beforeAppliedTimesheetId', ''),
        applied_at = nullif(v_change->>'beforeAppliedAt', '')::timestamptz,
        updated_at = now()
    where id = v_change->>'dayId';
  end loop;

  update public.leave_requests request
  set status = case
        when exists (
          select 1 from public.leave_request_days day
          where day.leave_request_id = request.id and day.application_status = 'APPLIED'
        ) then 'PARTIALLY_APPLIED'
        else 'APPROVED'
      end,
      reserved_minutes = coalesce((
        select sum(greatest(reservation.minutes - reservation.consumed_minutes, 0))::integer
        from public.leave_request_reservations reservation
        where reservation.leave_request_id = request.id
          and reservation.status = 'ACTIVE'
      ), 0)
  where request.id in (
    select distinct change->>'requestId'
    from jsonb_array_elements(
      coalesce(v_timesheet.closure_snapshot->'leaveDayChanges', '[]'::jsonb)
    ) change
  );

  update public.monthly_timesheets
  set status = 'REOPENED',
      reopened_at = now(),
      reopened_by = p_actor_id,
      reopen_reason = trim(p_reason),
      updated_at = now()
  where id = v_timesheet.id;
  perform public.recalculate_timesheet(v_timesheet.id);

  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id, reason, new_value
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id, 'TIMESHEET_REOPENED',
    'MonthlyTimesheet', v_timesheet.id, trim(p_reason),
    jsonb_build_object('status', 'REOPENED', 'snapshotVersion', 2)
  );

  return jsonb_build_object(
    'timesheetId', v_timesheet.id,
    'status', 'REOPENED'
  );
end;
$$;

create or replace function public.decide_occurrence_v2(
  p_organization_id text,
  p_actor_id text,
  p_occurrence_id text,
  p_action text,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_occurrence public.occurrences%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_period record;
  v_timesheet_id text;
begin
  if not exists (
    select 1 from public.users
    where id = p_actor_id and organization_id = p_organization_id
      and status = 'ACTIVE' and role in ('RH', 'ADMIN', 'DEV')
  ) then
    raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED';
  end if;

  select * into v_occurrence
  from public.occurrences
  where id = p_occurrence_id and organization_id = p_organization_id
  for update;
  if v_occurrence.id is null then raise exception 'HORUS_DOMAIN:OCCURRENCE_NOT_FOUND'; end if;
  if v_occurrence.status <> 'REQUESTED' then raise exception 'HORUS_DOMAIN:OCCURRENCE_ALREADY_DECIDED'; end if;
  if p_action not in ('APPROVE', 'REJECT') then raise exception 'HORUS_DOMAIN:INVALID_ACTION'; end if;
  if p_action = 'APPROVE' and v_occurrence.allocation_status <> 'COMPLETE' then
    raise exception 'HORUS_DOMAIN:INCOMPLETE_DAILY_ALLOCATION';
  end if;
  if p_action = 'APPROVE' and (
    select coalesce(sum(minutes), 0) from public.occurrence_days
    where occurrence_id = v_occurrence.id
  ) <> v_occurrence.minutes then
    raise exception 'HORUS_DOMAIN:DAILY_TOTAL_MISMATCH';
  end if;

  v_previous := to_jsonb(v_occurrence);
  update public.occurrences
  set status = case when p_action = 'APPROVE' then 'APPROVED' else 'REJECTED' end,
      decided_by = p_actor_id,
      decided_at = now(),
      decision_notes = p_notes,
      updated_by = p_actor_id,
      updated_at = now()
  where id = v_occurrence.id;

  for v_period in
    select distinct extract(year from work_date)::integer as year,
      extract(month from work_date)::integer as month
    from public.occurrence_days where occurrence_id = v_occurrence.id
  loop
    select id into v_timesheet_id
    from public.monthly_timesheets
    where organization_id = p_organization_id
      and contractor_id = v_occurrence.contractor_id
      and year = v_period.year and month = v_period.month;
    if v_timesheet_id is not null then perform public.recalculate_timesheet(v_timesheet_id); end if;
  end loop;

  select to_jsonb(occurrence) into v_new
  from public.occurrences occurrence where id = v_occurrence.id;
  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id,
    previous_value, new_value, reason
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id,
    'OCCURRENCE_' || p_action, 'Occurrence', v_occurrence.id,
    v_previous, v_new, p_notes
  );
  return jsonb_build_object(
    'id', v_occurrence.id,
    'status', case when p_action = 'APPROVE' then 'APPROVED' else 'REJECTED' end
  );
end;
$$;

create or replace function public.decide_non_business_authorization_v2(
  p_organization_id text,
  p_actor_id text,
  p_authorization_id text,
  p_action text,
  p_approved_minutes integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_authorization public.non_business_day_authorizations%rowtype;
  v_entry public.time_entries%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_status text;
  v_approved integer;
begin
  if not exists (
    select 1 from public.users
    where id = p_actor_id and organization_id = p_organization_id
      and status = 'ACTIVE' and role in ('RH', 'ADMIN', 'DEV')
  ) then
    raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED';
  end if;
  if p_action not in ('APPROVE', 'REJECT', 'NEEDS_ADJUSTMENT') then
    raise exception 'HORUS_DOMAIN:INVALID_ACTION';
  end if;

  select * into v_authorization
  from public.non_business_day_authorizations
  where id = p_authorization_id and organization_id = p_organization_id
  for update;
  if v_authorization.id is null then raise exception 'HORUS_DOMAIN:AUTHORIZATION_NOT_FOUND'; end if;
  if v_authorization.status <> 'REQUESTED' then raise exception 'HORUS_DOMAIN:AUTHORIZATION_ALREADY_DECIDED'; end if;

  select * into v_entry
  from public.time_entries
  where organization_id = p_organization_id
    and contractor_id = v_authorization.contractor_id
    and work_date = v_authorization.work_date
  for update;
  if v_entry.id is null then raise exception 'HORUS_DOMAIN:TIME_ENTRY_NOT_FOUND'; end if;

  v_previous := to_jsonb(v_authorization);
  v_status := case p_action
    when 'APPROVE' then 'APPROVED'
    when 'REJECT' then 'REJECTED'
    else 'NEEDS_ADJUSTMENT'
  end;
  if p_action = 'APPROVE' then
    v_approved := coalesce(p_approved_minutes, v_authorization.estimated_minutes);
    if v_approved <= 0 or v_approved > v_entry.calculated_minutes or v_approved > 1440 then
      raise exception 'HORUS_DOMAIN:INVALID_APPROVED_MINUTES';
    end if;
  end if;

  update public.non_business_day_authorizations
  set status = v_status,
      approved_minutes = v_approved,
      decided_at = now(),
      decided_by = p_actor_id,
      decision_notes = p_notes
  where id = v_authorization.id;

  update public.time_entries
  set eligible_minutes = case when p_action = 'APPROVE' then v_approved else 0 end,
      non_business_day_status = case
        when p_action = 'APPROVE' then 'AUTHORIZED'
        when p_action = 'REJECT' then 'REJECTED'
        else 'PENDING_AUTHORIZATION'
      end,
      updated_by = p_actor_id,
      updated_at = now()
  where id = v_entry.id;
  perform public.recalculate_timesheet(v_entry.timesheet_id);

  select to_jsonb(auth_request) into v_new
  from public.non_business_day_authorizations auth_request
  where id = v_authorization.id;
  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id,
    previous_value, new_value, reason
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id,
    'NON_BUSINESS_AUTHORIZATION_' || p_action,
    'NonBusinessDayAuthorization', v_authorization.id,
    v_previous, v_new, p_notes
  );
  return jsonb_build_object('id', v_authorization.id, 'status', v_status);
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
security invoker
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
  v_lot public.hour_balance_lots%rowtype;
  v_reservation public.leave_request_reservations%rowtype;
  v_actor_role text;
  v_needed integer;
  v_take integer;
  v_available integer;
  v_release integer;
  v_previous jsonb;
  v_new jsonb;
begin
  select role into v_actor_role
  from public.users
  where id = p_actor_id and organization_id = p_organization_id and status = 'ACTIVE';
  if v_actor_role is null then raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED'; end if;

  select * into v_request
  from public.leave_requests
  where id = p_request_id and organization_id = p_organization_id
  for update;
  if v_request.id is null then raise exception 'HORUS_DOMAIN:LEAVE_NOT_FOUND'; end if;
  if v_actor_role = 'PJ' and (p_actor_id <> v_request.contractor_id or p_action <> 'CANCEL') then
    raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED';
  end if;
  if v_actor_role not in ('PJ', 'RH', 'ADMIN', 'DEV') then
    raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED';
  end if;
  v_previous := to_jsonb(v_request);

  if p_action = 'APPROVE' then
    if v_actor_role not in ('RH', 'ADMIN', 'DEV') then raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED'; end if;
    if v_request.status <> 'REQUESTED' then raise exception 'HORUS_DOMAIN:LEAVE_ALREADY_DECIDED'; end if;
    if v_request.allocation_status <> 'COMPLETE' then raise exception 'HORUS_DOMAIN:INCOMPLETE_DAILY_ALLOCATION'; end if;
    if (
      select coalesce(sum(minutes), 0) from public.leave_request_days
      where leave_request_id = v_request.id and application_status = 'PENDING'
    ) <> v_request.requested_minutes then
      raise exception 'HORUS_DOMAIN:DAILY_TOTAL_MISMATCH';
    end if;

    v_needed := v_request.requested_minutes;
    for v_lot in
      select * from public.hour_balance_lots
      where organization_id = p_organization_id
        and contractor_id = v_request.contractor_id
        and type = 'CREDIT'
        and status in ('AVAILABLE', 'RESERVED', 'OVERDUE_AVAILABLE')
        and remaining_minutes > reserved_minutes
      order by origin_date, created_at, id for update
    loop
      exit when v_needed = 0;
      v_available := v_lot.remaining_minutes - v_lot.reserved_minutes;
      v_take := least(v_needed, v_available);
      insert into public.leave_request_reservations (
        id, organization_id, leave_request_id, lot_id, minutes, consumed_minutes
      ) values (
        gen_random_uuid()::text, p_organization_id, v_request.id, v_lot.id, v_take, 0
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
    if v_needed > 0 then raise exception 'HORUS_DOMAIN:INSUFFICIENT_CREDIT_BALANCE'; end if;

    update public.leave_request_days
    set application_status = 'APPROVED', updated_at = now()
    where leave_request_id = v_request.id and application_status = 'PENDING';
    update public.leave_requests
    set status = 'APPROVED', reserved_minutes = requested_minutes,
        decided_at = now(), decided_by = p_actor_id, decision_notes = p_notes
    where id = v_request.id;

  elsif p_action = 'REJECT' then
    if v_actor_role not in ('RH', 'ADMIN', 'DEV') then raise exception 'HORUS_DOMAIN:ACTOR_NOT_AUTHORIZED'; end if;
    if v_request.status <> 'REQUESTED' then raise exception 'HORUS_DOMAIN:LEAVE_ALREADY_DECIDED'; end if;
    update public.leave_request_days
    set application_status = 'CANCELLED', updated_at = now()
    where leave_request_id = v_request.id and application_status = 'PENDING';
    update public.leave_requests
    set status = 'REJECTED', decided_at = now(), decided_by = p_actor_id,
        decision_notes = p_notes
    where id = v_request.id;

  elsif p_action = 'CANCEL' then
    if v_request.status not in ('REQUESTED', 'APPROVED', 'PARTIALLY_APPLIED') then
      raise exception 'HORUS_DOMAIN:LEAVE_CANNOT_BE_CANCELLED';
    end if;
    for v_reservation in
      select * from public.leave_request_reservations
      where leave_request_id = v_request.id and status = 'ACTIVE'
      order by id for update
    loop
      v_release := v_reservation.minutes - v_reservation.consumed_minutes;
      if v_release > 0 then
        update public.hour_balance_lots
        set reserved_minutes = greatest(0, reserved_minutes - v_release),
            status = case
              when remaining_minutes = 0 then 'CONSUMED'
              when reserved_minutes - v_release > 0 then 'RESERVED'
              else 'AVAILABLE'
            end,
            updated_at = now()
        where id = v_reservation.lot_id;
        insert into public.hour_balance_transactions (
          id, organization_id, contractor_id, lot_id, type, minutes,
          related_leave_request_id, description, created_by
        ) values (
          gen_random_uuid()::text, p_organization_id, v_request.contractor_id,
          v_reservation.lot_id, 'RELEASE', v_release, v_request.id,
          'Liberação por cancelamento de folga', p_actor_id
        );
      end if;
      update public.leave_request_reservations
      set status = case when consumed_minutes = minutes then 'CONSUMED' else 'RELEASED' end,
          updated_at = now()
      where id = v_reservation.id;
    end loop;

    update public.leave_request_days
    set application_status = 'CANCELLED', updated_at = now()
    where leave_request_id = v_request.id
      and application_status in ('PENDING', 'APPROVED');
    update public.leave_requests
    set status = case
          when exists (
            select 1 from public.leave_request_days
            where leave_request_id = v_request.id and application_status = 'APPLIED'
          ) then 'PARTIALLY_APPLIED'
          else 'CANCELLED'
        end,
        reserved_minutes = 0,
        decision_notes = coalesce(p_notes, decision_notes)
    where id = v_request.id;

  elsif p_action = 'UTILIZE' then
    raise exception 'HORUS_DOMAIN:USE_MONTH_CLOSING';
  else
    raise exception 'HORUS_DOMAIN:INVALID_ACTION';
  end if;

  select to_jsonb(request) into v_new
  from public.leave_requests request where id = v_request.id;
  insert into public.audit_logs (
    id, organization_id, user_id, action, entity_type, entity_id,
    previous_value, new_value, reason
  ) values (
    gen_random_uuid()::text, p_organization_id, p_actor_id,
    'LEAVE_REQUEST_' || p_action, 'LeaveRequest', v_request.id,
    v_previous, v_new, p_notes
  );
  return p_action;
end;
$$;

revoke all on function public.assert_month_closing_actor(text, text, text, boolean)
from public, anon, authenticated;
revoke all on function public.preview_timesheet_v2(text, text, text, integer, integer)
from public, anon, authenticated;
revoke all on function public.close_timesheet_v2(text, text, text, integer, integer, text, boolean, text)
from public, anon, authenticated;
revoke all on function public.reopen_timesheet_preview_v2(text, text, text, integer, integer)
from public, anon, authenticated;
revoke all on function public.reopen_timesheet_v2(text, text, text, integer, integer, text)
from public, anon, authenticated;
revoke all on function public.decide_occurrence_v2(text, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.decide_non_business_authorization_v2(text, text, text, text, integer, text)
from public, anon, authenticated;
revoke all on function public.decide_leave_request(text, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.recalculate_timesheet(text)
from public, anon, authenticated;

grant execute on function public.assert_month_closing_actor(text, text, text, boolean) to service_role;
grant execute on function public.preview_timesheet_v2(text, text, text, integer, integer) to service_role;
grant execute on function public.close_timesheet_v2(text, text, text, integer, integer, text, boolean, text) to service_role;
grant execute on function public.reopen_timesheet_preview_v2(text, text, text, integer, integer) to service_role;
grant execute on function public.reopen_timesheet_v2(text, text, text, integer, integer, text) to service_role;
grant execute on function public.decide_occurrence_v2(text, text, text, text, text) to service_role;
grant execute on function public.decide_non_business_authorization_v2(text, text, text, text, integer, text) to service_role;
grant execute on function public.decide_leave_request(text, text, text, text, text) to service_role;
grant execute on function public.recalculate_timesheet(text) to service_role;

comment on function public.preview_timesheet_v2(text, text, text, integer, integer) is
  'Side-effect-free official month-closing preview. reviewVersion covers all calculation inputs.';
comment on function public.close_timesheet_v2(text, text, text, integer, integer, text, boolean, text) is
  'Transactional month close with review revalidation, exact leave consumption and reversible snapshot v2.';

commit;

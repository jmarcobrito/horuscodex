-- Installation changes function definitions only; no existing row is rewritten.
begin;

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
commit;

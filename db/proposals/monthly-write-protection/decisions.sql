-- LOCAL CANDIDATE ONLY. Atomic replacements for multi-request API writes.
begin;

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
commit;

begin;

insert into public.organizations (id, name, status)
values ('org_workflow_test', 'Workflow Test', 'ACTIVE');

insert into public.organization_policies (
  id, organization_id, monthly_required_minutes, positive_balance_after_deadline_policy,
  retroactive_batch_threshold
) values ('policy_workflow_test', 'org_workflow_test', 9720, 'ALLOW_AFTER_DEADLINE', 3);

insert into public.users (id, organization_id, name, email, role, status)
values
  ('usr_workflow_rh', 'org_workflow_test', 'Workflow RH', 'workflow-rh@example.invalid', 'RH', 'ACTIVE'),
  ('usr_workflow_pj', 'org_workflow_test', 'Workflow PJ', 'workflow-pj@example.invalid', 'PJ', 'ACTIVE');

insert into public.monthly_timesheets (
  id, organization_id, contractor_id, year, month, required_minutes, status
) values (
  'ts_workflow_2026_9', 'org_workflow_test', 'usr_workflow_pj', 2026, 9, 9720, 'OPEN'
);

insert into public.time_entries (
  id, organization_id, timesheet_id, contractor_id, work_date,
  start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
  non_business_day_status, notes, created_by, updated_by
)
select
  'entry_workflow_' || day_number,
  'org_workflow_test',
  'ts_workflow_2026_9',
  'usr_workflow_pj',
  make_date(2026, 9, day_number),
  '08:00'::time,
  '23:59'::time,
  0,
  case when day_number = 7 then 600 else 1440 end,
  case when day_number = 7 then 600 else 1440 end,
  'NOT_APPLICABLE',
  '',
  'usr_workflow_pj',
  'usr_workflow_pj'
from generate_series(1, 7) as day_number;

insert into public.hour_balance_lots (
  id, organization_id, contractor_id, origin_timesheet_id, type,
  original_minutes, remaining_minutes, reserved_minutes, origin_date, deadline_date, status
) values (
  'lot_workflow_credit', 'org_workflow_test', 'usr_workflow_pj', 'ts_workflow_2026_9', 'CREDIT',
  600, 600, 480, '2026-06-30', '2026-09-28', 'RESERVED'
);

insert into public.leave_requests (
  id, organization_id, contractor_id, start_date, end_date,
  requested_minutes, reserved_minutes, status, reason, decided_at, decided_by,
  allocation_status
) values (
  'leave_workflow', 'org_workflow_test', 'usr_workflow_pj', '2026-09-15', '2026-09-15',
  480, 480, 'APPROVED', 'Folga de oito horas', now(), 'usr_workflow_rh', 'COMPLETE'
);

insert into public.leave_request_days (
  id, organization_id, leave_request_id, work_date, minutes, application_status
) values (
  'lrd_workflow', 'org_workflow_test', 'leave_workflow', '2026-09-15', 480, 'APPROVED'
);

insert into public.leave_request_reservations (
  id, organization_id, leave_request_id, lot_id, minutes, consumed_minutes, status
) values (
  'reservation_workflow', 'org_workflow_test', 'leave_workflow', 'lot_workflow_credit', 480, 0, 'ACTIVE'
);

do $$
declare
  v_preview jsonb;
  v_result jsonb;
begin
  v_preview := public.preview_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 9
  );

  if v_preview->>'state' <> 'READY'
     or (v_preview->>'workedMinutes')::integer <> 9240
     or (v_preview->>'leaveMinutes')::integer <> 480
     or (v_preview->>'consideredMinutes')::integer <> 9720
     or (v_preview->>'projectedBalanceMinutes')::integer <> 0 then
    raise exception '154h + 8h leave preview is incorrect: %', v_preview;
  end if;

  v_result := public.close_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 9,
    v_preview->>'reviewVersion', false, null
  );

  if coalesce((v_result->>'alreadyClosed')::boolean, true) then
    raise exception 'first close was treated as already closed';
  end if;

  if not exists (
    select 1 from public.monthly_timesheets
    where id = 'ts_workflow_2026_9' and status = 'CLOSED'
      and credited_minutes = 480 and considered_minutes = 9720
      and calculated_balance_minutes = 0
  ) then
    raise exception 'closed totals do not include leave exactly once';
  end if;

  if not exists (
    select 1 from public.hour_balance_lots
    where id = 'lot_workflow_credit' and remaining_minutes = 120 and reserved_minutes = 0
  ) then
    raise exception 'old credit was not reduced by exactly 480 minutes';
  end if;

  if not exists (
    select 1 from public.leave_request_reservations
    where id = 'reservation_workflow' and consumed_minutes = 480 and status = 'CONSUMED'
  ) or not exists (
    select 1 from public.leave_request_days
    where id = 'lrd_workflow' and application_status = 'APPLIED'
      and applied_timesheet_id = 'ts_workflow_2026_9'
  ) then
    raise exception 'leave application was not persisted exactly once';
  end if;

  if exists (
    select 1 from public.hour_balance_lots
    where origin_timesheet_id = 'ts_workflow_2026_9' and type = 'DEBIT'
  ) then
    raise exception 'leave created a second debit';
  end if;

  if (
    select coalesce(sum(minutes), 0) from public.hour_balance_transactions
    where related_timesheet_id = 'ts_workflow_2026_9'
      and related_leave_request_id = 'leave_workflow'
      and type = 'CONSUMPTION'
  ) <> 480 then
    raise exception 'leave consumption transaction is not exactly 480 minutes';
  end if;
end $$;

-- An outdated review must fail without closing the month.
insert into public.monthly_timesheets (
  id, organization_id, contractor_id, year, month, required_minutes, status
) values ('ts_workflow_2026_10', 'org_workflow_test', 'usr_workflow_pj', 2026, 10, 9720, 'OPEN');

do $$
declare
  v_preview jsonb;
begin
  v_preview := public.preview_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 10
  );

  insert into public.time_entries (
    id, organization_id, timesheet_id, contractor_id, work_date,
    start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
    non_business_day_status, notes, created_by, updated_by
  ) values (
    'entry_workflow_oct', 'org_workflow_test', 'ts_workflow_2026_10', 'usr_workflow_pj', '2026-10-01',
    '08:00', '09:00', 0, 60, 60, 'NOT_APPLICABLE', '', 'usr_workflow_pj', 'usr_workflow_pj'
  );

  begin
    perform public.close_timesheet_v2(
      'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 10,
      v_preview->>'reviewVersion', false, null
    );
    raise exception 'stale review was accepted';
  exception
    when others then
      if position('REVIEW_OUTDATED' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  if (select status from public.monthly_timesheets where id = 'ts_workflow_2026_10') <> 'OPEN' then
    raise exception 'stale review changed the month';
  end if;
end $$;

-- A pending request must remain a blocker independently of pagination in the UI.
insert into public.monthly_timesheets (
  id, organization_id, contractor_id, year, month, required_minutes, status
) values ('ts_workflow_2026_11', 'org_workflow_test', 'usr_workflow_pj', 2026, 11, 9720, 'OPEN');

insert into public.time_entries (
  id, organization_id, timesheet_id, contractor_id, work_date,
  start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
  non_business_day_status, notes, created_by, updated_by
) values (
  'entry_workflow_nov', 'org_workflow_test', 'ts_workflow_2026_11', 'usr_workflow_pj', '2026-11-01',
  '08:00', '09:00', 0, 60, 60, 'NOT_APPLICABLE', '', 'usr_workflow_pj', 'usr_workflow_pj'
);

insert into public.leave_requests (
  id, organization_id, contractor_id, start_date, end_date,
  requested_minutes, status, reason, allocation_status
) values (
  'leave_workflow_pending', 'org_workflow_test', 'usr_workflow_pj', '2026-11-10', '2026-11-10',
  60, 'REQUESTED', 'Pending', 'COMPLETE'
);

insert into public.leave_request_days (
  id, organization_id, leave_request_id, work_date, minutes, application_status
) values (
  'lrd_workflow_pending', 'org_workflow_test', 'leave_workflow_pending', '2026-11-10', 60, 'PENDING'
);

do $$
declare v_preview jsonb;
begin
  v_preview := public.preview_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 11
  );
  if v_preview->>'state' <> 'NEEDS_REVIEW'
     or not (v_preview->'blockers' @> '[{"code":"PENDING_LEAVE"}]'::jsonb) then
    raise exception 'pending leave blocker is missing: %', v_preview;
  end if;
end $$;

-- An empty month closes only through the explicit, justified exception.
do $$
declare v_preview jsonb;
begin
  v_preview := public.preview_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 12
  );
  if not (v_preview->'blockers' @> '[{"code":"NO_ENTRIES"}]'::jsonb) then
    raise exception 'empty month blocker is missing';
  end if;

  begin
    perform public.close_timesheet_v2(
      'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 12,
      v_preview->>'reviewVersion', false, null
    );
    raise exception 'empty month closed without exception';
  exception
    when others then
      if position('NO_ENTRIES' in sqlerrm) = 0 then raise; end if;
  end;

  perform public.close_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 12,
    v_preview->>'reviewVersion', true, 'Pessoa sem lançamentos no período'
  );

  if not exists (
    select 1 from public.monthly_timesheets
    where organization_id = 'org_workflow_test' and contractor_id = 'usr_workflow_pj'
      and year = 2026 and month = 12 and status = 'CLOSED'
      and closure_snapshot->'emptyMonthException'->>'reason' = 'Pessoa sem lançamentos no período'
  ) then
    raise exception 'justified empty month was not recorded';
  end if;
end $$;

-- A later balance movement must block reopening without changing anything.
do $$
declare
  v_closed_at timestamptz;
  v_preview jsonb;
  v_remaining integer;
begin
  select closed_at into v_closed_at from public.monthly_timesheets where id = 'ts_workflow_2026_9';
  insert into public.hour_balance_transactions (
    id, organization_id, contractor_id, lot_id, type, minutes,
    related_timesheet_id, description, created_by, created_at
  ) values (
    'tx_workflow_later', 'org_workflow_test', 'usr_workflow_pj', 'lot_workflow_credit',
    'ADJUSTMENT', 1, null, 'Later movement test', 'usr_workflow_rh', v_closed_at + interval '1 second'
  );

  v_preview := public.reopen_timesheet_preview_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 9
  );
  if coalesce((v_preview->>'canReopen')::boolean, true)
     or v_preview->>'code' <> 'BALANCE_ALREADY_USED' then
    raise exception 'later movement did not block reopen: %', v_preview;
  end if;

  select remaining_minutes into v_remaining from public.hour_balance_lots where id = 'lot_workflow_credit';
  begin
    perform public.reopen_timesheet_v2(
      'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2026, 9,
      'Correção necessária'
    );
    raise exception 'blocked reopen was executed';
  exception
    when others then
      if position('BALANCE_ALREADY_USED' in sqlerrm) = 0 then raise; end if;
  end;

  if (select status from public.monthly_timesheets where id = 'ts_workflow_2026_9') <> 'CLOSED'
     or (select remaining_minutes from public.hour_balance_lots where id = 'lot_workflow_credit') <> v_remaining then
    raise exception 'blocked reopen changed data';
  end if;
end $$;

-- A month without bank effects can be reopened safely.
insert into public.monthly_timesheets (
  id, organization_id, contractor_id, year, month, required_minutes, status
) values ('ts_workflow_2027_1', 'org_workflow_test', 'usr_workflow_pj', 2027, 1, 9720, 'OPEN');

insert into public.time_entries (
  id, organization_id, timesheet_id, contractor_id, work_date,
  start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
  non_business_day_status, notes, created_by, updated_by
)
select
  'entry_workflow_jan_' || day_number,
  'org_workflow_test', 'ts_workflow_2027_1', 'usr_workflow_pj', make_date(2027, 1, day_number),
  '08:00'::time, '23:59'::time, 0,
  case when day_number = 7 then 1080 else 1440 end,
  case when day_number = 7 then 1080 else 1440 end,
  'NOT_APPLICABLE', '', 'usr_workflow_pj', 'usr_workflow_pj'
from generate_series(1, 7) as day_number;

do $$
declare v_preview jsonb;
begin
  v_preview := public.preview_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2027, 1
  );
  perform public.close_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2027, 1,
    v_preview->>'reviewVersion', false, null
  );
  v_preview := public.reopen_timesheet_preview_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2027, 1
  );
  if not coalesce((v_preview->>'canReopen')::boolean, false) then
    raise exception 'safe reopen preview was blocked: %', v_preview;
  end if;
  perform public.reopen_timesheet_v2(
    'org_workflow_test', 'usr_workflow_rh', 'usr_workflow_pj', 2027, 1,
    'Ajuste solicitado pelo RH'
  );
  if (select status from public.monthly_timesheets where id = 'ts_workflow_2027_1') <> 'REOPENED' then
    raise exception 'safe reopen did not complete';
  end if;
end $$;

-- Occurrence and non-business authorization decisions must update calculation and audit atomically.
insert into public.occurrences (
  id, organization_id, contractor_id, type, start_date, end_date, minutes,
  calculation_effect, status, description, created_by, updated_by, allocation_status
) values (
  'occ_workflow_decision', 'org_workflow_test', 'usr_workflow_pj', 'MEDICAL_CERTIFICATE',
  '2027-02-01', '2027-02-01', 60, 'CREDITS_HOURS', 'REQUESTED', 'Test',
  'usr_workflow_pj', 'usr_workflow_pj', 'COMPLETE'
);
insert into public.occurrence_days (
  id, organization_id, occurrence_id, work_date, minutes
) values ('ocd_workflow_decision', 'org_workflow_test', 'occ_workflow_decision', '2027-02-01', 60);

insert into public.monthly_timesheets (
  id, organization_id, contractor_id, year, month, required_minutes, status
) values ('ts_workflow_2027_3', 'org_workflow_test', 'usr_workflow_pj', 2027, 3, 9720, 'OPEN');
insert into public.time_entries (
  id, organization_id, timesheet_id, contractor_id, work_date,
  start_time, end_time, break_minutes, calculated_minutes, eligible_minutes,
  non_business_day_status, notes, created_by, updated_by
) values (
  'entry_workflow_auth', 'org_workflow_test', 'ts_workflow_2027_3', 'usr_workflow_pj', '2027-03-06',
  '08:00', '10:00', 0, 120, 0, 'PENDING_AUTHORIZATION', '', 'usr_workflow_pj', 'usr_workflow_pj'
);
insert into public.non_business_day_authorizations (
  id, organization_id, contractor_id, work_date, estimated_minutes, reason, status
) values (
  'auth_workflow_decision', 'org_workflow_test', 'usr_workflow_pj', '2027-03-06', 120, 'Test', 'REQUESTED'
);

do $$
begin
  perform public.decide_occurrence_v2(
    'org_workflow_test', 'usr_workflow_rh', 'occ_workflow_decision', 'APPROVE', 'Documento conferido'
  );
  if (select status from public.occurrences where id = 'occ_workflow_decision') <> 'APPROVED' then
    raise exception 'occurrence decision failed';
  end if;

  perform public.decide_non_business_authorization_v2(
    'org_workflow_test', 'usr_workflow_rh', 'auth_workflow_decision', 'APPROVE', 90, 'Aprovado parcialmente'
  );
  if not exists (
    select 1 from public.time_entries
    where id = 'entry_workflow_auth' and eligible_minutes = 90 and non_business_day_status = 'AUTHORIZED'
  ) then
    raise exception 'authorization decision did not update the entry atomically';
  end if;
end $$;

-- Request creation writes parent, daily allocation and audit in one operation.
do $$
declare
  v_result jsonb;
begin
  v_result := public.create_leave_request_v2(
    'org_workflow_test', 'usr_workflow_pj', 'usr_workflow_pj',
    '2027-04-10', '2027-04-11', 120, 'Descanso programado',
    '[{"date":"2027-04-10","minutes":60},{"date":"2027-04-11","minutes":60}]'::jsonb
  );
  if not exists (
    select 1 from public.leave_requests request
    where request.id = v_result->>'id' and request.allocation_status = 'COMPLETE'
      and request.status = 'REQUESTED'
      and (select sum(minutes) from public.leave_request_days where leave_request_id = request.id) = 120
  ) then
    raise exception 'atomic leave creation failed';
  end if;

  v_result := public.create_occurrence_v2(
    'org_workflow_test', 'usr_workflow_pj', 'usr_workflow_pj', 'MEDICAL_CERTIFICATE',
    '2027-04-12', '2027-04-12', 90, 'CREDITS_HOURS', 'Consulta médica',
    '[{"date":"2027-04-12","minutes":90}]'::jsonb
  );
  if not exists (
    select 1 from public.occurrences occurrence
    where occurrence.id = v_result->>'id' and occurrence.allocation_status = 'COMPLETE'
      and (select sum(minutes) from public.occurrence_days where occurrence_id = occurrence.id) = 90
  ) then
    raise exception 'atomic occurrence creation failed';
  end if;

  v_result := public.create_non_business_authorization_v2(
    'org_workflow_test', 'usr_workflow_pj', 'usr_workflow_pj',
    '2027-04-17', 120, 'Atividade excepcional'
  );
  if not exists (
    select 1 from public.non_business_day_authorizations
    where id = v_result->>'id' and status = 'REQUESTED'
  ) then
    raise exception 'atomic authorization creation failed';
  end if;
end $$;

rollback;

select 'PASS' as workflow_test;

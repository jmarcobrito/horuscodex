-- Synthetic data only; runner creates a new empty local cluster first.
insert into public.organizations(id,name,timezone) values
 ('release-block-org','Fictícia bloqueia vencidos','America/Sao_Paulo'),
 ('release-allow-org','Fictícia permite vencidos','America/Sao_Paulo');
insert into public.organization_policies(id,organization_id,monthly_required_minutes,positive_balance_after_deadline_policy,minimum_leave_notice_days)
 values ('release-block-policy','release-block-org',60,'BLOCK_AFTER_DEADLINE',0),
 ('release-allow-policy','release-allow-org',60,'ALLOW_AFTER_DEADLINE',0);
insert into public.users(id,organization_id,name,email,role) values
 ('release-block-rh','release-block-org','RH fictício','block-rh@example.com','RH'),
 ('release-allow-rh','release-allow-org','RH fictício','allow-rh@example.com','RH');
insert into public.users(id,organization_id,name,email,role)
select id,case when id like 'release-allow%' then 'release-allow-org' else 'release-block-org' end,id,id||'@example.com','PJ'
from unnest(array['release-block-close','release-allow-close','release-block-leave','release-allow-leave','release-block-reserved','release-block-create']) id;
insert into public.monthly_timesheets(id,organization_id,contractor_id,year,month,required_minutes)
select 'ts_'||id||'_2026_8',organization_id,id,2026,8,60 from public.users where id in ('release-block-close','release-allow-close');
insert into public.monthly_timesheets(id,organization_id,contractor_id,year,month,required_minutes,worked_minutes,considered_minutes,calculated_balance_minutes,status)
select 'ts_'||id||'_2026_4',organization_id,id,2026,4,0,60,60,60,'CLOSED'
from public.users where id in ('release-block-close','release-allow-close','release-block-leave','release-allow-leave','release-block-reserved');
insert into public.hour_balance_lots(id,organization_id,contractor_id,origin_timesheet_id,type,original_minutes,remaining_minutes,reserved_minutes,origin_date,deadline_date,status)
select 'lot-'||id,organization_id,id,'ts_'||id||'_2026_4','CREDIT',
 case when id='release-block-reserved' then 120 else 60 end,
 case when id='release-block-reserved' then 120 else 60 end,
 case when id='release-block-reserved' then 60 else 0 end,
 ((now() at time zone 'America/Sao_Paulo')::date-150),
 ((now() at time zone 'America/Sao_Paulo')::date-1),
 case when id='release-block-reserved' then 'RESERVED' when id like 'release-allow%' then 'EXPIRED' else 'AVAILABLE' end
from public.users where id in ('release-block-close','release-allow-close','release-block-leave','release-allow-leave','release-block-reserved');
insert into public.leave_requests(id,organization_id,contractor_id,start_date,end_date,requested_minutes,reserved_minutes,status,reason)
select 'leave-'||id,organization_id,id,current_date+14,current_date+14,60,
 case when id='release-block-reserved' then 60 else 0 end,
 case when id='release-block-reserved' then 'APPROVED' else 'REQUESTED' end,'Folga fictícia'
from public.users where id in ('release-block-leave','release-allow-leave','release-block-reserved');
insert into public.leave_request_reservations(id,organization_id,leave_request_id,lot_id,minutes)
values ('release-reservation','release-block-org','leave-release-block-reserved','lot-release-block-reserved',60);

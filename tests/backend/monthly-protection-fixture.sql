-- Only used by the runner after it creates a brand-new local cluster.
insert into public.users(id,organization_id,name,email,role)
select id,'test-org',id,id||'@example.com','PJ'
from unnest(array['test-decision','test-atomic','test-occurrence','test-overlap','test-historical','test-new','test-edit-first','test-auth-race','test-occ-race','test-auth-approve-race','test-occ-approve-race']) id;
insert into public.monthly_timesheets(id,organization_id,contractor_id,year,month,required_minutes)
select 'ts_'||id||'_2026_8','test-org',id,2026,8,480
from public.users where id like 'test-%' and id not in ('test-rh','test-new')
on conflict do nothing;
insert into public.time_entries(id,organization_id,timesheet_id,contractor_id,work_date,start_time,end_time,
 break_minutes,calculated_minutes,eligible_minutes,non_business_day_status,created_by,updated_by)
select 'entry-'||id,'test-org','ts_'||id||'_2026_8',id,'2026-08-09','08:00','17:00',60,480,0,'PENDING_AUTHORIZATION','test-rh','test-rh'
from public.users where id in ('test-decision','test-atomic','test-historical','test-auth-approve-race');
insert into public.non_business_day_authorizations(id,organization_id,contractor_id,work_date,estimated_minutes,reason)
select 'auth-'||id,'test-org',id,'2026-08-09',480,'Autorização fictícia'
from public.users where id in ('test-decision','test-atomic','test-historical','test-auth-approve-race');
-- Historical closed fixture intentionally predates installation of protections.
update public.monthly_timesheets set status='CLOSED',considered_minutes=480,closure_snapshot='{"consideredMinutes":480}' where contractor_id='test-historical';
insert into public.occurrences(id,organization_id,contractor_id,type,start_date,end_date,minutes,calculation_effect,description,created_by,updated_by)
values ('occ-overlap','test-org','test-overlap','OTHER','2026-07-31','2026-08-02',60,'CREDITS_HOURS','Ocorrência fictícia','test-rh','test-rh');
insert into public.occurrences(id,organization_id,contractor_id,type,start_date,end_date,minutes,calculation_effect,description,created_by,updated_by)
values ('occ-historical','test-org','test-historical','OTHER','2026-07-31','2026-08-02',60,'CREDITS_HOURS','Ocorrência histórica fictícia','test-rh','test-rh');
insert into public.occurrences(id,organization_id,contractor_id,type,start_date,end_date,minutes,calculation_effect,description,created_by,updated_by)
values ('occ-race-pending','test-org','test-occ-approve-race','OTHER','2026-08-03','2026-08-03',60,'CREDITS_HOURS','Ocorrência fictícia','test-rh','test-rh');
insert into public.organizations(id,name) values ('other-test-org','Outra empresa fictícia');
insert into public.users(id,organization_id,name,email,role) values ('other-test-rh','other-test-org','Outro RH fictício','other@example.com','RH');

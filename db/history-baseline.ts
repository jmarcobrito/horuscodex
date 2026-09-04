export function historyBaselineSql() {
  return `begin transaction read only;

select 'time_entries'::text as dataset,
       count(*)::bigint as row_count,
       coalesce(sum(calculated_minutes), 0)::bigint as metric_a,
       coalesce(sum(eligible_minutes), 0)::bigint as metric_b,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), '')) as signature
from public.time_entries as t
union all
select 'time_entry_versions', count(*), 0, 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.time_entry_versions as t
union all
select 'monthly_timesheets', count(*),
       coalesce(sum(required_minutes), 0), coalesce(sum(considered_minutes), 0),
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.monthly_timesheets as t
union all
select 'hour_balance_lots', count(*),
       coalesce(sum(original_minutes), 0), coalesce(sum(remaining_minutes), 0),
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.hour_balance_lots as t
union all
select 'hour_balance_transactions', count(*),
       coalesce(sum(minutes), 0), 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.hour_balance_transactions as t
union all
select 'leave_requests', count(*),
       coalesce(sum(requested_minutes), 0), coalesce(sum(reserved_minutes), 0),
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.leave_requests as t
union all
select 'occurrences', count(*),
       coalesce(sum(minutes), 0), 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.occurrences as t
union all
select 'non_business_day_authorizations', count(*),
       coalesce(sum(estimated_minutes), 0), coalesce(sum(approved_minutes), 0),
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.non_business_day_authorizations as t
union all
select 'leave_request_reservations', count(*),
       coalesce(sum(minutes), 0), 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.leave_request_reservations as t
union all
select 'audit_logs', count(*), 0, 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.audit_logs as t
order by dataset;

rollback;`;
}

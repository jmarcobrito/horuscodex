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
select 'audit_logs', count(*), 0, 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.audit_logs as t
order by dataset;

rollback;`;
}

import assert from "node:assert/strict";
export async function verifyRelease({query,probe,fullSnapshot}) {
  const service=sql=>query("set role service_role; "+sql);
  const rejectUnchanged=(sql,pattern)=>{const before=fullSnapshot();assert.throws(()=>service(sql),pattern);assert.equal(fullSnapshot(),before);};
  await probe("leave RPC remains service-only with safe search path and actor validation",()=>{
    assert.equal(query("select proconfig::text||':'||prosecdef from pg_proc where oid='public.create_leave_request(text,text,text,date,date,integer,text)'::regprocedure"),'{"search_path=\\"\\""}:false');
    for(const role of ['anon','authenticated']) {
      assert.equal(query(`select has_function_privilege('${role}','public.create_leave_request(text,text,text,date,date,integer,text)','execute')`),'f');
    }
    rejectUnchanged("select public.create_leave_request('release-block-org','release-block-create','release-block-leave',current_date+14,current_date+14,60,'Fictício')",/Forbidden/);
  });
  await probe("editing an approved day retains the approved minute ceiling",()=>{
    service("select * from public.save_time_entry('test-org','test-rh','test-decision','2026-08-09','08:00','17:00',60,480,'Texto corrigido','Conferência fictícia')");
    assert.equal(query("select eligible_minutes from public.time_entries where id='entry-test-decision'"),"240");
    assert.equal(query("select considered_minutes from public.monthly_timesheets where id='ts_test-decision_2026_8'"),"240");
  });
  await probe("editing a rejected non-business day cannot restore eligible hours or create a pending approval",()=>{
    service("select public.decide_non_business_authorization('test-org','test-rh','auth-test-atomic','REJECT',null,'Recusado')");
    service("select * from public.save_time_entry('test-org','test-rh','test-atomic','2026-08-09','08:00','17:00',60,480,'Texto corrigido','Conferência fictícia')");
    assert.equal(query("select eligible_minutes||':'||non_business_day_status from public.time_entries where id='entry-test-atomic'"),"0:REJECTED");
  });
  await probe("closing cannot spend expired credit under blocking policy even without a dashboard visit",()=>{
    service("select public.close_timesheet('release-block-org','release-block-rh','ts_release-block-close_2026_8')");
    assert.equal(query("select remaining_minutes from public.hour_balance_lots where id='lot-release-block-close'"),"60");
    assert.equal(query("select remaining_minutes from public.hour_balance_lots where origin_timesheet_id='ts_release-block-close_2026_8' and type='DEBIT'"),"60");
  });
  await probe("closing uses overdue credit under allow policy even with a stale EXPIRED label",()=>{
    service("select public.close_timesheet('release-allow-org','release-allow-rh','ts_release-allow-close_2026_8')");
    assert.equal(query("select remaining_minutes from public.hour_balance_lots where id='lot-release-allow-close'"),"0");
    assert.equal(query("select count(*) from public.hour_balance_lots where origin_timesheet_id='ts_release-allow-close_2026_8' and type='DEBIT'"),"0");
  });
  await probe("new leave approval rejects expired credit atomically under blocking policy",()=>{
    rejectUnchanged("select public.decide_leave_request('release-block-org','release-block-rh','leave-release-block-leave','APPROVE','Fictício')",/Insufficient credit/);
  });
  await probe("new leave approval accepts overdue credit under allow policy without a prior refresh",()=>{
    service("select public.decide_leave_request('release-allow-org','release-allow-rh','leave-release-allow-leave','APPROVE','Fictício')");
    assert.equal(query("select reserved_minutes from public.hour_balance_lots where id='lot-release-allow-leave'"),"60");
  });
  await probe("a previously granted reservation remains usable after deadline and keeps the remaining history",()=>{
    service("select public.decide_leave_request('release-block-org','release-block-rh','leave-release-block-reserved','UTILIZE','Fictício')");
    assert.equal(query("select remaining_minutes||':'||reserved_minutes from public.hour_balance_lots where id='lot-release-block-reserved'"),"60:0");
    assert.equal(query("select status from public.leave_requests where id='leave-release-block-reserved'"),"UTILIZED");
  });
  await probe("leave decisions enforce actor scope in the database",()=>{
    rejectUnchanged("select public.decide_leave_request('release-block-org','release-block-create','leave-release-block-leave','APPROVE','Fictício')",/Forbidden/);
  });
  await probe("legacy dashboard refresh no longer rewrites stored lots",()=>{
    const before=fullSnapshot();service("select public.refresh_hour_balance_statuses('release-block-org')");
    assert.equal(fullSnapshot(),before);
  });
  await probe("leave creation and audit succeed or roll back together",()=>{
    query("create function public.test_fail_leave_create() returns trigger language plpgsql as $$ begin if new.action='LEAVE_REQUEST_CREATED' then raise exception 'Injected leave audit failure'; end if; return new; end $$; create trigger test_fail_leave_create before insert on public.audit_logs for each row execute function public.test_fail_leave_create();");
    const call="select public.create_leave_request('release-block-org','release-block-create','release-block-create',current_date+14,current_date+14,60,'Folga fictícia')";
    try{rejectUnchanged(call,/Injected leave audit failure/);}
    finally{query("drop trigger test_fail_leave_create on public.audit_logs; drop function public.test_fail_leave_create();");}
    const result=JSON.parse(service(call));assert.equal(result.status,"REQUESTED");
    assert.equal(query(`select count(*) from public.audit_logs where entity_id='${result.id}' and action='LEAVE_REQUEST_CREATED'`),"1");
  });
}

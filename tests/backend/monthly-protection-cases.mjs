import assert from "node:assert/strict";
import { spawn } from "node:child_process";

export async function verifyMonthlyProtection({ query, probe, fullSnapshot, exe, connection, env }) {
  const service = sql => query("set role service_role; " + sql);
  const close = id => service(`select public.close_timesheet('test-org','test-rh','ts_${id}_2026_8')`);
  const decision = (id, minutes = 240) => service(`select public.decide_non_business_authorization('test-org','test-rh','auth-${id}','APPROVE',${minutes},'Conferência fictícia')`);
  const unchangedRejection = (fn, pattern) => { const before = fullSnapshot(); assert.throws(fn, pattern); assert.equal(fullSnapshot(), before); };
  const interleave = async (firstSql, secondSql) => {
    const start = name => {
      const child = spawn(exe("psql"), connection, { env: { ...env, PGAPPNAME: name }, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      const processResult = { child, output: "", error: "" };
      child.stdout.on("data", b => { processResult.output += b; });
      child.stderr.on("data", b => { processResult.error += b; });
      processResult.done = new Promise(resolve => {
        child.on("error", error => resolve({ code: 1, error: String(error) }));
        child.on("exit", code => resolve({ code, error: processResult.error }));
      });
      return processResult;
    };
    const until = async condition => {
      for (let i = 0; i < 50; i++) {
        if (condition()) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw Error("Synthetic transaction synchronization failed");
    };
    const first = start("horus-protection-first");
    let second;
    try {
      first.child.stdin.write("set role service_role; begin; " + firstSql + "; select 'FIRST_PREPARED';\n");
      await until(() => first.output.includes("FIRST_PREPARED"));
      second = start("horus-protection-second");
      second.child.stdin.end("set role service_role; " + secondSql + ";\n");
      await until(() => query("select count(*) from pg_stat_activity where application_name='horus-protection-second' and wait_event_type='Lock'") === "1");
      first.child.stdin.end("commit;\n");
      assert.equal((await first.done).code, 0, first.error);
      return await second.done;
    } finally {
      if (!first.child.stdin.destroyed) first.child.stdin.end("rollback;\n");
      await first.done;
      if (second) await second.done;
    }
  };

  await probe("needs-adjustment authorization blocks closing without changing history", () => {
    query("update public.non_business_day_authorizations set status='NEEDS_ADJUSTMENT' where id='pending-auth'");
    unchangedRejection(() => close("test-pending"), /Pending/);
  });
  await probe("an occurrence spanning into the month blocks closing", () => unchangedRejection(() => close("test-overlap"), /Pending occurrence/));
  await probe("closed month rejects recalculation and direct daily writes", () => {
    for (const sql of ["select public.recalculate_timesheet('ts_test-a_2026_8')", "update public.time_entries set eligible_minutes=60 where id='entry-test-a'", "delete from public.time_entries where id='entry-test-a'"]) unchangedRejection(() => service(sql), /closed/i);
  });
  await probe("atomic authorization preserves clock times and creates one immutable version", () => {
    const previous = JSON.parse(query("select to_jsonb(e) from public.time_entries e where id='entry-test-decision'"));
    assert.equal(JSON.parse(decision("test-decision")).status, "RETROACTIVELY_APPROVED");
    const current = JSON.parse(query("select to_jsonb(e) from public.time_entries e where id='entry-test-decision'"));
    for (const field of ["id","contractor_id","timesheet_id","work_date","start_time","end_time","break_minutes","calculated_minutes","notes","created_at","created_by"]) assert.deepEqual(current[field], previous[field]);
    assert.equal(current.eligible_minutes, 240);
    const version = JSON.parse(query("select jsonb_build_object('previous',previous_data,'new',new_data,'actor',changed_by) from public.time_entry_versions where time_entry_id='entry-test-decision'"));
    assert.deepEqual(version, { previous, new: current, actor: "test-rh" });
    assert.equal(query("select considered_minutes from public.monthly_timesheets where contractor_id='test-decision'"), "240");
    unchangedRejection(() => decision("test-decision"), /not pending/i);
  });
  await probe("authorization audit failure rolls back decision, day, version and monthly total", () => {
    query("create function public.test_fail_decision() returns trigger language plpgsql as $$ begin if new.action='NON_BUSINESS_AUTH_APPROVE' then raise exception 'Injected approval failure'; end if; return new; end $$; create trigger test_fail_decision before insert on public.audit_logs for each row execute function public.test_fail_decision();");
    try { unchangedRejection(() => decision("test-atomic"), /Injected approval failure/); }
    finally { query("drop trigger test_fail_decision on public.audit_logs; drop function public.test_fail_decision();"); }
  });
  await probe("historical closed month blocks atomic approval before any write", () => unchangedRejection(() => decision("test-historical"), /closed/i));
  await probe("invalid approval minutes and foreign actors cannot write", () => {
    for (const minutes of [-1, 0, 1441]) unchangedRejection(() => decision("test-atomic", minutes), /Invalid/);
    unchangedRejection(() => service("select public.decide_non_business_authorization('test-org','test-decision','auth-test-atomic','APPROVE',60,'')"), /Forbidden/);
    unchangedRejection(() => service("select public.decide_non_business_authorization('test-org','other-test-rh','auth-test-atomic','APPROVE',60,'')"), /Forbidden/);
    unchangedRejection(() => service("select public.close_timesheet('test-org','test-decision','ts_test-atomic_2026_8')"), /Forbidden/);
  });
  await probe("authorization request preserves identity and cannot overwrite an approval", () => {
    const request = () => JSON.parse(service("select public.request_non_business_authorization('test-org','test-new','test-new','2026-08-09',60,'Pedido fictício')"));
    const first = request(); assert.equal(first.status, "REQUESTED"); assert.equal(request().id, first.id);
    assert.equal(query("select count(*) from public.monthly_timesheets where contractor_id='test-new'"), "0");
    service(`select public.decide_non_business_authorization('test-org','test-rh','${first.id}','APPROVE',60,'Aprovado')`);
    unchangedRejection(request, /not pending/i);
    unchangedRejection(() => service("select public.request_non_business_authorization('test-org','test-rh','test-a','2026-08-10',60,'Pedido')"), /closed/i);
  });
  await probe("occurrence decision is atomic and prevents touching a closed overlapping month", () => {
    const row = JSON.parse(service("select public.create_occurrence('test-org','test-occurrence','test-occurrence','MEDICAL_CERTIFICATE','2026-08-03','2026-08-03',60,'CONSUMES_BALANCE','Atestado fictício')"));
    assert.equal(row.status, "REQUESTED");
    assert.equal(query(`select calculation_effect from public.occurrences where id='${row.id}'`), "CREDITS_HOURS");
    assert.equal(JSON.parse(service(`select public.decide_occurrence('test-org','test-rh','${row.id}','APPROVE','Conferido')`)).status, "APPROVED");
    assert.equal(query("select credited_minutes from public.monthly_timesheets where contractor_id='test-occurrence'"), "60");
    close("test-occurrence");
    unchangedRejection(() => service("select public.create_occurrence('test-org','test-rh','test-occurrence','OTHER','2026-07-31','2026-08-02',60,'CREDITS_HOURS','Cruza mês fechado')"), /closed/i);
  });
  await probe("occurrence audit failure leaves no partial occurrence or calculation", () => {
    query("create function public.test_fail_occurrence() returns trigger language plpgsql as $$ begin if new.action like 'OCCURRENCE_%' then raise exception 'Injected occurrence failure'; end if; return new; end $$; create trigger test_fail_occurrence before insert on public.audit_logs for each row execute function public.test_fail_occurrence();");
    try { unchangedRejection(() => service("select public.create_occurrence('test-org','test-rh','test-atomic','OTHER','2026-08-03','2026-08-03',60,'CREDITS_HOURS','Fictício')"), /Injected occurrence failure/); }
    finally { query("drop trigger test_fail_occurrence on public.audit_logs; drop function public.test_fail_occurrence();"); }
  });
  await probe("new RPCs are not executable by public anonymous or authenticated roles", () => {
    assert.equal(query("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('request_non_business_authorization','decide_non_business_authorization','create_occurrence','decide_occurrence')"), "4");
    for (const role of ["anon", "authenticated"]) unchangedRejection(() => query(`set role ${role}; select public.request_non_business_authorization('test-org','test-new','test-new','2026-08-09',60,'x')`), /permission denied/i);
    assert.equal(query("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('request_non_business_authorization','decide_non_business_authorization','create_occurrence','decide_occurrence') and (p.prosecdef or not coalesce(p.proconfig @> array['search_path=\"\"'], false))"), "0");
    for (const name of ["lock_monthly_workflow","assert_open_months","assert_monthly_actor","protect_monthly_source","request_non_business_authorization","decide_non_business_authorization","create_occurrence","decide_occurrence","recalculate_timesheet","save_time_entry","close_timesheet","reopen_timesheet"]) {
      assert.equal(query(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='${name}' and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE') and has_function_privilege('service_role',p.oid,'EXECUTE')`), "1", name);
    }
  });
  await probe("authorization request audit failure rolls back without creating a month", () => {
    query("create function public.test_fail_request() returns trigger language plpgsql as $$ begin if new.action='NON_BUSINESS_AUTH_REQUESTED' then raise exception 'Injected request failure'; end if; return new; end $$; create trigger test_fail_request before insert on public.audit_logs for each row execute function public.test_fail_request();");
    try { unchangedRejection(() => service("select public.request_non_business_authorization('test-org','test-new','test-new','2026-10-04',60,'Pedido fictício')"), /Injected request failure/); }
    finally { query("drop trigger test_fail_request on public.audit_logs; drop function public.test_fail_request();"); }
    assert.equal(query("select count(*) from public.monthly_timesheets where contractor_id='test-new'"), "0");
  });
  await probe("occurrence approval audit failure also rolls back the existing request", () => {
    query("create function public.test_fail_occ_decision() returns trigger language plpgsql as $$ begin if new.action='OCCURRENCE_APPROVE' then raise exception 'Injected occurrence decision failure'; end if; return new; end $$; create trigger test_fail_occ_decision before insert on public.audit_logs for each row execute function public.test_fail_occ_decision();");
    try { unchangedRejection(() => service("select public.decide_occurrence('test-org','test-rh','occ-overlap','APPROVE','Conferido')"), /Injected occurrence decision failure/); }
    finally { query("drop trigger test_fail_occ_decision on public.audit_logs; drop function public.test_fail_occ_decision();"); }
  });
  await probe("a person can cancel their own pending occurrence but not another person's", () => {
    unchangedRejection(() => service("select public.decide_occurrence('test-org','test-new','occ-overlap','CANCEL','Cancelado')"), /Forbidden/);
    assert.equal(JSON.parse(service("select public.decide_occurrence('test-org','test-overlap','occ-overlap','CANCEL','Cancelado')")).status, "CANCELLED");
    unchangedRejection(() => service("select public.decide_occurrence('test-org','test-rh','occ-overlap','APPROVE','Conferido')"), /not pending/i);
  });
  await probe("closed historical occurrence, direct authorization delete and identity moves are rejected", () => {
    unchangedRejection(() => service("select public.decide_occurrence('test-org','test-rh','occ-historical','APPROVE','Conferido')"), /closed/i);
    unchangedRejection(() => service("delete from public.non_business_day_authorizations where id='auth-test-historical'"), /closed/i);
    unchangedRejection(() => service("update public.time_entries set contractor_id='test-new' where id='entry-test-atomic'"), /Invalid record identity/);
    unchangedRejection(() => service("select public.request_non_business_authorization('test-org','test-new','test-new','1999-12-31',60,'Pedido')"), /Invalid period/);
  });
  await probe("explicit RH reopening keeps all days and previous versions intact", () => {
    const dailySnapshot = () => query("select jsonb_build_object('entries',(select jsonb_agg(to_jsonb(e) order by id) from public.time_entries e),'versions',(select jsonb_agg(to_jsonb(v) order by id) from public.time_entry_versions v))");
    unchangedRejection(() => service("select public.reopen_timesheet('test-org','test-new','ts_test-b_2026_8','Motivo válido')"), /Forbidden/);
    const previous = dailySnapshot();
    assert.equal(service("select public.reopen_timesheet('test-org','test-rh','ts_test-b_2026_8','Conferência do RH')"), "ts_test-b_2026_8");
    assert.equal(query("select status from public.monthly_timesheets where id='ts_test-b_2026_8'"), "REOPENED");
    assert.equal(dailySnapshot(), previous);
    service("select * from public.save_time_entry('test-org','test-rh','test-b','2026-08-03','08:00','18:00',60,540,'Correção fictícia','Reabertura autorizada')");
    assert.equal(query("select considered_minutes from public.monthly_timesheets where id='ts_test-b_2026_8'"), "540");
    close("test-b");
    assert.equal(query("select closure_version from public.monthly_timesheets where id='ts_test-b_2026_8'"), "2");
  });
  await probe("closing committed first rejects simultaneous authorization and occurrence creation", async () => {
    for (const [person, sql, table] of [
      ["test-auth-race", "select public.request_non_business_authorization('test-org','test-rh','test-auth-race','2026-08-09',60,'Pedido')", "non_business_day_authorizations"],
      ["test-occ-race", "select public.create_occurrence('test-org','test-rh','test-occ-race','OTHER','2026-07-31','2026-08-03',60,'CREDITS_HOURS','Ocorrencia')", "occurrences"],
    ]) {
      const result = await interleave(`select public.close_timesheet('test-org','test-rh','ts_${person}_2026_8')`, sql);
      assert.notEqual(result.code, 0); assert.match(result.error, /closed/i);
      assert.equal(query(`select count(*) from public.${table} where contractor_id='${person}'`), "0");
      assert.equal(query(`select considered_minutes = (closure_snapshot->>'consideredMinutes')::integer from public.monthly_timesheets where contractor_id='${person}'`), "t");
    }
  });
  await probe("approval committed first is included by simultaneous closing for authorization and occurrence", async () => {
    for (const [person, sql, minutes] of [
      ["test-auth-approve-race", "select public.decide_non_business_authorization('test-org','test-rh','auth-test-auth-approve-race','APPROVE',240,'Conferido')", "240"],
      ["test-occ-approve-race", "select public.decide_occurrence('test-org','test-rh','occ-race-pending','APPROVE','Conferido')", "60"],
    ]) {
      const result = await interleave(sql, `select public.close_timesheet('test-org','test-rh','ts_${person}_2026_8')`);
      assert.equal(result.code, 0, result.error);
      assert.equal(query(`select closure_snapshot->>'consideredMinutes' from public.monthly_timesheets where contractor_id='${person}'`), minutes);
    }
  });
  await probe("an edit committed first is included in the subsequent closing snapshot", async () => {
    const start = (name, sql) => {
      const child = spawn(exe("psql"), sql ? [...connection,"-c",sql] : connection, {env:{...env,PGAPPNAME:name},windowsHide:true,stdio:["pipe","pipe","pipe"]});
      const result={ child, output:"", error:"" }; child.stdout.on("data",b=>result.output+=b); child.stderr.on("data",b=>result.error+=b);
      result.done=new Promise(resolve=>{child.on("error",e=>resolve({code:1,error:String(e)}));child.on("exit",code=>resolve({code,error:result.error}));}); return result;
    };
    const until = async fn => { for(let i=0;i<50;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error("Local transaction synchronization failed"); };
    const editor=start("horus-edit-first"); let closer;
    try {
      editor.child.stdin.write("begin; select * from public.save_time_entry('test-org','test-rh','test-edit-first','2026-08-03','08:00','18:00',60,540,'Dia fictício','Correção fictícia'); select 'EDIT_SAVED';\n");
      await until(()=>editor.output.includes("EDIT_SAVED"));
      closer=start("horus-close-after-edit","select public.close_timesheet('test-org','test-rh','ts_test-edit-first_2026_8')");
      await until(()=>query("select count(*) from pg_stat_activity where application_name='horus-close-after-edit' and wait_event_type='Lock'")==="1");
      editor.child.stdin.end("commit;\n");
      assert.equal((await editor.done).code,0); assert.equal((await closer.done).code,0);
      assert.equal(query("select (closure_snapshot->>'consideredMinutes')::integer from public.monthly_timesheets where contractor_id='test-edit-first'"),"540");
    } finally { if(!editor.child.stdin.destroyed)editor.child.stdin.end("rollback;\n");await editor.done;if(closer)await closer.done; }
  });
}

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { historyCategory } from "../../app/reports/report-language.ts";
import { historyBaselineSql } from "../../db/history-baseline.ts";
import { buildSafeEnv } from "../../scripts/verify-workflow-isolated.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrations = join(root, "supabase", "migrations");
const requiredExecutables = ["initdb", "pg_ctl", "postgres", "psql"];
const executable = (bin, name) => join(bin, name + (process.platform === "win32" ? ".exe" : ""));

function findPostgresBin() {
  const configured = [process.env.HORUS_TEST_POSTGRES_BIN, process.env.POSTGRES_BIN, process.env.PG_BIN]
    .filter(Boolean);
  const temporary = readdirSync(tmpdir(), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith("horus-postgres-tests-"))
    .map(entry => join(tmpdir(), entry.name, "pgsql", "bin"));
  const common = process.platform === "win32"
    ? ["17", "16", "15"].map(version => join("C:\\Program Files\\PostgreSQL", version, "bin"))
    : ["/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/local/bin", "/usr/bin"];
  return [...configured, ...temporary, ...common]
    .find(bin => requiredExecutables.every(name => existsSync(executable(bin, name))));
}

const preservationFixture = `
insert into public.organizations(id,name,timezone)
values ('report-preserve-org','Organização fictícia preservada','America/Sao_Paulo');
insert into public.organization_policies(id,organization_id,monthly_required_minutes)
values ('report-preserve-policy','report-preserve-org',60);
insert into public.users(id,organization_id,name,email,role)
values ('report-preserve-user','report-preserve-org','Pessoa preservada','report-preserve@example.com','PJ');
insert into public.monthly_timesheets(id,organization_id,contractor_id,year,month,required_minutes)
values ('report-preserve-timesheet','report-preserve-org','report-preserve-user',2026,8,60);
insert into public.time_entries(
  id,organization_id,timesheet_id,contractor_id,work_date,start_time,end_time,
  break_minutes,calculated_minutes,eligible_minutes,notes,created_by,updated_by
) values (
  'report-preserve-entry','report-preserve-org','report-preserve-timesheet','report-preserve-user',
  '2026-08-03','08:00','09:00',0,60,60,'Preservação fictícia','report-preserve-user','report-preserve-user'
);
insert into public.time_entry_versions(
  id,time_entry_id,version_number,previous_data,new_data,changed_by
) values (
  'report-preserve-version','report-preserve-entry',1,'{}'::jsonb,'{"eligible_minutes":60}'::jsonb,'report-preserve-user'
);
insert into public.hour_balance_lots(
  id,organization_id,contractor_id,origin_timesheet_id,type,original_minutes,
  remaining_minutes,reserved_minutes,origin_date,deadline_date,status
) values (
  'report-preserve-lot','report-preserve-org','report-preserve-user','report-preserve-timesheet',
  'CREDIT',60,60,30,'2026-08-31','2026-11-29','RESERVED'
);
insert into public.leave_requests(
  id,organization_id,contractor_id,start_date,end_date,requested_minutes,reserved_minutes,status,reason
) values (
  'report-preserve-leave','report-preserve-org','report-preserve-user','2026-09-01','2026-09-01',
  30,30,'APPROVED','Folga fictícia preservada'
);
insert into public.leave_request_reservations(id,organization_id,leave_request_id,lot_id,minutes)
values ('report-preserve-reservation','report-preserve-org','report-preserve-leave','report-preserve-lot',30);
insert into public.hour_balance_transactions(
  id,organization_id,contractor_id,lot_id,type,minutes,related_leave_request_id,description,created_by
) values (
  'report-preserve-transaction','report-preserve-org','report-preserve-user','report-preserve-lot',
  'RESERVATION',30,'report-preserve-leave','Reserva fictícia preservada','report-preserve-user'
);
insert into public.occurrences(
  id,organization_id,contractor_id,type,start_date,end_date,minutes,calculation_effect,status,
  description,created_by,updated_by
) values (
  'report-preserve-occurrence','report-preserve-org','report-preserve-user','OTHER','2026-08-04','2026-08-04',
  30,'CREDITS_HOURS','REQUESTED','Ocorrência fictícia preservada','report-preserve-user','report-preserve-user'
);
insert into public.non_business_day_authorizations(
  id,organization_id,contractor_id,work_date,estimated_minutes,reason,status
) values (
  'report-preserve-authorization','report-preserve-org','report-preserve-user','2026-08-09',
  30,'Autorização fictícia preservada','REQUESTED'
);
insert into public.audit_logs(
  id,organization_id,user_id,action,entity_type,entity_id,reason
) values (
  'report-preserve-audit','report-preserve-org','report-preserve-user','TIME_ENTRY_CREATED',
  'TimeEntry','report-preserve-entry','Auditoria fictícia preservada'
);`;

const actions = [
  "TIME_ENTRY_CREATED", "TIME_ENTRY_UPDATED", "TIMESHEET_CLOSED", "TIMESHEET_REOPENED",
  "NON_BUSINESS_AUTH_REQUESTED", "NON_BUSINESS_AUTH_APPROVE", "NON_BUSINESS_AUTH_REJECT", "NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT",
  "OCCURRENCE_CREATED_APPROVED", "OCCURRENCE_REQUESTED", "OCCURRENCE_APPROVE", "OCCURRENCE_REJECT", "OCCURRENCE_CANCEL",
  "LEAVE_REQUEST_CREATED", "LEAVE_REQUEST_APPROVE", "LEAVE_REQUEST_REJECT", "LEAVE_REQUEST_CANCEL", "LEAVE_REQUEST_UTILIZE",
  "CONTRACTOR_CREATED", "CONTRACTOR_PASSWORD_SET", "CONTRACTOR_STATUS_CHANGED", "CONTRACTOR_SECTOR_CHANGED",
  "USER_PASSWORD_SET", "USER_ROLE_CHANGED", "USER_STATUS_CHANGED", "ORGANIZATION_POLICY_CHANGED",
  "SECTOR_CREATED", "SECTOR_UPDATED", "SECTOR_STATUS_CHANGED",
];

test("reporting foundation is isolated, additive, scoped and service-role only", { timeout: 120_000 }, async () => {
  const bin = findPostgresBin();
  assert.ok(bin, "Isolated PostgreSQL harness unavailable: set HORUS_TEST_POSTGRES_BIN to a local PostgreSQL bin directory");

  const target = mkdtempSync(join(tmpdir(), "horus-reporting-db-"));
  const data = join(target, "data");
  const env = {
    ...buildSafeEnv(process.env),
    PG_RESTRICT_EXEC: "1",
    PGCONNECT_TIMEOUT: "5",
    PGCLIENTENCODING: "UTF8",
    PGOPTIONS: "-c statement_timeout=15000 -c lock_timeout=10000",
  };
  const run = (name, args, input) => execFileSync(executable(bin, name), args, {
    env,
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 2_000_000,
    stdio: name === "pg_ctl" ? "ignore" : ["pipe", "pipe", "pipe"],
  });

  const net = createServer();
  await new Promise((accept, reject) => {
    net.once("error", reject);
    net.listen(0, "127.0.0.1", accept);
  });
  const port = net.address().port;
  await new Promise(resolve => net.close(resolve));
  const connection = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(port), "-U", "horus_report_runner", "-d", "postgres"];
  const query = sql => run("psql", connection, sql + "\n").trim();
  const applyFile = path => run("psql", connection, readFileSync(path, "utf8"));
  let started = false;
  let fixtureLoaded = false;
  let postgres = null;

  try {
    run("initdb", ["-D", data, "-U", "horus_report_runner", "-A", "trust", "--encoding=UTF8", "--no-locale", "--no-instructions"]);
    postgres = spawn(executable(bin, "postgres"), ["-D", data, "-h", "127.0.0.1", "-p", String(port)], {
      env, windowsHide: true, stdio: "ignore",
    });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try { query("select 1;"); break; }
      catch (error) {
        if (attempt === 59) throw error;
        await new Promise(resolveWait => setTimeout(resolveWait, 100));
      }
    }
    started = true;
    assert.equal(query("select current_user;"), "horus_report_runner");
    query("create role anon; create role authenticated; create role service_role bypassrls;");

    const migrationName = readdirSync(migrations).find(name => name.endsWith("_reporting_foundation.sql"));
    assert.ok(migrationName);
    for (const name of readdirSync(migrations).filter(name => name.endsWith(".sql") && name < migrationName).sort()) {
      applyFile(join(migrations, name));
    }

    query(preservationFixture);
    const baselineBefore = query(historyBaselineSql());
    applyFile(join(migrations, migrationName));
    assert.equal(query(historyBaselineSql()), baselineBefore, "reporting migration changed a protected fixture dataset");
    applyFile(join(migrations, migrationName));
    assert.equal(query(historyBaselineSql()), baselineBefore, "idempotent reinstall changed a protected fixture dataset");
    console.log("Protected fixture baseline preserved before, after, and after reinstall:\n" + baselineBefore);

    applyFile(join(root, "tests", "backend", "reporting-foundation-fixture.sql"));
    fixtureLoaded = true;
    const service = sql => query("set role service_role; " + sql);

    assert.equal(query("select count(*) from public.time_entries where id='report-entry-a';"), "1");
    assert.equal(service("select sector_name from public.report_time_entries where id='report-entry-a';"), "Engenharia");
    assert.equal(service("select sector_name from public.report_time_entries where id='report-entry-b';"), "Sem setor definido");
    assert.equal(service("select is_retroactive::text || ':' || has_notes::text from public.report_time_entries where id='report-entry-a';"), "true:true");
    assert.equal(service("select affected_user_id from public.report_audit_events where id='report-audit-old';"), "report-person-a");
    assert.equal(service("select affected_user_id from public.report_audit_events where id='report-audit-json';"), "report-person-b");
    assert.equal(service("select sector_name from public.report_audit_events where id='report-audit-json';"), "Sem setor definido");
    assert.equal(service("select count(*) from public.report_time_entries where organization_id='other-report-org';"), "1");
    assert.equal(service("select sector_name from public.report_balance_transactions where id='report-transaction-a';"), "Engenharia");
    assert.equal(service("select lot_status from public.report_balance_transactions where id='report-transaction-a';"), "RESERVED");
    assert.equal(service("select sector_name from public.report_balance_lots where id='report-lot-a';"), "Engenharia");

    const categorized = JSON.parse(service("select jsonb_object_agg(action, category order by action) from public.report_audit_events where id like 'report-action-%';"));
    assert.equal(Object.keys(categorized).length, actions.length);
    for (const action of actions) assert.equal(categorized[action], historyCategory(action), action);

    const auditCountBefore = query("select count(*) from public.audit_logs where id like 'report-%';");
    service("select count(*) from public.report_audit_events;");
    assert.equal(query("select count(*) from public.audit_logs where id like 'report-%';"), auditCountBefore);

    assert.equal(query("select relrowsecurity from pg_class where oid='public.sectors'::regclass;"), "t");
    assert.equal(query("select has_table_privilege('service_role','public.sectors','select,insert,update')::text || ':' || has_table_privilege('service_role','public.sectors','delete')::text;"), "true:false");
    for (const role of ["public", "anon", "authenticated"]) {
      assert.equal(query(`select has_table_privilege('${role}','public.sectors','select,insert,update,delete');`), "f", role);
      for (const view of ["report_time_entries", "report_balance_transactions", "report_balance_lots", "report_audit_events"]) {
        assert.equal(query(`select has_table_privilege('${role}','public.${view}','select');`), "f", `${role}:${view}`);
      }
    }
    for (const view of ["report_time_entries", "report_balance_transactions", "report_balance_lots", "report_audit_events"]) {
      assert.equal(query(`select has_table_privilege('service_role','public.${view}','select');`), "t", view);
      assert.equal(query(`select reloptions @> array['security_invoker=true'] from pg_class where oid='public.${view}'::regclass;`), "t", view);
    }
    for (const index of [
      "sectors_org_name_unique", "sectors_org_status_name_idx", "users_org_sector_idx",
      "report_entries_org_person_date_idx", "report_transactions_org_person_date_idx", "report_audit_org_actor_date_idx",
    ]) assert.equal(query(`select to_regclass('public.${index}') is not null;`), "t", index);
    assert.equal(query("select count(*) from pg_constraint where conrelid='public.users'::regclass and conname='users_sector_organization_fkey';"), "1");
    assert.throws(
      () => query("update public.users set sector_id='report-sector-other' where id='report-person-a';"),
      /foreign key constraint|violates foreign key/i,
    );

    query(`
      delete from public.audit_logs where id like 'report-%';
      delete from public.time_entry_versions where id like 'report-%';
      delete from public.hour_balance_transactions where id like 'report-%';
      delete from public.leave_request_reservations where id like 'report-%';
      delete from public.non_business_day_authorizations where id like 'report-%';
      delete from public.occurrences where id like 'report-%';
      delete from public.time_entries where id like 'report-%';
      delete from public.leave_requests where id like 'report-%';
      delete from public.hour_balance_lots where id like 'report-%';
      delete from public.monthly_timesheets where id like 'report-%';
      delete from public.users where id like 'report-%';
      delete from public.sectors where id like 'report-%';
      delete from public.organization_policies where id like 'report-%';
      delete from public.organizations where id='report-org' or id='other-report-org' or id='report-preserve-org';
    `);
    fixtureLoaded = false;
    assert.equal(query("select count(*) from public.audit_logs where id like 'report-%';"), "0");
    assert.equal(query("select count(*) from public.time_entries where id like 'report-%';"), "0");
  } finally {
    if (fixtureLoaded) {
      // The cluster is temporary; this marker makes clear that no non-fixture database was ever targeted.
      console.log("Fixture cleanup deferred to temporary-cluster shutdown after a failed assertion.");
    }
    if (started && postgres && !postgres.killed) postgres.kill();
    console.log("Isolated reporting cluster: " + target);
  }
});

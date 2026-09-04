import assert from "node:assert/strict";
import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildSafeEnv } from "../../scripts/verify-workflow-isolated.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrations = join(root, "supabase", "migrations");
const bin = "C:\\Users\\danyel\\AppData\\Local\\Temp\\horus-postgres-tests-bf4dfb1be39545bdb2635ed7a7d24bb1\\pgsql\\bin";
const exe = name => join(bin, name + ".exe");
const protectedTables = [
  "users", "time_entries", "time_entry_versions", "monthly_timesheets", "hour_balance_lots",
  "hour_balance_transactions", "leave_requests", "occurrences", "non_business_day_authorizations", "audit_logs",
];

function run(name, args, options = {}) {
  return execFileSync(exe(name), args, { encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 2_000_000, ...options });
}

function runAsync(name, args, options = {}) {
  return new Promise(resolveRun => execFile(exe(name), args, { encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 2_000_000, ...options }, (error, stdout, stderr) => resolveRun({ error, stdout, stderr })));
}

test("sector RPCs are atomic, scoped, race-safe, and service-role only", { timeout: 120_000 }, async () => {
  assert.ok(["initdb", "pg_ctl", "postgres", "psql"].every(name => existsSync(exe(name))), "required isolated PostgreSQL bin is unavailable");
  const target = mkdtempSync(join(tmpdir(), "horus-sector-rpc-"));
  const data = join(target, "data");
  const env = { ...buildSafeEnv(process.env), PG_RESTRICT_EXEC: "1", PGCONNECT_TIMEOUT: "5", PGOPTIONS: "-c statement_timeout=15000 -c lock_timeout=10000" };
  const net = createServer();
  await new Promise((resolveListen, rejectListen) => { net.once("error", rejectListen); net.listen(0, "127.0.0.1", resolveListen); });
  const port = net.address().port;
  await new Promise(resolveClose => net.close(resolveClose));
  const connection = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(port), "-U", "horus_sector_runner", "-d", "postgres"];
  const query = sql => run("psql", connection, { env, input: sql + "\n" }).trim();
  const service = sql => query("set role service_role; " + sql);
  const apply = path => run("psql", connection, { env, input: readFileSync(path, "utf8") });
  const tableHash = (table, where = "") => query(`select coalesce(string_agg(md5(to_jsonb(t)::text), chr(10) order by t.id), '') from public.${table} t ${where};`);
  const protectedSnapshot = () => protectedTables.map(table => query(`select coalesce(string_agg(md5(to_jsonb(t)::text), chr(10) order by t.id), '') from public.${table} t;`)).join("|");
  const completeSnapshot = () => "sectors=" + query("select coalesce(string_agg(md5(to_jsonb(t)::text), chr(10) order by t.id), '') from public.sectors t;") + "|protected=" + protectedSnapshot();
  const assignmentInvariant = () => [
    `sectors=${tableHash("sectors")}`,
    `other-users=${tableHash("users", "where id <> 'report-person-b'")}`,
    ...protectedTables.filter(table => table !== "users" && table !== "audit_logs").map(table => `${table}=${tableHash(table)}`),
    `other-audits=${tableHash("audit_logs", "where entity_id <> 'report-person-b'")}`,
  ].join("|");
  const unchangedFailure = (sql, pattern) => { const before = completeSnapshot(); assert.throws(() => service(sql), pattern); assert.equal(completeSnapshot(), before); };
  let started = false;
  let postgres = null;

  try {
    run("initdb", ["-D", data, "-U", "horus_sector_runner", "-A", "trust", "--encoding=UTF8", "--no-locale", "--no-instructions"], { env });
    postgres = spawn(exe("postgres"), ["-D", data, "-h", "127.0.0.1", "-p", String(port)], { env, windowsHide: true, stdio: "ignore" });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try { query("select 1;"); break; }
      catch (error) {
        if (attempt === 59) throw error;
        await new Promise(resolveWait => setTimeout(resolveWait, 100));
      }
    }
    started = true;
    query("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const name of readdirSync(migrations).filter(name => name.endsWith(".sql")).sort()) apply(join(migrations, name));
    apply(join(root, "tests", "backend", "reporting-foundation-fixture.sql"));

    for (const signature of [
      "public.create_sector(text,text,text,text)",
      "public.update_sector(text,text,text,text,text,text)",
      "public.set_contractor_sector(text,text,text,text,text)",
    ]) {
      assert.equal(query(`select to_regprocedure('${signature}') is not null;`), "t", signature);
      for (const role of ["public", "anon", "authenticated"]) assert.equal(query(`select has_function_privilege('${role}','${signature}','execute');`), "f", `${role}:${signature}`);
      assert.equal(query(`select has_function_privilege('service_role','${signature}','execute');`), "t", `service:${signature}`);
    }

    query("create function public.test_fail_sector_audit() returns trigger language plpgsql as $$ begin if new.action in ('SECTOR_CREATED','SECTOR_UPDATED','SECTOR_STATUS_CHANGED','CONTRACTOR_SECTOR_CHANGED') then raise exception 'Injected sector audit failure'; end if; return new; end $$; create trigger test_fail_sector_audit before insert on public.audit_logs for each row execute function public.test_fail_sector_audit();");
    try {
      unchangedFailure("select public.create_sector('report-org','report-actor-a','sec_failed','Financeiro')", /Injected sector audit failure/);
      unchangedFailure("select public.update_sector('report-org','report-actor-a','report-sector-engineering','Produto','ACTIVE','Ajuste válido')", /Injected sector audit failure/);
      unchangedFailure("select public.set_contractor_sector('report-org','report-actor-a','report-person-b','report-sector-engineering','Classificação válida')", /Injected sector audit failure/);
    } finally {
      query("drop trigger test_fail_sector_audit on public.audit_logs; drop function public.test_fail_sector_audit();");
    }

    const beforeAssignment = JSON.parse(query("select to_jsonb(u)::text from public.users u where id='report-person-b'"));
    const invariantBefore = assignmentInvariant();
    const assignment = JSON.parse(service("select public.set_contractor_sector('report-org','report-actor-a','report-person-b','report-sector-engineering','Classificação válida')"));
    assert.deepEqual(assignment, { id: "report-person-b", sectorId: "report-sector-engineering" });
    assert.equal(query("select sector_id from public.users where id='report-person-b'"), "report-sector-engineering");
    assert.equal(query("select count(*) from public.audit_logs where action='CONTRACTOR_SECTOR_CHANGED' and entity_id='report-person-b'"), "1");
    const afterAssignment = JSON.parse(query("select to_jsonb(u)::text from public.users u where id='report-person-b'"));
    assert.deepEqual(afterAssignment, {
      ...beforeAssignment,
      sector_id: "report-sector-engineering",
      updated_at: afterAssignment.updated_at,
    }, "the target contractor changes only sector_id and updated_at");
    assert.equal(assignmentInvariant(), invariantBefore, "every sector, non-target user, time, balance, leave, occurrence, authorization, and prior audit row stays byte-for-byte unchanged");
    const assignmentAudit = JSON.parse(query("select to_jsonb(a)::text from public.audit_logs a where action='CONTRACTOR_SECTOR_CHANGED' and entity_id='report-person-b'"));
    assert.deepEqual(assignmentAudit.previous_value, beforeAssignment);
    assert.deepEqual(assignmentAudit.new_value, afterAssignment);
    assert.deepEqual({
      organization_id: assignmentAudit.organization_id,
      user_id: assignmentAudit.user_id,
      action: assignmentAudit.action,
      entity_type: assignmentAudit.entity_type,
      entity_id: assignmentAudit.entity_id,
      reason: assignmentAudit.reason,
    }, {
      organization_id: "report-org", user_id: "report-actor-a", action: "CONTRACTOR_SECTOR_CHANGED",
      entity_type: "User", entity_id: "report-person-b", reason: "Classificação válida",
    }, "the single added audit row describes precisely that allowed delta");

    unchangedFailure("select public.set_contractor_sector('report-org','report-actor-a','report-person-a','report-sector-legacy','Setor inativo')", /Invalid sector/);
    unchangedFailure("select public.set_contractor_sector('report-org','report-actor-a','report-other-person','report-sector-engineering','Pessoa externa')", /Contractor not found/);
    unchangedFailure("select public.update_sector('report-org','report-actor-a','report-sector-other','Operações internas','ACTIVE','Setor externo')", /Sector not found/);

    service("select public.create_sector('report-org','report-actor-a','sec_duplicate_a','Duplicado')");
    unchangedFailure("select public.create_sector('report-org','report-actor-a','sec_duplicate_b',' duplicado ')", /duplicate key/);
    unchangedFailure("select public.update_sector('report-org','report-actor-a','report-sector-engineering','Duplicado','ACTIVE','Renomeação válida')", /duplicate key/);

    const raceSql = "set role service_role; select public.create_sector('report-org','report-actor-a', :id, 'Concorrente')";
    const race = id => runAsync("psql", [...connection, "-c", raceSql.replace(":id", `'${id}'`)], { env });
    const [first, second] = await Promise.all([race("sec_race_a"), race("sec_race_b")]);
    assert.equal([first, second].filter(result => !result.error).length, 1, "one concurrent create wins");
    assert.equal([first, second].filter(result => result.error && /duplicate key/i.test(result.stderr)).length, 1, "one concurrent create reports the unique constraint");
    assert.equal(query("select count(*) from public.sectors where organization_id='report-org' and lower(name)='concorrente'"), "1");
    assert.equal(query("select count(*) from public.audit_logs where action='SECTOR_CREATED' and entity_id in ('sec_race_a','sec_race_b')"), "1");
  } finally {
    if (started && postgres && !postgres.killed) postgres.kill();
  }
});

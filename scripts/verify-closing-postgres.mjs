// Isolated PostgreSQL verification. Never accepts a database URL or existing data directory.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { buildSafeEnv } from "./verify-workflow-isolated.mjs";
import { verifyMonthlyProtection } from "../tests/backend/monthly-protection-cases.mjs";
import { verifyRelease } from "../tests/backend/release-cases.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (![2, 3].includes(args.length) || args[0] !== "--bin" || !isAbsolute(args[1]) || (args.length === 3 && args[2] !== "--candidate")) throw Error("Use --bin com a pasta absoluta dos binários locais PostgreSQL, opcionalmente --candidate.");
const candidate = args[2] === "--candidate";
const bin = resolve(args[1]);
const exe = name => join(bin, name + (process.platform === "win32" ? ".exe" : ""));
for (const name of ["initdb", "pg_ctl", "psql"]) if (!existsSync(exe(name))) throw Error("Binário ausente: " + name);
const target = mkdtempSync(join(tmpdir(), "horus-closing-db-"));
const data = join(target, "data");
const env = { ...buildSafeEnv(process.env), PGCONNECT_TIMEOUT: "5", PGCLIENTENCODING: "UTF8", PGOPTIONS: "-c statement_timeout=15000 -c lock_timeout=10000" };
const net = createServer();
await new Promise((accept, reject) => { net.once("error", reject); net.listen(0, "127.0.0.1", accept); });
const port = net.address().port;
await new Promise(resolve => net.close(resolve));
// pg_ctl starts a long-lived child on Windows. Do not let that child retain our
// capture pipes; server diagnostics already go to the explicit local log file.
const run = (name, args, input) => execFileSync(exe(name), args, { env, input, encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 2_000_000, stdio: name === "pg_ctl" ? "ignore" : ["pipe", "pipe", "pipe"] });
const connection = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(port), "-U", "horus_test_runner", "-d", "postgres"];
// Send UTF-8 through stdin: Windows command-line arguments can be converted
// to the system code page by psql before PGCLIENTENCODING is applied.
const query = sql => run("psql", connection, sql + ";\n").trim();
const rpc = id => `select public.close_timesheet('test-org', 'test-rh', 'ts_${id}_2026_8')`;
const snapshot = () => query("select jsonb_build_object('entries', (select jsonb_agg(to_jsonb(e) order by id) from public.time_entries e), 'versions', (select jsonb_agg(to_jsonb(v) order by id) from public.time_entry_versions v))");
const protectedTables = ["organizations", "organization_policies", "users", "monthly_timesheets", "time_entries", "time_entry_versions", "hour_balance_lots", "hour_balance_transactions", "leave_requests", "audit_logs", "occurrences", "non_business_day_authorizations", "organization_non_business_days", "leave_request_reservations"];
const fullSnapshot = () => query("select jsonb_build_object(" + protectedTables.map(table => `'${table}',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb) from public.${table} r)`).join(",") + ")");
const results = [];
const probe = async (name, action) => {
  try { await action(); results.push({ name, passed: true }); console.log("PASS " + name); }
  catch (error) { results.push({ name, passed: false, detail: String(error.message).slice(0, 700) }); console.log("FAIL " + name + ": " + String(error.message).split("\n")[0]); }
};
let started = false;
try {
  run("initdb", ["-D", data, "-U", "horus_test_runner", "-A", "trust", "--encoding=UTF8", "--no-locale", "--no-instructions"]);
  run("pg_ctl", ["start", "-D", data, "-l", join(target, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "-t", "30"]);
  started = true;
  assert.equal(query("select current_user"), "horus_test_runner");
  query("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const file of ["20260716120000_initial_horus_schema.sql", "20260717120000_auth_identity.sql", "20260717180000_operational_workflows.sql", "20260805130000_dev_administration.sql"]) {
    run("psql", connection, readFileSync(join(root, "supabase/migrations", file), "utf8"));
  }
  run("psql", connection, readFileSync(join(root, "tests/backend/closing-regression.sql"), "utf8"));
  run("psql", connection, readFileSync(join(root, "tests/backend/monthly-protection-fixture.sql"), "utf8"));
  run("psql", connection, readFileSync(join(root, "tests/backend/release-fixture.sql"), "utf8"));
  const beforeInstall = fullSnapshot();
  const tablePermissions = () => query("select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
  const beforePermissions = tablePermissions();
  const installCandidate = () => run("psql", connection,
    readFileSync(join(root, "supabase/migrations/20260903171101_monthly_write_protection.sql"), "utf8"));
  if (candidate) installCandidate();
  console.log("New local test cluster: " + target + "; loopback port " + port);
  await probe("installing proposed functions preserves every protected row", () => assert.equal(fullSnapshot(), beforeInstall));
  await probe("installing twice preserves all rows and existing table permissions", () => {
    if (candidate) installCandidate();
    assert.equal(fullSnapshot(), beforeInstall); assert.equal(tablePermissions(), beforePermissions);
  });
  if (candidate) await probe("the deployment guard rolls back a tampered installation without changing any row", () => {
    const beforeTamper = fullSnapshot();
    const sql = readFileSync(join(root, "supabase/migrations/20260903171101_monthly_write_protection.sql"), "utf8");
    const tampered = sql.replace("do $preservation_after$", "update public.users set name='Fictitious mutation that must roll back' where id='test-rh';\ndo $preservation_after$");
    assert.notEqual(tampered, sql);
    assert.throws(() => run("psql", connection, tampered), /records or table permissions changed/);
    assert.equal(fullSnapshot(), beforeTamper); assert.equal(tablePermissions(), beforePermissions);
  });
  const before = snapshot();
  await probe("closing and repeat preserve daily entries and versions", () => {
    const first = JSON.parse(query(rpc("test-a")));
    assert.equal(first.alreadyClosed, false);
    assert.equal(first.balanceMinutes, 60);
    assert.equal(JSON.parse(query(rpc("test-a"))).alreadyClosed, true);
    assert.equal(query("select count(*) from public.hour_balance_lots where origin_timesheet_id = 'ts_test-a_2026_8'"), "1");
    assert.equal(query("select count(*) from public.audit_logs where action = 'TIMESHEET_CLOSED' and entity_id = 'ts_test-a_2026_8'"), "1");
    assert.equal(snapshot(), before);
  });
  await probe("a second person closes independently", () => {
    assert.equal(JSON.parse(query(rpc("test-b"))).alreadyClosed, false);
    assert.equal(snapshot(), before);
  });
  await probe("audit failure rolls back monthly state and balance", () => {
    query(`create function public.test_fail_audit() returns trigger language plpgsql as $$ begin
      if new.entity_id = 'ts_test-failure_2026_8' then raise exception 'Injected test failure'; end if; return new; end $$;
      create trigger test_fail_audit before insert on public.audit_logs for each row execute function public.test_fail_audit();`);
    assert.throws(() => query(rpc("test-failure")), /Injected test failure/);
    assert.equal(query("select status || ':' || worked_minutes from public.monthly_timesheets where id = 'ts_test-failure_2026_8'"), "OPEN:0");
    assert.equal(query("select count(*) from public.hour_balance_lots where origin_timesheet_id = 'ts_test-failure_2026_8'"), "0");
    assert.equal(snapshot(), before);
    query("drop trigger test_fail_audit on public.audit_logs; drop function public.test_fail_audit();");
  });
  await probe("pending authorization without an entry prevents closing", () => {
    assert.throws(() => query(rpc("test-pending")), /Pending/);
    assert.equal(query("select status from public.monthly_timesheets where id = 'ts_test-pending_2026_8'"), "OPEN");
  });
  await probe("authorization decision cannot change an already closed month", () => {
    query("update public.non_business_day_authorizations set status='APPROVED', approved_minutes=480 where id='later-auth'");
    query(rpc("test-approved"));
    const beforeWrite = fullSnapshot();
    // Direct-write protection, including callers predating the new atomic RPC.
    assert.throws(() => query(`set role service_role;
      update public.non_business_day_authorizations set status='RETROACTIVELY_APPROVED', approved_minutes=60, decided_by='test-rh' where id='later-auth';
      update public.time_entries set eligible_minutes=60, non_business_day_status='AUTHORIZED', updated_by='test-rh' where id='entry-test-approved';
      select public.recalculate_timesheet('ts_test-approved_2026_8');`), /closed|fechad/i);
    assert.equal(fullSnapshot(), beforeWrite);
  });
  await probe("concurrent daily edit cannot rewrite a closed monthly snapshot", async () => {
    const locker = spawn(exe("psql"), connection, { env: { ...env, PGAPPNAME: "horus-test-locker" }, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", errors = "";
    locker.stdout.on("data", chunk => { output += chunk; }); locker.stderr.on("data", chunk => { errors += chunk; });
    const finished = new Promise((resolve, reject) => { locker.on("error", reject); locker.on("exit", code => code === 0 ? resolve() : reject(Error(errors))); });
    const until = async condition => {
      for (let i = 0; i < 50; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
      throw Error("Local concurrency synchronization failed");
    };
    let save;
    try {
      locker.stdin.write(`begin;
        select pg_advisory_xact_lock(hashtextextended('["horus-monthly", "test-org", "test-race"]',0));
        select id from public.monthly_timesheets where id='ts_test-race_2026_8' for update;
        select 'LOCK_HELD';\n`);
      await until(() => output.includes("LOCK_HELD"));
      const editor = spawn(exe("psql"), [...connection, "-c", "select * from public.save_time_entry('test-org','test-rh','test-race','2026-08-03','08:00','18:00',60,540,'Edit during close','Synthetic regression')"], { env: { ...env, PGAPPNAME: "horus-test-editor" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      save = new Promise((resolve, reject) => { let stderr = ""; editor.stderr.on("data", b => { stderr += b; }); editor.on("error", reject); editor.on("exit", code => resolve({ code, stderr })); });
      await until(() => query("select count(*) from pg_stat_activity where application_name='horus-test-editor' and wait_event_type='Lock'") === "1");
      locker.stdin.end(rpc("test-race") + "; commit;\n");
      await finished;
      const result = await save;
      assert.notEqual(result.code, 0, "Daily edit succeeded after concurrent closing");
      assert.match(result.stderr, /closed/i);
      assert.equal(query("select considered_minutes = (closure_snapshot->>'consideredMinutes')::integer from public.monthly_timesheets where id='ts_test-race_2026_8'"), "t");
    } finally {
      if (!locker.stdin.destroyed) locker.stdin.end("rollback;\n");
      await finished.catch(() => {});
      if (save) await save;
    }
  });
  await verifyMonthlyProtection({ query, probe, fullSnapshot, exe, connection, env });
  await verifyRelease({ query, probe, fullSnapshot });
  console.log(JSON.stringify({ postgres: query("show server_version"), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
} finally {
  if (existsSync(join(data, "postmaster.pid"))) run("pg_ctl", ["stop", "-D", data, "-m", "fast", "-w", "-t", "30"]);
  console.log((started ? "Test server stopped. " : "Test server startup was not confirmed. ") + "Synthetic test files retained at " + target);
}

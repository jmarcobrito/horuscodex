import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const fixture = fileURLToPath(new URL("./helpers/read-boundary.mjs", import.meta.url));
const { module: reports } = await runnerImport("./tests/helpers/read-harness.ts", {
  configFile: false,
  envDir: false,
  resolve: { alias: ["./supabase", "./supabase-auth", "../../../db/supabase", "../../../../db/supabase", "../../../../../db/supabase"].map(find => ({ find, replacement: fixture })) },
});
const { boundary, reportsData } = reports;

beforeEach(() => boundary.reset());

test("RH receives the normalized response and private no-store cache", async () => {
  const response = await reportsData.GET(new Request("https://horus.invalid/api/reports?kind=entries&from=2026-08-01&to=2026-08-31&page=1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.kind, "entries");
  assert.equal(body.timezone, "America/Sao_Paulo");
  assert.equal(body.filters.from, "2026-08-01");
  assert.equal(body.pagination.pageSize, 50);
});

test("PJ is blocked before report data is queried", async () => {
  boundary.tables.users.find(row => row.id === "test-rh").role = "PJ";
  const response = await reportsData.GET(new Request("https://horus.invalid/api/reports?kind=entries&from=2026-08-01&to=2026-08-31&page=1"));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(boundary.readsByTable.report_time_entries ?? 0, 0);
});

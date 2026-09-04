import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";

const options = { configFile: false, envDir: false };

function fixture(filters, rows = [{ id: "row-1" }]) {
  return {
    kind: filters.kind,
    filters,
    columns: [{ key: "personName", label: "Colaborador" }],
    rows,
    summary: {},
    options: { people: [], sectors: [], actors: [], categories: [] },
    pagination: { page: filters.page, pageSize: 50, total: rows.length, pageCount: rows.length ? 1 : 0 },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test("query serializes exactly the visible filters", async () => {
  const { module: client } = await runnerImport("./app/reports/report-client.ts", options);
  const filters = client.reportFilters({
    kind: "history", from: "2026-09-01", to: "2026-09-30",
    personId: "person-1", sectorId: "sector-1", category: "entries", actorId: "rh-1", page: 3,
  });
  assert.deepEqual([...client.reportQuery(filters)], [
    ["kind", "history"], ["from", "2026-09-01"], ["to", "2026-09-30"],
    ["personId", "person-1"], ["sectorId", "sector-1"], ["category", "entries"],
    ["actorId", "rh-1"], ["page", "3"],
  ]);
  assert.equal(client.reportQuery(client.reportFilters({ kind: "entries", from: "2026-09-01", to: "2026-09-30", actorId: "hidden-actor" })).has("actorId"), false);
});

test("tab and filter changes preserve compatible values and reset paging", async () => {
  const { module: client } = await runnerImport("./app/reports/report-client.ts", options);
  const history = client.reportFilters({
    kind: "history", from: "2026-09-01", to: "2026-09-30",
    personId: "person-1", sectorId: "sector-1", category: "entries", actorId: "rh-1", page: 4,
  });
  assert.deepEqual(client.changeReportKind(history, "balances"), {
    ...history, kind: "balances", category: null, actorId: null, page: 1,
  });
  assert.deepEqual(client.changeReportFilters(history, { personId: "person-2" }), {
    ...history, personId: "person-2", page: 1,
  });
  assert.deepEqual(client.clearReportFilters(history), {
    ...history, personId: null, sectorId: null, category: null, actorId: null, page: 1,
  });
});

test("a late response cannot replace the newest filter selection", async () => {
  const { module: client } = await runnerImport("./app/reports/report-client.ts", options);
  const augustResponse = deferred();
  const septemberResponse = deferred();
  const signals = [];
  const request = (url, init) => {
    signals.push(init.signal);
    return url.includes("from=2026-08-01") ? augustResponse.promise : septemberResponse.promise;
  };
  const controller = client.createReportLoader(request);
  const augustFilters = client.reportFilters({ kind: "entries", from: "2026-08-01", to: "2026-08-31" });
  const septemberFilters = client.reportFilters({ kind: "entries", from: "2026-09-01", to: "2026-09-30" });
  const august = controller.load(augustFilters);
  const september = controller.load(septemberFilters);
  assert.equal(signals[0].aborted, true);
  septemberResponse.resolve(Response.json(fixture(septemberFilters)));
  await september;
  augustResponse.resolve(Response.json(fixture(augustFilters)));
  await august;
  assert.equal(controller.current().status, "ready");
  assert.equal(controller.current().filters.from, "2026-09-01");
});

test("failed and mismatched consultations never become empty successful reports", async () => {
  const { module: client } = await runnerImport("./app/reports/report-client.ts", options);
  const filters = client.reportFilters({ kind: "entries", from: "2026-09-01", to: "2026-09-30" });
  const failure = client.createReportLoader(async () => Response.json({ error: "Consulta indisponível" }, { status: 503 }));
  await failure.load(filters);
  assert.equal(failure.current().status, "error");
  assert.equal(failure.current().message, "Consulta indisponível");

  const empty = client.createReportLoader(async () => Response.json(fixture(filters, [])));
  await empty.load(filters);
  assert.equal(empty.current().status, "empty");

  const wrong = client.createReportLoader(async () => Response.json(fixture({ ...filters, from: "2026-08-01", to: "2026-08-31" })));
  await wrong.load(filters);
  assert.equal(wrong.current().status, "error");
  assert.equal(wrong.current().filters.from, "2026-09-01");
});

test("export URL reuses the visible query and changes only the format", async () => {
  const { module: client } = await runnerImport("./app/reports/report-client.ts", options);
  const filters = client.reportFilters({
    kind: "balances", from: "2026-09-01", to: "2026-09-30",
    personId: "person-1", sectorId: "UNASSIGNED", category: "CREDIT", page: 2,
  });
  const current = new URL(client.reportExportUrl(filters, "xlsx"), "https://horus.invalid");
  assert.deepEqual([...current.searchParams], [...client.reportQuery(filters), ["format", "xlsx"]]);
  const complete = new URL(client.reportExportUrl(filters, "package"), "https://horus.invalid");
  assert.equal(complete.searchParams.get("format"), "package");
  assert.equal(complete.searchParams.get("category"), "CREDIT");
});

test("export request reports useful success and failure feedback", async () => {
  const { module: client } = await runnerImport("./app/reports/report-client.ts", options);
  const filters = client.reportFilters({ kind: "history", from: "2026-09-01", to: "2026-09-30" });
  let requested = "";
  const success = await client.requestReportExport(async url => {
    requested = url;
    return new Response("arquivo", { headers: { "content-disposition": 'attachment; filename="horus-historico.csv"' } });
  }, filters, "csv");
  assert.match(requested, /kind=history/);
  assert.match(requested, /format=csv/);
  assert.equal(success.filename, "horus-historico.csv");
  assert.equal(success.message, "CSV pronto para download.");

  await assert.rejects(
    client.requestReportExport(async () => Response.json({ error: "Nenhum registro encontrado com estes filtros." }, { status: 422 }), filters, "pdf"),
    /Nenhum registro encontrado com estes filtros/,
  );
});

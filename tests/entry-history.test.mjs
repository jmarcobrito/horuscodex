import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";
import { makeHistoryVersion } from "./fixtures/monthly-workflow.mjs";
const options = { configFile: false, envDir: false };

test("history compares eligible hours and authorization without filling old snapshots", async () => {
  const { module: h } = await runnerImport("./app/EntryHistory.tsx", options);
  const version = makeHistoryVersion();
  const before = structuredClone(version);
  assert.deepEqual(h.historyFields(version).find(f => f.label === "Horas consideradas"), { label: "Horas consideradas", before: "Não informado", after: "Não informado" });
  assert.deepEqual(version, before);
  version.previous_data.eligible_minutes = 0;
  version.new_data.eligible_minutes = 120;
  assert.deepEqual(h.historyFields(version).find(f => f.label === "Horas consideradas"), { label: "Horas consideradas", before: "00:00", after: "02:00" });
  for (const [status, label] of [["NOT_APPLICABLE", "Regular"], ["AUTHORIZED", "Autorizado"], ["REJECTED", "Rejeitado"], ["NEEDS_ADJUSTMENT", "Requer ajuste"], ["UNKNOWN", "Situação não reconhecida"]]) {
    version.previous_data.non_business_day_status = "PENDING_AUTHORIZATION";
    version.new_data.non_business_day_status = status;
    assert.deepEqual(h.historyFields(version).find(f => f.label === "Autorização do dia"), { label: "Autorização do dia", before: "Aguardando autorização", after: label });
  }
});

test("history uses resolved authors and organization timezone with legacy fallback", async () => {
  const { module: h } = await runnerImport("./app/EntryHistory.tsx", options);
  const version = {...makeHistoryVersion(), changed_by_name: "Responsável do RH", changed_at: "2026-08-04T01:00:00Z"};
  const render = timezone => renderToStaticMarkup(createElement(h.EntryHistory, { state: {status:"ready", entryId:"entry-1", versions:[version], timezone}, names:new Map([[version.changed_by,"Nome de compatibilidade"]]), onRetry() {} }));
  assert.match(render("America/Sao_Paulo"), /03\/08\/2026,? 22:00/);
  assert.match(render("Asia/Tokyo"), /04\/08\/2026,? 10:00/);
  assert.match(render(undefined), /03\/08\/2026,? 22:00/);
  assert.match(render(), /Responsável do RH/);
  assert.doesNotMatch(render(), /Nome de compatibilidade/);
  version.changed_by_name = null;
  assert.match(render(), /Nome de compatibilidade/);
  version.changed_at = "invalid";
  assert.match(render(), /Data não disponível/);
});
test("history never reports empty while loading or failed", async () => {
  const { module: h } = await runnerImport("./app/EntryHistory.tsx", options);
  const render = state => renderToStaticMarkup(createElement(h.EntryHistory, { state, names: new Map(), onRetry() {} }));
  const loading = render({ status: "loading", entryId: "entry-1" });
  assert.match(loading, /Carregando histórico deste dia/);
  assert.doesNotMatch(loading, /ainda não teve alterações|versão original/);
  const error = render({ status: "error", entryId: "entry-1", message: "Falha de teste" });
  assert.match(error, /Não foi possível carregar o histórico/);
  assert.match(error, /Tentar novamente/);
  assert.doesNotMatch(error, /ainda não teve alterações|versão original/);
  assert.match(render({ status: "ready", entryId: "entry-1", versions: [] }), /Este dia ainda não teve alterações/);
});
test("history compares all fields and never invents attribution", async () => {
  const { module: h } = await runnerImport("./app/EntryHistory.tsx", options);
  const version = makeHistoryVersion();
  version.change_reason = null;
  const fields = h.historyFields(version);
  assert.deepEqual(fields.find(field => field.label === "Intervalo"), { label: "Intervalo", before: "60 min", after: "90 min" });
  assert.deepEqual(fields.find(field => field.label === "Observação"), { label: "Observação", before: "Original", after: "Corrigida" });
  const html = renderToStaticMarkup(createElement(h.EntryHistory, { state: { status: "ready", entryId: "entry-1", versions: [version] }, names: new Map(), onRetry() {} }));
  assert.match(html, /Responsável não identificado/);
  assert.match(html, /Justificativa não informada/);
  assert.doesNotMatch(html, /Alteração realizada pelo colaborador/);
  version.changed_at = "invalid";
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(h.EntryHistory, { state: { status: "ready", entryId: "entry-1", versions: [version] }, names: new Map(), onRetry() {} })));
});

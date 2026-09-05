import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
const { module: views } = await runnerImport("./app/HorusViews.tsx", { configFile: false, envDir: false });
const { module: { Overview } } = await runnerImport("./app/Overview.tsx", { configFile:false, envDir:false });
const render = (view, data) => renderToStaticMarkup(createElement(view, { data, filters:{personId:null,sectorId:null,status:"all"}, busy:false, receivedAt:null, onFiltersChange(){}, onPeriodChange(){}, onRefresh(){}, onIntent(){}, onNavigate() {}, onNew() {}, onEdit() {}, onStatus() {}, onSetPassword() {} })).replace(/<[^>]*>/g," ").replace(/\s+/g," ");

test("dashboard distinguishes work date from submission time in the organization timezone", () => {
  const data = makeWorkflowDashboard();
  data.contractors = [data.contractors[0]];
  data.contractors[0].lastEntryDate = "2026-08-03";
  data.contractors[0].lastEntryAt = "2026-08-04T01:00:00Z";
  data.timezone = "America/Sao_Paulo";
  const text = render(Overview, data);
  assert.match(text, /Última data trabalhada/);
  assert.match(text, /Último envio/);
  assert.match(text, /03\/08\/2026,? 22:00/);
  assert.match(text, /Registrados após a data trabalhada/);
  data.timezone = "Asia/Tokyo";
  assert.match(render(Overview,data), /04\/08\/2026,? 10:00/);
});

test("invalid dates are disclosed and do not appear as a zero-delay average", () => {
  const data = makeWorkflowDashboard();
  data.contractors = [{ ...data.contractors[0], averageDelayDays: null, unavailableRegistrationDates: 2, lastEntryAt: null }];
  for (const view of [Overview, views.TeamView]) {
    const text = render(view,data);
    assert.match(text, /Dias entre trabalho e registro/);
    assert.match(text, /Não disponível/);
    assert.match(text, /2 registro\(s\) com data inválida/);
    assert.doesNotMatch(text, /0 dia\(s\) em média/);
  }
});

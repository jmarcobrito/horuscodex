import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";

import { makeDashboard } from "./fixtures/dashboard.mjs";

test("closing workspace is visible but writes are disabled by default", async () => {
  const [viewImport, routeImport] = await Promise.all([
    runnerImport("./app/ClosingOverview.tsx", { configFile: false }),
    runnerImport("./app/api/timesheets/route.ts", { configFile: false }),
  ]);
  delete process.env.HORUS_MONTH_CLOSING_WRITE_ENABLED;

  const view = renderToStaticMarkup(createElement(viewImport.module.ClosingOverview, { data: makeDashboard() }));
  assert.match(view, /SOMENTE CONFERÊNCIA/);
  assert.match(view, /Nenhum dado será alterado nesta tela/);
  assert.doesNotMatch(view, /<button|Fechar todos/);

  const response = await routeImport.module.POST(new Request("https://horuscodex.vercel.app/api/timesheets", {
    method: "POST",
    headers: { origin: "https://horuscodex.vercel.app", host: "horuscodex.vercel.app" },
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "O fechamento está temporariamente disponível somente para conferência.",
  });
});

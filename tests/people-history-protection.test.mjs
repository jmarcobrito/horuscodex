import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";

import { makeAdminData, makeDashboard } from "./fixtures/dashboard.mjs";

test("people can be inactivated but never permanently deleted", async () => {
  const [viewsImport, adminViewImport, teamRouteImport, adminRouteImport] = await Promise.all([
    runnerImport("./app/HorusViews.tsx", { configFile: false }),
    runnerImport("./app/AdminView.tsx", { configFile: false }),
    runnerImport("./app/api/team/route.ts", { configFile: false }),
    runnerImport("./app/api/admin/users/route.ts", { configFile: false }),
  ]);
  const { TeamView } = viewsImport.module;
  const { AdminView } = adminViewImport.module;
  const teamRoute = teamRouteImport.module;
  const adminRoute = adminRouteImport.module;

  assert.equal("DELETE" in teamRoute, false);
  assert.equal("DELETE" in adminRoute, false);

  const teamHtml = renderToStaticMarkup(createElement(TeamView, {
    data: makeDashboard(),
    onNew() {},
    onStatus() {},
    onDelete() {},
    onTimesheet() {},
    onSetPassword() {},
  }));
  const adminHtml = renderToStaticMarkup(createElement(AdminView, {
    data: makeAdminData(),
    loading: false,
    onRole() {},
    onStatus() {},
    onPassword() {},
    onDelete() {},
    onViewAs() {},
  }));

  assert.doesNotMatch(teamHtml + adminHtml, /Excluir/);
  assert.match(teamHtml, /Inativar/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";

import { makeDashboard } from "./fixtures/dashboard.mjs";

test("Developer navigation uses clear role names", async () => {
  const imported = await runnerImport("./app/HorusApp.tsx", { configFile: false });
  const html = renderToStaticMarkup(createElement(imported.module.HorusApp, {
    user: { name: "João Dev", email: "dev@example.com" },
    accountRole: "dev",
    organizationName: "Exemplo",
    initialDashboard: makeDashboard(),
  }));

  for (const label of ["Painel", "Aprovações", "Fechamento do mês", "Pessoas", "Visualizar como colaborador"]) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, />Prestador</);
});

test("Developer simulation states that it is read-only", async () => {
  const imported = await runnerImport("./app/DeveloperViewBanner.tsx", { configFile: false });
  const html = renderToStaticMarkup(createElement(imported.module.DeveloperViewBanner, {
    collaboratorName: "Ana Exemplo",
    onBack() {},
  }));

  assert.match(html, /Modo de visualização — somente leitura/);
  assert.match(html, /Nenhuma ação será realizada em nome desta pessoa/);
  assert.match(html, /Voltar à visão RH/);
});

test("DEV sees reports in RH view but collaborator simulation does not", async () => {
  const imported = await runnerImport("./app/HorusApp.tsx", { configFile: false });
  assert.ok(imported.module.navigationItems("rh", true).some(item => item.id === "reports"));
  assert.ok(!imported.module.navigationItems("pj", true).some(item => item.id === "reports"));
});

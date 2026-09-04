import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";

import { makeAdminData, makeDashboard } from "./fixtures/dashboard.mjs";

function sectorFixture() {
  return [
    { id: "sector-engineering", name: "Engenharia", status: "ACTIVE", memberCount: 1 },
    { id: "sector-legacy", name: "Legado", status: "INACTIVE", memberCount: 0 },
  ];
}

function policyFixture() {
  return makeDashboard().policy;
}

function administrationProps(overrides = {}) {
  return {
    isDev: false,
    sectors: sectorFixture(),
    adminData: null,
    policy: policyFixture(),
    loading: false,
    onCreateSector() {},
    onUpdateSector() {},
    onPolicy() {},
    onRole() {},
    onStatus() {},
    onPassword() {},
    onViewAs() {},
    ...overrides,
  };
}

test("RH and ADMIN administration expose sectors and policies but not DEV access controls", async () => {
  const { module: { AdministrationView } } = await runnerImport("./app/AdministrationView.tsx", { configFile: false });

  for (const roleName of ["RH", "ADMIN"]) {
    const html = renderToStaticMarkup(createElement(AdministrationView, administrationProps()));
    assert.match(html, /Administração/);
    assert.match(html, /Setores/);
    assert.match(html, /Políticas/);
    assert.doesNotMatch(html, /Acessos|CONTROLE DE ACESSO|DEV PROTEGIDO/, roleName);
  }
});

test("real DEV keeps the protected access controls available in RH view", async () => {
  const [{ module: { AdministrationView } }, { module: { AdminView } }] = await Promise.all([
    runnerImport("./app/AdministrationView.tsx", { configFile: false }),
    runnerImport("./app/AdminView.tsx", { configFile: false }),
  ]);
  const administration = renderToStaticMarkup(createElement(AdministrationView, administrationProps({
    isDev: true,
    adminData: makeAdminData(),
  })));
  const access = renderToStaticMarkup(createElement(AdminView, {
    data: makeAdminData(), loading: false, onRole() {}, onStatus() {}, onPassword() {}, onViewAs() {},
  }));

  assert.match(administration, /Acessos/);
  assert.match(access, /CONTROLE DE ACESSO/);
  assert.match(access, /DEV PROTEGIDO/);
});

test("sector administration keeps active and inactive sectors with explicit safe actions", async () => {
  const { module: { SectorsPanel } } = await runnerImport("./app/SectorsPanel.tsx", { configFile: false });
  const html = renderToStaticMarkup(createElement(SectorsPanel, {
    sectors: sectorFixture(), loading: false, onCreate() {}, onUpdate() {},
  }));

  for (const copy of ["Novo setor", "Engenharia", "1 colaborador", "Ativo", "Renomear", "Inativar", "Legado", "Inativo", "Reativar"]) {
    assert.match(html, new RegExp(copy));
  }
  assert.doesNotMatch(html, /SECTOR_|ACTIVE|INACTIVE/);
});

test("people cards show the current sector and an explicit edit action", async () => {
  const { module: { TeamView } } = await runnerImport("./app/HorusViews.tsx", { configFile: false });
  const html = renderToStaticMarkup(createElement(TeamView, {
    data: makeDashboard(), onNew() {}, onEdit() {}, onStatus() {}, onSetPassword() {},
  }));

  assert.match(html, /Engenharia/);
  assert.match(html, /Editar colaborador/);
});

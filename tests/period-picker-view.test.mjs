import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
test("only compact period picker collapses range controls and retains month boundaries and loading protection", async () => {
  const { module: { PeriodPicker } } = await runnerImport("./app/PeriodPicker.tsx", { configFile: false, envDir: false });
  const props = { value: makeWorkflowDashboard().period, busy: false, allowRange: true, onChange() {} };
  const normal = renderToStaticMarkup(createElement(PeriodPicker, props));
  assert.doesNotMatch(normal, /<details/);
  assert.match(normal, /Aplicar intervalo/);
  const compact = renderToStaticMarkup(createElement(PeriodPicker, { ...props, variant: "compact", busy: true }));
  assert.match(compact, /<details[^>]*><summary>Outro intervalo/);
  assert.match(compact, /type="month"[^>]*disabled=""/);
  assert.match(compact, /min="2000-01" max="2200-12"/);
});

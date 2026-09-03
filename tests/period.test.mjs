import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const options = { configFile: false, envDir: false };
test("month selection handles leap years, boundaries and full ranges", async () => {
  const { module: p } = await runnerImport("./app/period.ts", options);
  assert.equal(p.monthPeriod(2028, 2).to, "2028-02-29");
  assert.deepEqual(p.shiftMonth(p.monthPeriod(2026, 12), 1), { from: "2027-01-01", to: "2027-01-31", year: 2027, month: 1 });
  assert.equal(p.shiftMonth(p.monthPeriod(2000, 1), -1), null);
  assert.equal(p.shiftMonth(p.monthPeriod(2200, 12), 1), null);
  assert.equal(p.parseMonthValue("2026-13"), null);
  assert.equal(p.parseMonthValue("2026-8"), null);
  assert.equal(p.asFullMonth({ from: "2026-08-10", to: "2026-09-10", year: null, month: null }), null);
  assert.deepEqual(p.asFullMonth({ from: "2026-08-01", to: "2026-08-31", year: null, month: null }), { from: "2026-08-01", to: "2026-08-31", year: 2026, month: 8 });
  assert.equal(p.periodQuery(p.monthPeriod(2026, 8)), "year=2026&month=8");
  assert.equal(p.periodQuery({ from: "2026-08-10", to: "2026-09-10", year: null, month: null }), "from=2026-08-10&to=2026-09-10");
  for (const period of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-09-01", to: "2026-08-01" },
    { from: "", to: "" },
  ]) assert.throws(() => p.periodQuery(period));
});
test("monthly screens require an explicit selection and expose accessible controls", async () => {
  const { module: v } = await runnerImport("./app/PeriodPicker.tsx", options);
  const html = renderToStaticMarkup(createElement(v.PeriodPicker, { value: null, busy: false, allowRange: false, onChange() {} }));
  assert.match(html, /Escolha o mês/);
  assert.match(html, /type="month"/);
  assert.match(html, /Mês de consulta/);
  assert.doesNotMatch(html, /Data inicial/);
  const range = renderToStaticMarkup(createElement(v.PeriodPicker, { value: { from: "2026-08-10", to: "2026-08-20", year: null, month: null }, busy: false, allowRange: true, onChange() {} }));
  assert.match(range, /Data inicial/);
  assert.match(range, /Aplicar intervalo/);
});

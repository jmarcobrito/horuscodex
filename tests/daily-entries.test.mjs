import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";

const options = { configFile: false, envDir: false };
const { module: entries } = await runnerImport("./app/entries-model.ts", options);

test("daily consultation filters the exact date without changing the monthly closing input", async () => {
  assert.equal(typeof entries.selectDailyEntries, "function");
  const { module: closing } = await runnerImport("./app/closing-model.ts", options);
  const data = makeWorkflowDashboard();
  const before = structuredClone(data);
  const day = entries.selectDailyEntries(data, "2026-08-03");
  assert.deepEqual(day.entries.map(entry => entry.id), ["entry-1"]);
  assert.equal(day.workedMinutes, 480);
  assert.equal(day.recordedPeople, 1);
  assert.deepEqual(day.withoutEntry.map(person => person.id), ["person-2", "person-3"]);
  const rows = closing.buildClosingRows(data);
  assert.deepEqual(closing.makeClosingCommand(data.period, rows, ["person-1"], []), { year: 2026, month: 8, contractorIds: ["person-1"] });
  assert.deepEqual(closing.makeClosingCommand(data.period, rows, ["person-1", "person-2"], []), { year: 2026, month: 8, contractorIds: ["person-1", "person-2"] });
  assert.deepEqual(data, before);
});

test("daily totals count all records but each person once, retaining inactive history", () => {
  assert.equal(typeof entries.selectDailyEntries, "function");
  const data = makeWorkflowDashboard();
  data.entries.push({ ...data.entries[0], id: "entry-extra", calculatedMinutes: 60 });
  const day = entries.selectDailyEntries(data, "2026-08-03");
  assert.equal(day.entries.length, 2);
  assert.equal(day.recordedPeople, 1);
  assert.equal(day.workedMinutes, 540);
  const inactive = entries.selectDailyEntries(data, "2026-08-04");
  assert.equal(inactive.entries[0].contractorId, "person-2");
  assert.equal(inactive.workedMinutes, 300);
  const empty = entries.selectDailyEntries(data, "2026-08-02");
  assert.equal(empty.entries.length, 0);
  assert.equal(empty.workedMinutes, 0);
  assert.equal(empty.withoutEntry.length, 3);
});

test("day navigation is valid and bounded by the selected month, including leap years", () => {
  assert.equal(typeof entries.resolveEntryDate, "function");
  assert.equal(typeof entries.shiftEntryDate, "function");
  const august = makeWorkflowDashboard().period;
  assert.equal(entries.resolveEntryDate(august, "2026-08-03"), "2026-08-03");
  assert.equal(entries.resolveEntryDate(august, "2026-09-03"), "2026-08-01");
  assert.equal(entries.resolveEntryDate(august, ""), "2026-08-01");
  assert.equal(entries.shiftEntryDate(august, "2026-08-03", -1), "2026-08-02");
  assert.equal(entries.shiftEntryDate(august, "2026-08-31", 1), null);
  assert.equal(entries.shiftEntryDate(august, "2026-08-01", -1), null);
  const leap = makeWorkflowDashboard(2024, 2).period;
  assert.equal(entries.shiftEntryDate(leap, "2024-02-28", 1), "2024-02-29");
  assert.equal(entries.shiftEntryDate(leap, "2024-02-29", 1), null);
  assert.equal(entries.shiftEntryDate(leap, "2024-02-30", -1), null);
  for (const date of ["2026-08-32", "2026-09-01", "2026-07-31", "", "2026-02-30"]) {
    assert.throws(() => entries.selectDailyEntries(makeWorkflowDashboard(), date));
  }
});

test("RH day view ignores the person filter, offers history only and does not display monthly totals as daily", async () => {
  const { module: views } = await runnerImport("./app/HorusViews.tsx", options);
  const html = renderToStaticMarkup(createElement(views.EntriesView, {
    role: "rh", data: makeWorkflowDashboard(), displayMode: "day", workDate: "2026-08-03", contractorId: "person-2",
    onNew() {}, onEdit() {}, onHistory() {},
  }));
  assert.match(html, /Data da conferência/);
  assert.match(html, /Histórico deste dia · 03\/08\/2026 · Ana Exemplo/);
  assert.doesNotMatch(html, /Editar este dia/);
  assert.doesNotMatch(html, /Saldo previsto|Meta:|Horas abonadas|Fechar mês/);
  assert.match(html, /Sem lançamento nesta consulta/);
  assert.match(html, /Bruno Teste/);
  assert.match(html, /Carla Teste/);
});

test("the collaborator view remains monthly even when RH day display settings are present", async () => {
  const { module: views } = await runnerImport("./app/HorusViews.tsx", options);
  const data = makeWorkflowDashboard();
  data.contractors = data.contractors.filter(person => person.id === "person-1");
  data.entries = data.entries.filter(entry => entry.contractorId === "person-1");
  const html = renderToStaticMarkup(createElement(views.EntriesView, {
    role: "pj", data, displayMode: "day", workDate: "2026-08-04", readOnly: true,
    onNew() {}, onEdit() {}, onHistory() {},
  }));
  assert.match(html, /Meu mês/);
  assert.match(html, /Resumo de Ana Exemplo/);
  assert.match(html, /Histórico deste dia/);
  assert.doesNotMatch(html, /Data da conferência|Por dia|Editar este dia|Bruno Teste|Carla Teste/);
});

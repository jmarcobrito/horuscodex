import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Horus product shell and core workflows", async () => {
  const app = await readFile(new URL("../app/HorusApp.tsx", import.meta.url), "utf8");
  assert.match(app, /Bom dia, Marina/);
  assert.match(app, /Acompanhamento da equipe/);
  assert.match(app, /Banco de horas/);
  assert.match(app, /Registrar horas/);
  assert.match(app, /\/api\/time-entries/);
  assert.doesNotMatch(app, /Your site is taking shape|react-loading-skeleton/i);
});

test("ships product metadata, database migration and no starter preview", async () => {
  const [layout, page, hosting, migration] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_huge_omega_flight.sql", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Horus — Controle de horas técnicas/);
  assert.match(layout, /og\.png/);
  assert.match(page, /HorusApp/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(migration, /CREATE TABLE `time_entries`/);
  assert.match(migration, /CREATE TABLE `hour_balance_lots`/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

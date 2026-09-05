import assert from "node:assert/strict";
import test from "node:test";
import { civilDate, registrationDelayDays } from "../db/civil-date.ts";

test("registration on the same local day is not retroactive across UTC midnight", () => {
  assert.equal(civilDate("2026-08-04T01:00:00Z", "America/Sao_Paulo"), "2026-08-03");
  assert.equal(registrationDelayDays("2026-08-03", "2026-08-04T01:00:00Z", "America/Sao_Paulo"), 0);
  assert.equal(registrationDelayDays("2026-08-03", "2026-08-04T03:01:00Z", "America/Sao_Paulo"), 1);
});

test("calendar differences survive month/year changes and different IANA timezones", () => {
  for (const [worked, created, zone, expected] of [
    ["2026-08-31", "2026-09-01T02:00:00Z", "America/Sao_Paulo", 0],
    ["2025-12-31", "2026-01-02T03:00:00Z", "America/Sao_Paulo", 2],
    ["2026-08-03", "2026-08-03T15:00:00Z", "Asia/Tokyo", 1],
    ["2026-08-03", "2026-08-03T22:00:00-03:00", "America/Sao_Paulo", 0],
    ["2026-08-04", "2026-08-03T15:00:00Z", "America/Sao_Paulo", 0],
    ["2024-02-28", "2024-03-01T12:00:00Z", "UTC", 2],
    ["2026-03-07", "2026-03-09T04:00:00Z", "America/New_York", 2],
  ]) assert.equal(registrationDelayDays(worked, created, zone), expected);
});

test("invalid or timezone-less timestamps remain unavailable, not zero delay", () => {
  for (const instant of ["invalid", "", "2026-02-30T12:00:00Z", "2026-08-03", "2026-08-03T22:00:00"]) {
    assert.equal(civilDate(instant, "America/Sao_Paulo"), null);
    assert.equal(registrationDelayDays("2026-08-03", instant, "America/Sao_Paulo"), null);
  }
  for (const workDate of ["2026-02-30", "invalid", "2026-8-3"]) {
    assert.equal(registrationDelayDays(workDate, "2026-08-03T12:00:00Z", "America/Sao_Paulo"), null);
  }
});

test("invalid organization timezone never falls back to the machine timezone", () => {
  for (const zone of ["Not/A_Zone", ""]) assert.throws(() => civilDate("2026-08-03T12:00:00Z", zone));
});

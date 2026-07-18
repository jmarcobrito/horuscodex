import assert from "node:assert/strict";
import test from "node:test";

import { calculateWorkedMinutes } from "../db/time-rules.ts";

test("calculates worked minutes on the server", () => {
  assert.deepEqual(calculateWorkedMinutes("08:00", "17:30", 60), {
    startMinutes: 480,
    endMinutes: 1050,
    workedMinutes: 510,
  });
});

test("rejects invalid and inverted periods", () => {
  assert.equal(calculateWorkedMinutes("17:30", "08:00", 60), null);
  assert.equal(calculateWorkedMinutes("08:00", "09:00", 60), null);
  assert.equal(calculateWorkedMinutes("25:00", "26:00", 0), null);
  assert.equal(calculateWorkedMinutes("08:00", "17:00", -1), null);
});

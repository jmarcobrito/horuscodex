import assert from "node:assert/strict";
import test from "node:test";
import { createMockRequest } from "./helpers/mock-request.mjs";

test("isolated transport rejects external and unknown routes without falling back to fetch", async () => {
  const mock = createMockRequest({ "GET /api/dashboard": () => Response.json({ fixture: true }) });
  assert.deepEqual(await (await mock.request("/api/dashboard?month=8")).json(), { fixture: true });
  await assert.rejects(mock.request("https://example.com/api/dashboard"));
  await assert.rejects(mock.request("/api/timesheets", { method: "POST" }));
  assert.equal(mock.calls.length, 1);
});

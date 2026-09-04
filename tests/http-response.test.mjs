import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";

const { module: { apiFailure, AuthenticationError, AuthorizationError } } = await runnerImport("./tests/helpers/http-response-harness.ts", { configFile: false, envDir: false });

test("shared API failures make actor errors private and non-cacheable", async () => {
  for (const error of [new AuthenticationError(), new AuthorizationError()]) {
    const response = apiFailure(error, "test");
    assert.equal(response.status, error.status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { error: error.message });
  }
});

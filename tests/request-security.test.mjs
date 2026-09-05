import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";

import { sameOriginFailure } from "../db/request-security.ts";

test("accepts the public request origin behind a trusted proxy", () => {
  const request = new Request("http://internal/api/team", {
    method: "POST",
    headers: {
      origin: "https://horuscodex.vercel.app",
      host: "internal",
      "x-forwarded-host": "horuscodex.vercel.app",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(sameOriginFailure(request), null);
});

test("rejects cross-origin and originless state changes", async () => {
  const crossOrigin = sameOriginFailure(new Request("https://horuscodex.vercel.app/api/team", {
    method: "POST",
    headers: { origin: "https://evil.example", host: "horuscodex.vercel.app" },
  }));
  const originless = sameOriginFailure(new Request("https://horuscodex.vercel.app/api/team", {
    method: "POST",
    headers: { host: "horuscodex.vercel.app" },
  }));

  assert.equal(crossOrigin?.status, 403);
  assert.equal(originless?.status, 403);
  assert.equal(crossOrigin?.headers.get("cache-control"), "private, no-store");
  assert.equal(originless?.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await crossOrigin?.json(), { error: "Origem da solicitação não autorizada." });
});

test("every state-changing route runs the origin guard first", async () => {
  const handlers = [
    ["./app/api/admin/users/route.ts", "PATCH"],
    ["./app/api/auth/google/route.ts", "POST"],
    ["./app/api/auth/sign-in/route.ts", "POST"],
    ["./app/api/auth/sign-out/route.ts", "POST"],
    ["./app/api/leave-requests/route.ts", "POST"],
    ["./app/api/leave-requests/route.ts", "PATCH"],
    ["./app/api/non-business-authorizations/route.ts", "POST"],
    ["./app/api/non-business-authorizations/route.ts", "PATCH"],
    ["./app/api/occurrences/route.ts", "POST"],
    ["./app/api/occurrences/route.ts", "PATCH"],
    ["./app/api/policies/route.ts", "PATCH"],
    ["./app/api/sectors/route.ts", "POST"],
    ["./app/api/sectors/route.ts", "PATCH"],
    ["./app/api/team/route.ts", "POST"],
    ["./app/api/team/route.ts", "PATCH"],
    ["./app/api/time-entries/route.ts", "POST"],
    ["./app/api/timesheets/route.ts", "POST"],
  ];

  for (const [modulePath, method] of handlers) {
    const imported = await runnerImport(modulePath, { configFile: false });
    const response = await imported.module[method](new Request(`https://horuscodex.vercel.app/${modulePath}`, {
      method,
      headers: { origin: "https://evil.example", host: "horuscodex.vercel.app" },
    }));

    assert.equal(response.status, 403, `${method} ${modulePath}`);
    assert.deepEqual(await response.json(), { error: "Origem da solicitação não autorizada." });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { isSafeSourcePath, buildSafeEnv } from "../scripts/verify-workflow-isolated.mjs";

test("verification never copies environment files or inherits credentials", () => {
  for (const path of [".env", ".env.local", "tests/.env.production", ".dev.vars", ".vercel/project.json", "../outside.ts", "C:\\outside.ts", ".mcp.json", ".npmrc"]) {
    assert.equal(isSafeSourcePath(path), false, path);
  }
  assert.equal(isSafeSourcePath("app/HorusApp.tsx"), true);
  const env = buildSafeEnv({ PATH: "local-tools", TEMP: "local-temp", SUPABASE_URL: "forbidden", SUPABASE_SERVICE_ROLE_KEY: "forbidden", VERCEL_TOKEN: "forbidden", NODE_OPTIONS: "forbidden" });
  assert.equal(env.PATH, "local-tools");
  for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN", "NODE_OPTIONS"]) assert.equal(env[key], undefined);
});

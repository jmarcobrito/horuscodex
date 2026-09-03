import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isSafeSourcePath(path) {
  if (isAbsolute(path) || /^[a-z]:/i.test(path)) return false;
  return path.replaceAll("\\", "/").split("/").every(part => part !== ".." && part !== "" &&
    !part.toLowerCase().startsWith(".env") && !/^\.dev\.vars(?:\.|$)/i.test(part) &&
    ![".git", ".vercel", ".supabase", ".codex", ".agents", ".mcp.json", ".npmrc", ".netrc", "node_modules"].includes(part.toLowerCase()));
}
export function buildSafeEnv(source) {
  const allowed = new Set(["path", "systemroot", "windir", "comspec", "temp", "tmp", "pathext"]);
  const env = Object.fromEntries(Object.entries(source).filter(([key, value]) => allowed.has(key.toLowerCase()) && value !== undefined));
  return { ...env, CI: "1", NEXT_TELEMETRY_DISABLED: "1", WRANGLER_WRITE_LOGS: "false" };
}
function main(mode) {
  if (!["checks", "preview"].includes(mode)) throw Error("Use checks ou preview");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const paths = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const target = mkdtempSync(join(tmpdir(), "horus-workflow-check-"));
  for (const path of paths) {
    if (!isSafeSourcePath(path)) continue;
    const source = resolve(root, path);
    if (relative(root, source).startsWith("..") || lstatSync(source).isSymbolicLink()) throw Error("Fonte fora do escopo permitido");
    const destination = resolve(target, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  console.log("Preparando dependências locais dentro da cópia isolada…");
  const dependencies = join(root, "node_modules");
  cpSync(dependencies, join(target, "node_modules"), {
    recursive: true, dereference: true,
    filter: path => !relative(dependencies, path).split(/[\\/]/).some(part => part.startsWith(".env") || [".cache", ".vite", ".vite-temp"].includes(part)),
  });
  const env = buildSafeEnv(process.env);
  const run = args => {
    const result = spawnSync(process.execPath, args, { cwd: target, env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error("Verificação terminou com código " + result.status);
  };
  console.log("Cópia de verificação sem arquivos de ambiente: " + target);
  if (mode === "preview") {
    run(["node_modules/vite/bin/vite.js", "--config", "tests/browser/vite.config.ts"]);
    return;
  }
  run(["node_modules/vinext/dist/cli.js", "build"]);
  const tests = readdirSync(join(target, "tests")).filter(name => name.endsWith(".test.mjs")).sort().map(name => "tests/" + name);
  run(["--test", ...tests]);
  run(["node_modules/eslint/bin/eslint.js", "app", "db", "tests", "worker", "proxy.ts", "--ignore-pattern", ".next", "--ignore-pattern", ".vinext"]);
  run(["node_modules/next/dist/bin/next", "build"]);
  run(["node_modules/typescript/bin/tsc", "--noEmit"]);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2] ?? "checks");

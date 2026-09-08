// Docker smoke-test: for each module, build + up, wait for health, run its checker
// (a fresh app should report VULNERABLE / vulns OPEN), then tear down.
//
// Usage (from the repo root):
//   node scripts/smoke-test.mjs            # all modules
//   node scripts/smoke-test.mjs 04 05      # only these (match by dir prefix)
//
// Requires Docker running. Safe to re-run; each module is torn down (down -v) after.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MODULES = [
  { dir: "01-identity-access", port: 3001 },
  { dir: "02-error-disclosure", port: 3002 },
  { dir: "03-enumeration", port: 3003 },
  { dir: "04-trust-boundaries", port: 3004 }, // two services (portal + labs)
  { dir: "05-capstone", port: 3005 },
];

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const filter = process.argv.slice(2);
const selected = filter.length
  ? MODULES.filter((m) => filter.some((f) => m.dir.startsWith(f)))
  : MODULES;

function sh(cmd, cwd) {
  return spawnSync(cmd, { cwd, stdio: "inherit", shell: true }).status ?? 1;
}

async function waitHealth(port, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://localhost:${port}/api/health`);
      if (r.ok) return true;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function main() {
  if (spawnSync("docker info", { shell: true, stdio: "ignore" }).status !== 0) {
    console.log(red("Docker doesn't look like it's running. Start Docker Desktop and retry."));
    process.exit(1);
  }

  const results = [];
  for (const m of selected) {
    const cwd = path.join(ROOT, m.dir);
    console.log(bold(`\n===================== ${m.dir} (port ${m.port}) =====================`));

    console.log(dim("building + up ..."));
    if (sh("docker compose up -d --build", cwd) !== 0) {
      results.push([m.dir, red("BUILD/UP FAILED")]);
      sh("docker compose down -v", cwd);
      continue;
    }

    console.log(dim("waiting for health ..."));
    if (!(await waitHealth(m.port))) {
      console.log(red("health timeout — logs:"));
      sh("docker compose logs --tail=30", cwd);
      results.push([m.dir, red("HEALTH TIMEOUT")]);
      sh("docker compose down -v", cwd);
      continue;
    }

    console.log(dim("running checker (a fresh app should be VULNERABLE) ..."));
    const code = sh("node checker/check.mjs", cwd);
    results.push([m.dir, code === 1 ? green("OK (VULNERABLE, as expected)") : code === 0 ? green("OK (already patched)") : red(`checker error (exit ${code})`)]);

    console.log(dim("tearing down ..."));
    sh("docker compose down -v", cwd);
  }

  console.log(bold("\n===================== SUMMARY ====================="));
  for (const [dir, status] of results) console.log(`  ${dir.padEnd(22)} ${status}`);
  console.log("");
}

main();

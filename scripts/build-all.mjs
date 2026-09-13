// Pre-build every module's Docker image(s) WITHOUT starting anything. Run this once
// before the workshop (during setup / the night before) so every in-lab "Start" is
// instant — the slow part (base image, npm install, Prisma engines, the seed) is
// paid here, not in front of the room.
//
// Usage (from the repo root):
//   node scripts/build-all.mjs          # all modules
//   node scripts/build-all.mjs 04 05    # only these (match by dir prefix)

import { spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const modules = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name) && existsSync(path.join(ROOT, d.name, "docker-compose.yml")))
  .map((d) => d.name)
  .sort();

const filter = process.argv.slice(2);
const selected = filter.length ? modules.filter((m) => filter.some((f) => m.startsWith(f))) : modules;

if (spawnSync("docker info", { shell: true, stdio: "ignore" }).status !== 0) {
  console.log(red("Docker doesn't look like it's running. Start Docker Desktop and retry."));
  process.exit(1);
}

console.log(bold("\nPre-building module images (no containers are started)"));
console.log(dim("This can take several minutes the first time; later runs are cached.\n"));

const results = [];
for (const m of selected) {
  console.log(bold(`\n═════════ ${m} ═════════`));
  const code = spawnSync("docker compose build", { cwd: path.join(ROOT, m), stdio: "inherit", shell: true }).status ?? 1;
  results.push([m, code === 0]);
}

console.log(bold("\n═════════ SUMMARY ═════════"));
for (const [m, ok] of results) console.log(`  ${ok ? green("✔ built") : red("✗ FAILED")}  ${m}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(failed ? red(`\n${failed} module(s) failed to build.\n`) : green("\nAll images built. In-lab Start will be instant.\n"));
process.exit(failed ? 1 : 0);

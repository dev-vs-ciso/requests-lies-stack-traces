// Load the module images from a tarball produced by save-images.mjs. After this,
// `node setup.mjs` → Start uses the loaded image and starts instantly — no build,
// no downloads.
//
// Usage:  node scripts/load-images.mjs [infile]   (default: dist/rlst-images.tar)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "dist", "rlst-images.tar");

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

if (spawnSync("docker info", { shell: true, stdio: "ignore" }).status !== 0) {
  console.log(red("Docker doesn't look like it's running. Start Docker Desktop and retry."));
  process.exit(1);
}
if (!existsSync(IN)) {
  console.log(red(`No image tarball at ${IN}. Point me at it: node scripts/load-images.mjs <path>`));
  process.exit(1);
}

const code = spawnSync(`docker load -i "${IN}"`, { shell: true, stdio: "inherit" }).status ?? 1;
if (code === 0) console.log(green("\nImages loaded. `node setup.mjs` → Start will be instant."));
process.exit(code);

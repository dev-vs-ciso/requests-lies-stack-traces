// Save all built module images to a single tarball, for distribution (USB stick /
// shared drive) so attendees never build or download anything on conference wifi.
// Run `npm run build-all` first, then this.
//
// Usage:  node scripts/save-images.mjs [outfile]   (default: dist/rlst-images.tar)

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "dist", "rlst-images.tar");

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

if (spawnSync("docker info", { shell: true, stdio: "ignore" }).status !== 0) {
  console.log(red("Docker doesn't look like it's running."));
  process.exit(1);
}

const list = spawnSync('docker images "rlst-*" --format "{{.Repository}}:{{.Tag}}"', {
  shell: true,
  encoding: "utf8",
});
const images = (list.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
if (!images.length) {
  console.log(red("No rlst-* images found. Run `npm run build-all` first."));
  process.exit(1);
}

mkdirSync(path.dirname(OUT), { recursive: true });
console.log(dim(`Saving ${images.length} images → ${OUT}`));
console.log(dim(images.join("\n")));
const code = spawnSync(`docker save -o "${OUT}" ${images.join(" ")}`, { shell: true, stdio: "inherit" }).status ?? 1;
if (code === 0) {
  console.log(green(`\nSaved to ${OUT}`));
  console.log(dim("Attendees load it with:  node scripts/load-images.mjs <path-to-tar>  (or docker load -i <tar>)"));
}
process.exit(code);

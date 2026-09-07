// Workshop launcher. Run from the repo root:  npm start   (or: node setup.mjs)
//
// Auto-discovers the lab folders (01-…, 02-…, …), lets you pick one, and hands off
// to that lab's own menu. New modules appear here automatically as they're added.

import { spawnSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline/promises";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function labTitle(labDir) {
  try {
    const readme = readFileSync(path.join(labDir, "README.md"), "utf8");
    const m = readme.match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* fall through to folder name */
  }
  return path.basename(labDir);
}

function discoverLabs() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name))
    .filter((d) => existsSync(path.join(ROOT, d.name, "setup.mjs")))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ dir: d.name, title: labTitle(path.join(ROOT, d.name)) }));
}

function dockerRunning() {
  return spawnSync("docker info", { shell: true, stdio: "ignore" }).status === 0;
}

async function main() {
  console.log(bold("\n🏥  Requests, Lies, and Stack Traces"));
  console.log(dim("    Pick a lab. Each lab has its own menu (start / check / reset / …).\n"));

  if (!dockerRunning()) {
    console.log(yellow("⚠  Docker doesn't look like it's running. Start Docker Desktop first —"));
    console.log(yellow("   the labs won't start without it.\n"));
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (;;) {
    const labs = discoverLabs();
    console.log(bold("━━ Labs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    if (labs.length === 0) {
      console.log(dim("  (no lab folders found yet)"));
    } else {
      labs.forEach((l, i) => {
        console.log(`  ${bold(String(i + 1))}  ${l.title}  ${dim("(" + l.dir + ")")}`);
      });
    }
    console.log(`  ${bold("0")}  Exit`);

    const choice = (await rl.question(bold("\nChoose a lab: "))).trim();
    if (choice === "0" || choice.toLowerCase() === "q") break;

    const idx = Number(choice) - 1;
    const lab = labs[idx];
    if (!lab) {
      console.log("Unknown option.\n");
      continue;
    }

    console.log(cyan(`\n→ Opening ${lab.title}\n`));
    // Hand off to the lab's own menu; control returns here when it exits. Pause our
    // readline so the child owns stdin cleanly, then resume.
    rl.pause();
    spawnSync(process.execPath, ["setup.mjs"], {
      cwd: path.join(ROOT, lab.dir),
      stdio: "inherit",
    });
    rl.resume();
    console.log(dim(`\n← Back to the lab picker.\n`));
  }

  rl.close();
}

main();

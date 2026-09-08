// Cross-platform setup menu for Module 1. Run:  node setup.mjs
// One file, runs on Windows / macOS / Linux — no bash-vs-PowerShell parity bugs.

import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = "http://localhost:3001";

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

function run(cmd) {
  console.log(dim(`$ ${cmd}`));
  const r = spawnSync(cmd, { cwd: DIR, stdio: "inherit", shell: true });
  return r.status ?? 1;
}

function haveDocker() {
  return spawnSync("docker --version", { shell: true, stdio: "ignore" }).status === 0;
}

async function waitForHealth(timeoutMs = 60_000) {
  const start = Date.now();
  process.stdout.write("Waiting for the portal to come up");
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${URL}/api/health`);
      if (res.ok) {
        console.log(green(" up!"));
        return true;
      }
    } catch {
      /* not ready yet */
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log("\n(giving up waiting — check the logs)");
  return false;
}

function credentials() {
  console.log(bold(`\n  Portal:  ${cyan(URL)}`));
  console.log(`  You (attacker):  ${bold("andrej / andrej12345")}  ${dim("(patient id 1)")}`);
  console.log(dim(`  Victim: Викторија Петровска — patient ${bold("id 2")} (the trophy)`));
  console.log(dim(`  Also: drstoj / drstoj12345 (provider)\n`));
}

const actions = {
  async "1"() {
    if (run("docker compose up -d --build") === 0) {
      await waitForHealth();
      credentials();
    }
  },
  async "2"() {
    run("docker compose down");
  },
  async "3"() {
    run("docker compose restart portal");
    await waitForHealth(20_000);
  },
  async "4"() {
    console.log(dim("Recreating the container → fresh copy of the pristine data."));
    run("docker compose up -d --force-recreate");
    await waitForHealth(30_000);
  },
  async "5"() {
    console.log(dim("Full nuke: removing containers + volumes, rebuilding, reseeding."));
    run("docker compose down -v --remove-orphans");
    if (run("docker compose build") === 0 && run("docker compose up -d") === 0) {
      await waitForHealth();
      credentials();
    }
  },
  async "6"() {
    console.log(dim("Restoring src/ to the original (vulnerable) state..."));
    run("git restore --source=HEAD --worktree -- src");
    console.log(green("Done. tsx will reload; if not, use option 3 (Restart)."));
  },
  async "7"() {
    run("node checker/check.mjs");
  },
  async "8"() {
    run("docker compose logs --tail=60 portal");
  },
  async "9"() {
    run("docker compose ps");
  },
};

function menu() {
  console.log(bold("\n━━ Module 1 · Identity & Access ━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(`  ${bold("1")}  Start            ${dim("(build + up, then show login)")}`);
  console.log(`  ${bold("2")}  Stop`);
  console.log(`  ${bold("3")}  Restart app      ${dim("(reload after editing the fix)")}`);
  console.log(`  ${bold("4")}  Reseed data      ${dim("(fresh data, no rebuild — fast)")}`);
  console.log(`  ${bold("5")}  Nuke & repave    ${dim("(the panic button)")}`);
  console.log(`  ${bold("6")}  Reset the fix    ${dim("(git restore src/)")}`);
  console.log(`  ${green(bold("7"))}  Check my work    ${dim("(run the exploit/fix verifier)")}`);
  console.log(`  ${bold("8")}  Logs`);
  console.log(`  ${bold("9")}  Status`);
  console.log(`  ${bold("0")}  Exit`);
}

async function main() {
  if (!haveDocker()) {
    console.log("Docker not found. Install Docker Desktop and try again.");
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    menu();
    const choice = (await rl.question(bold("\nChoose: "))).trim();
    if (choice === "0") break;
    const action = actions[choice];
    if (action) {
      await action();
    } else {
      console.log("Unknown option.");
    }
  }
  rl.close();
}

main();

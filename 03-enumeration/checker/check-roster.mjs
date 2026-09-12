// Module 3 — beat B demo checker (the patient-roster dump). Standalone so it can be
// SHOWN on its own, separate from the hands-on lab checker (check.mjs).
// Usage: node checker/check-roster.mjs   (or setup menu → "d")

const BASE = process.env.BASE ?? "http://localhost:3003";
const ATTACKER = { username: "andrej", password: "andrej12345" };

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const line = (ok, t) => console.log(`  ${ok ? green("✔") : red("✗")} ${t}`);

async function finish(code) {
  process.exitCode = code;
  try {
    const d = globalThis[Symbol.for("undici.globalDispatcher.1")];
    if (d && typeof d.close === "function") await d.close();
  } catch {
    /* best effort */
  }
}

async function main() {
  console.log(bold(`\nModule 3 — beat B: patient-roster enumeration (demo)`));
  console.log(dim(`Target: ${BASE}\n`));

  let cookie;
  try {
    const res = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ATTACKER),
    });
    if (!res.ok) throw new Error(`login failed (${res.status})`);
    cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
  } catch (e) {
    console.log(red(`Cannot reach the app: ${e.message}`));
    console.log(dim(`Start it first (setup menu → Start), then re-run.\n`));
    await finish(2);
    return;
  }

  // One request, absurd limit — try to drain the whole roster.
  const res = await fetch(`${BASE}/api/directory/patients?limit=100000&offset=0`, {
    headers: { Cookie: cookie },
  });
  const items = res.ok ? ((await res.json()).items ?? []) : [];
  const withDob = items.filter((p) => p.dateOfBirth).length;
  const dumped = res.ok && items.length > 200;

  console.log(bold("Exploit — dump every patient in one request"));
  if (dumped) {
    line(false, `Pulled ${items.length} patient records (${withDob} with date of birth) as a normal patient.`);
    const sample = items.slice(0, 3).map((p) => `${p.displayName} (${String(p.dateOfBirth).slice(0, 10)})`);
    console.log(dim(`      e.g. ${sample.join("; ")} …`));
    console.log(dim(`      → the entire patient identity list, exfiltrated in a single call.`));
  } else if (res.status === 403 || res.status === 404) {
    line(true, `The roster feed is not exposed to patients (HTTP ${res.status}).`);
  } else {
    line(true, `The roster feed no longer dumps everyone (${items.length} rows).`);
  }

  console.log("");
  if (dumped) {
    console.log(red(bold("❌ VULNERABLE — the patient roster is one request away.")));
    console.log(dim("   Fix is the same family as the appointments feed: scope it to staff,"));
    console.log(dim("   paginate with a cursor, cap the page size, and rate-limit."));
  } else {
    console.log(green(bold("✅ Roster is not freely enumerable.")));
  }
  console.log("");
  await finish(dumped ? 1 : 0);
}

main();

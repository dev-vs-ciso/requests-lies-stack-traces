// Module 2 checker. Attacks the API directly, Postman-style. Run it before you
// patch to confirm the leak; run it after to confirm errors no longer overshare.
// Usage: node checker/check.mjs   (or via the setup menu → "Check my work")

const BASE = process.env.BASE ?? "http://localhost:3002";
const ATTACKER = { username: "andrej", password: "andrej12345" };

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const PASS = green("✔");

function line(ok, text) {
  console.log(`  ${ok ? PASS : red("✗")} ${text}`);
}

async function finish(code) {
  process.exitCode = code;
  try {
    const d = globalThis[Symbol.for("undici.globalDispatcher.1")];
    if (d && typeof d.close === "function") await d.close();
  } catch {
    /* best effort */
  }
}

// Things that should NEVER appear in a client-facing error.
const LEAK_MARKERS = [
  ["Prisma", "the ORM's name"],
  ["Unknown argument", "the schema's valid field names"],
  ["node_modules", "internal dependency paths"],
  ["\n    at ", "a stack trace"],
  ["/app/", "server file paths"],
];

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ATTACKER),
  });
  if (!res.ok) throw new Error(`login failed (${res.status}) — is the app up on ${BASE}?`);
  const sid = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("sid="));
  if (!sid) throw new Error("no session cookie returned");
  return sid;
}

async function main() {
  console.log(bold(`\nModule 2 — Error Handling & Information Disclosure checker`));
  console.log(dim(`Target: ${BASE}\n`));

  let cookie;
  try {
    cookie = await login();
  } catch (e) {
    console.log(red(`Cannot reach the app: ${e.message}`));
    console.log(dim(`Start it first (setup menu → Start), then re-run.\n`));
    await finish(2);
    return;
  }

  // Trigger a server-side error the way the UI never would: an arbitrary sort field.
  const badRes = await fetch(`${BASE}/api/appointments?sort=__definitely_not_a_field__`, {
    headers: { Cookie: cookie },
  });
  const body = await badRes.text();

  const leaks = LEAK_MARKERS.filter(([m]) => body.toLowerCase().includes(m.toLowerCase()));

  // A valid request must still work after the fix (regression).
  const goodRes = await fetch(`${BASE}/api/appointments?sort=scheduledAt`, {
    headers: { Cookie: cookie },
  });
  const goodOk = goodRes.ok && (await goodRes.text()).length > 2;

  // Beat B — metadata disclosure via /api/status and the X-Powered-By header.
  const statusRes = await fetch(`${BASE}/api/status`);
  let statusBody = {};
  try {
    statusBody = await statusRes.json();
  } catch {
    /* not JSON */
  }
  const OVERSHARE_FIELDS = ["database", "node", "openssl", "platform", "env", "uptime"];
  const leakedFields = OVERSHARE_FIELDS.filter((f) => f in statusBody);
  const statusOvershares = statusRes.ok && leakedFields.length > 0;
  const poweredBy = statusRes.headers.get("x-powered-by");

  // Beat C — existence disclosure via 404-vs-403 on the item endpoint.
  const existOther = await fetch(`${BASE}/api/appointments/90003`, { headers: { Cookie: cookie } }); // Viktorija's
  const nonexist = await fetch(`${BASE}/api/appointments/99999999`, { headers: { Cookie: cookie } }); // no such id
  const existenceLeak = existOther.status !== nonexist.status;
  const ownApptRes = await fetch(`${BASE}/api/appointments/90004`, { headers: { Cookie: cookie } }); // Andrej's own
  const ownApptOk = ownApptRes.ok;

  console.log(bold("Beat 1 — verbose errors fingerprint the stack"));
  if (leaks.length) {
    console.log(dim(`      A malformed request returned an error that leaks:`));
    for (const [, desc] of leaks) line(false, desc);
  } else {
    line(true, `A malformed request returns a clean, generic error (${badRes.status}).`);
  }

  console.log(bold("\nBeat B — metadata / version disclosure"));
  if (statusOvershares) line(false, `/api/status leaks: ${leakedFields.join(", ")}`);
  else line(true, "/api/status returns a minimal response.");
  if (poweredBy) line(false, `X-Powered-By header present ("${poweredBy}").`);
  else line(true, "X-Powered-By header is gone.");

  console.log(bold("\nBeat C — existence disclosure (404 vs 403)"));
  if (existenceLeak) {
    line(false, `exists-but-forbidden (${existOther.status}) ≠ not-found (${nonexist.status}) — the status code confirms which ids are real.`);
  } else {
    line(true, `forbidden and not-found are indistinguishable (both ${existOther.status}).`);
  }

  console.log(bold("\nRegressions — legit requests still work"));
  line(goodOk, goodOk ? "Sorting by a real field still returns data." : "A valid sort no longer works (over-fixed).");
  line(ownApptOk, ownApptOk ? "Andrej can still read his own appointment." : "Andrej can NO LONGER read his own appointment (over-fixed).");

  const fixed = leaks.length === 0 && !statusOvershares && !poweredBy && !existenceLeak && goodOk && ownApptOk;
  const anyLeak = leaks.length > 0 || statusOvershares || !!poweredBy || existenceLeak;
  console.log("");
  if (fixed) {
    console.log(green(bold("✅ PATCHED — nothing overshares; valid requests intact.")));
  } else if (anyLeak) {
    console.log(red(bold("❌ VULNERABLE — the app still overshares. See the ✗ items above.")));
  } else {
    console.log(red(bold("⚠️  PARTIAL — see the ✗ items above.")));
  }
  console.log("");
  await finish(fixed ? 0 : 1);
}

main();

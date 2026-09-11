// Module 1 checker. Attacks the API directly (never the UI), the way Postman
// would. Run it before you patch to confirm the exploit; run it after to confirm
// the fix. Usage: node checker/check.mjs   (or via the setup menu → "Check my work")
//
// BASE can be overridden: BASE=http://localhost:3001 node checker/check.mjs

const BASE = process.env.BASE ?? "http://localhost:3001";

const ATTACKER = { username: "andrej", password: "andrej12345", id: 1 };
const VICTIM_ID = 2; // Viktorija
const TROPHY = "Advanced competitive napping"; // substring of Viktorija's private diagnosis
const VICTIM_NOTE_ID = 90002; // Viktorija's trophy visit note (fixed id)
const OWN_NOTE_ID = 90001; // Andrej's own visit note (fixed id)

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const PASS = green("✔");

function line(ok, text) {
  console.log(`  ${ok ? PASS : red("✗")} ${text}`);
}

// Exit cleanly. Calling process.exit() while an undici keep-alive socket is still
// closing can trigger a libuv assertion on Windows. Instead we set the exit code
// and close undici's connection pool so the event loop drains and Node exits on
// its own — no abrupt exit, no assertion.
async function finish(code) {
  process.exitCode = code;
  try {
    const dispatcher = globalThis[Symbol.for("undici.globalDispatcher.1")];
    if (dispatcher && typeof dispatcher.close === "function") await dispatcher.close();
  } catch {
    /* best effort; the process will still drain and exit */
  }
}

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ATTACKER.username, password: ATTACKER.password }),
  });
  if (!res.ok) throw new Error(`login failed (${res.status}) — is the app up on ${BASE}?`);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const sid = setCookies.map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
  if (!sid) throw new Error("no session cookie returned by /api/login");
  return { cookie: sid, token: sid.slice("sid=".length) };
}

async function main() {
  console.log(bold(`\nModule 1 — Identity & Access checker`));
  console.log(dim(`Target: ${BASE}\n`));

  let session;
  try {
    session = await login();
  } catch (e) {
    console.log(red(`Cannot reach the app: ${e.message}`));
    console.log(dim(`Start it first (setup menu → Start), then re-run.\n`));
    await finish(2);
    return;
  }

  // 1) IDOR: read the victim's private visit notes as the attacker.
  const idorRes = await fetch(`${BASE}/api/patients/${VICTIM_ID}/visit-notes`, {
    headers: { Cookie: session.cookie },
  });
  const idorBody = await idorRes.text();
  const gotTrophy = idorRes.ok && idorBody.includes(TROPHY);

  // 2) Regression: the attacker must still be able to read their OWN notes.
  const ownRes = await fetch(`${BASE}/api/patients/${ATTACKER.id}/visit-notes`, {
    headers: { Cookie: session.cookie },
  });
  const ownOk = ownRes.ok && (await ownRes.text()).length > 2; // non-empty array

  // 3) Query-string token: the ?session= sin. Send NO cookie.
  const qsRes = await fetch(`${BASE}/api/profile?session=${session.token}`);
  const qsAccepted = qsRes.ok;

  // 4) Nested-resource relationship (BOLA): use YOUR OWN parent id with the VICTIM's
  //    noteId. A plain ownership check on :patientId passes (patient 1 is you), so
  //    this stays open until the child is scoped to the parent.
  const nestedRes = await fetch(
    `${BASE}/api/patients/${ATTACKER.id}/visit-notes/${VICTIM_NOTE_ID}`,
    { headers: { Cookie: session.cookie } },
  );
  const nestedBody = await nestedRes.text();
  const nestedLeak = nestedRes.ok && nestedBody.includes(TROPHY);

  // 5) Regression: the attacker must still read their OWN note via the nested route.
  const ownNoteRes = await fetch(
    `${BASE}/api/patients/${ATTACKER.id}/visit-notes/${OWN_NOTE_ID}`,
    { headers: { Cookie: session.cookie } },
  );
  const ownNoteOk = ownNoteRes.ok && (await ownNoteRes.text()).includes("inbox anxiety");

  console.log(bold("Exploit — cross-patient access (IDOR)"));
  if (gotTrophy) {
    line(false, `Andrej read Viktorija's private notes: ${red('"' + TROPHY + '..."')}`);
    console.log(dim(`      → still VULNERABLE. Your fix must make this 403.`));
  } else {
    line(true, `Cross-patient read blocked (HTTP ${idorRes.status}).`);
  }

  console.log(bold("\nRegression — your own data still works"));
  line(ownOk, ownOk ? "Andrej can still read his own notes." : "Andrej can NO LONGER read his own notes (over-fixed).");

  console.log(bold("\nSin #1 — session token in the query string"));
  if (qsAccepted) {
    line(false, "?session=<token> is accepted (leaks into logs / history / Referer).");
    console.log(dim(`      → close this in src/session.ts (stop reading req.query.session).`));
  } else {
    line(true, "?session=<token> is rejected.");
  }

  console.log(bold("\nNested resource — ownership/relationship validation"));
  if (nestedLeak) {
    line(false, `Your own patient id + Viktorija's noteId (${VICTIM_NOTE_ID}) read her note.`);
    console.log(dim(`      → the ownership check on :patientId isn't enough. Scope the`));
    console.log(dim(`        note to the parent: findFirst({ where: { id, patientId } }).`));
  } else {
    line(true, `Foreign note under your own id is blocked (HTTP ${nestedRes.status}).`);
  }
  line(ownNoteOk, ownNoteOk ? "Andrej can still read his own note via the nested route." : "Andrej can NO LONGER read his own nested note (over-fixed).");

  const fixed = !gotTrophy && ownOk && !qsAccepted && !nestedLeak && ownNoteOk;
  const exploitable = gotTrophy || nestedLeak;

  console.log("");
  if (fixed) {
    console.log(green(bold("✅ PATCHED — access + ownership closed, own data intact, query-token rejected.")));
  } else if (exploitable) {
    console.log(red(bold("❌ VULNERABLE — cross-patient data is reachable. Patch it, then re-run.")));
  } else {
    console.log(red(bold("⚠️  PARTIAL — see the ✗ items above.")));
  }
  console.log("");
  await finish(fixed ? 0 : 1);
}

main();

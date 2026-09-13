// Module 5 checker — the capstone scoreboard. Probes the "agent-built" API for each
// planted vulnerability (synthesised from Modules 1–3) and prints which are still
// OPEN. Both hunt guide and fix verifier. Usage: node checker/check.mjs

const BASE = process.env.BASE ?? "http://localhost:3005";
const ATTACKER = { username: "andrej", password: "andrej12345" };
const TROPHY = "Advanced competitive napping"; // Viktorija's note (id 90002)

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

async function finish(code) {
  process.exitCode = code;
  try {
    const d = globalThis[Symbol.for("undici.globalDispatcher.1")];
    if (d && typeof d.close === "function") await d.close();
  } catch {
    /* best effort */
  }
}

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ATTACKER),
  });
  if (!res.ok) throw new Error(`login failed (${res.status})`);
  const sid = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
  return { cookie: sid, token: sid?.slice("sid=".length) };
}

const get = (path, cookie) => fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} });

async function main() {
  console.log(bold(`\nModule 5 — Capstone hunt · scoreboard`));
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
  const { cookie, token } = session;

  // 1) IDOR — read Viktorija's (id 2) private notes.
  const idorOpen = (await get(`/api/patients/2/visit-notes`, cookie).then((r) => (r.ok ? r.text() : ""))).includes(TROPHY);

  // 2) Nested BOLA — your own parent id + Viktorija's noteId (90002).
  const nestedOpen = (await get(`/api/patients/1/visit-notes/90002`, cookie).then((r) => (r.ok ? r.text() : ""))).includes(TROPHY);

  // 3) Session token in the query string.
  const qsOpen = (await get(`/api/profile?session=${token}`, null)).ok;

  // 4) Verbose error disclosure — arbitrary sort leaks internals.
  const errBody = await get(`/api/appointments?sort=__nope__`, cookie).then((r) => r.text());
  const errOpen = ["prisma", "unknown argument", "/app/", "\n    at ", "node_modules"].some((m) => errBody.toLowerCase().includes(m));

  // 5) Metadata disclosure — /api/status + X-Powered-By.
  const statusRes = await get(`/api/status`, cookie);
  let statusBody = {};
  try {
    statusBody = await statusRes.json();
  } catch {
    /* not json */
  }
  const metaOpen =
    ["database", "node", "openssl", "platform", "env", "uptime"].some((f) => f in statusBody) ||
    statusRes.headers.get("x-powered-by") != null;

  // 6) Existence disclosure — 404 (missing) vs 403 (exists, not yours).
  const existOther = await get(`/api/appointments/90003`, cookie); // Viktorija's
  const nonexist = await get(`/api/appointments/99999999`, cookie);
  const existenceOpen = existOther.status !== nonexist.status;

  // 7) Enumeration / unbounded page size — one request drains the feed.
  const feed = await get(`/api/directory/appointments?limit=100000&offset=0`, cookie);
  const feedCount = feed.ok ? ((await feed.json()).items ?? []).length : 0;
  const enumOpen = feedCount > 200;

  // 8) Wildcard CORS.
  const cors = await fetch(`${BASE}/api/health`, { headers: { Origin: "https://evil.example" } });
  const acao = cors.headers.get("access-control-allow-origin");
  const corsOpen = acao === "*" || acao === "https://evil.example";

  const findings = [
    ["IDOR — cross-patient record access", idorOpen],
    ["Nested BOLA — child not scoped to its parent", nestedOpen],
    ["Session token accepted in the query string", qsOpen],
    ["Verbose errors leak ORM / schema / paths", errOpen],
    ["Metadata disclosure (/api/status, X-Powered-By)", metaOpen],
    ["Existence disclosure (404 vs 403)", existenceOpen],
    ["Unbounded / unthrottled enumeration feed", enumOpen],
    ["Wildcard CORS reflects any origin with credentials", corsOpen],
  ];

  console.log(bold("Planted vulnerabilities"));
  for (const [name, open] of findings) {
    console.log(`  ${open ? red("✗ OPEN ") : green("✔ CLOSED")}  ${name}`);
  }

  const openCount = findings.filter(([, o]) => o).length;
  console.log("");
  if (openCount === 0) {
    console.log(green(bold("✅ ALL CLEAR — every planted vulnerability is closed.")));
  } else {
    console.log(red(bold(`❌ ${openCount}/${findings.length} still OPEN — keep hunting.`)));
    console.log(dim(`   Tip: the tests (npm test) are green the whole time. That's the lesson.`));
  }
  console.log("");
  await finish(openCount === 0 ? 0 : 1);
}

main();

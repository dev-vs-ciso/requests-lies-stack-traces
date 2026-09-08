// Module 5 checker — the capstone scoreboard. It probes the "agent-built" API for
// each planted vulnerability and prints which are still OPEN. It's both your hunt
// guide and your fix verifier. Usage: node checker/check.mjs

const BASE = process.env.BASE ?? "http://localhost:3005";
const ATTACKER = { username: "andrej", password: "andrej12345" };
const BURST = 30;

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
  const sid = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("sid="));
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

  // 1) IDOR — read Viktorija's (id 2) private notes as Andrej.
  const idorBody = await get(`/api/patients/2/visit-notes`, cookie).then((r) => (r.ok ? r.text() : ""));
  const idorOpen = idorBody.includes("Advanced competitive napping");

  // 2) Session token in the query string.
  const qsOpen = (await get(`/api/profile?session=${token}`, null)).ok;

  // 3) Error disclosure — arbitrary sort leaks internals.
  const errBody = await get(`/api/appointments?sort=__nope__`, cookie).then((r) => r.text());
  const errOpen = ["prisma", "unknown argument", "/app/", "\n    at "].some((m) =>
    errBody.toLowerCase().includes(m),
  );

  // 4) Enumeration — cross-patient offset feed with no rate limit.
  const feed = await get(`/api/directory/appointments?limit=5&offset=200`, cookie);
  let enumOpen = false;
  if (feed.ok) {
    const items = (await feed.json()).items ?? [];
    const others = items.some((i) => i.patientName && i.patientName !== "Андреј Аврамчевски");
    const burst = await Promise.all(
      Array.from({ length: BURST }, () => get(`/api/directory/appointments?limit=5`, cookie)),
    );
    const throttled = burst.filter((r) => r.status === 429).length;
    enumOpen = others && throttled === 0;
  }

  // 5) Wildcard CORS.
  const cors = await fetch(`${BASE}/api/health`, { headers: { Origin: "https://evil.example" } });
  const acao = cors.headers.get("access-control-allow-origin");
  const corsOpen = acao === "*" || acao === "https://evil.example";

  const findings = [
    ["IDOR — cross-patient record access", idorOpen],
    ["Session token accepted in the query string", qsOpen],
    ["Verbose errors leak ORM / schema / paths", errOpen],
    ["Unthrottled offset enumeration of everyone's data", enumOpen],
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
    console.log(dim(`   Tip: the tests are green the whole time. That's the lesson.`));
  }
  console.log("");
  await finish(openCount === 0 ? 0 : 1);
}

main();

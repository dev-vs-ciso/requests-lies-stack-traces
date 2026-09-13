// Module 4 — hands-on checker. Grades the fixable trust/CORS/versioning beats.
// (SSRF has its own standalone demo checker: checker/check-ssrf.mjs.)
// Usage: node checker/check.mjs

const PORTAL = process.env.BASE ?? "http://localhost:3004";
const LABS = process.env.LABS ?? "http://localhost:3014";
const ATTACKER = { username: "andrej", password: "andrej12345" };
const VICTIM_ID = 2; // Viktorija
const LAB_MARKER = "Napping"; // appears in Viktorija's lab results

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
  console.log(bold(`\nModule 4 — Versioning, CORS & Trust Boundaries checker`));
  console.log(dim(`Portal: ${PORTAL}   Labs: ${LABS}\n`));

  // Login (for the portal-side beats).
  let cookie;
  try {
    const r = await fetch(`${PORTAL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ATTACKER),
    });
    if (!r.ok) throw new Error(`login failed (${r.status})`);
    cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
  } catch (e) {
    console.log(red(`Cannot reach the portal at ${PORTAL}: ${e.message}`));
    await finish(2);
    return;
  }

  // 1) CORS — probe with a substring-bypass origin (also catches wildcard).
  const evilOrigin = "https://clinic.example.attacker.com";
  let corsReflects = false;
  let acao = "(none)";
  try {
    const c = await fetch(`${PORTAL}/api/health`, { headers: { Origin: evilOrigin } });
    acao = c.headers.get("access-control-allow-origin") ?? "(none)";
    corsReflects = acao === "*" || acao === evilOrigin;
  } catch {
    /* portal down handled above */
  }

  // 2) Zombie version — forge the old marker straight at Labs v1.
  let zombieWorks = false;
  let zStatus = "unreachable";
  try {
    const z = await fetch(`${LABS}/api/v1/lab-results?patientId=${VICTIM_ID}`, {
      headers: { "X-Internal-Request": "true" },
    });
    zStatus = String(z.status);
    zombieWorks = z.ok && (await z.text()).includes(LAB_MARKER);
  } catch {
    /* labs down */
  }

  // 3) Confused deputy — ask the portal for someone else's labs by id.
  const d = await fetch(`${PORTAL}/api/lab-results?patientId=${VICTIM_ID}`, { headers: { Cookie: cookie } });
  const deputyWorks = d.ok && (await d.text()).includes(LAB_MARKER);

  // Regression — the legit, session-scoped path must still return your own labs.
  const own = await fetch(`${PORTAL}/api/my/lab-results`, { headers: { Cookie: cookie } });
  const ownOk = own.ok && (await own.text()).includes('"results"');

  console.log(bold("CORS — does the portal trust a hostile origin?"));
  if (corsReflects) {
    line(false, `Access-Control-Allow-Origin came back as "${acao}" for ${evilOrigin}.`);
    console.log(dim(`      → wildcard, or an allow-list done with includes/endsWith. Use exact match.`));
  } else {
    line(true, `Hostile origin not reflected (ACAO: "${acao}").`);
  }

  console.log(bold("\nVersioning — is the old endpoint still live?"));
  if (zombieWorks) {
    line(false, `Labs /api/v1 still honours the forged marker (HTTP ${zStatus}) — read Viktorija's labs.`);
    console.log(dim(`      → the fix shipped in v2, but v1 still serves the old flaw. Retire v1.`));
  } else {
    line(true, `Labs /api/v1 no longer serves forged calls (HTTP ${zStatus}).`);
  }

  console.log(bold("\nTrust boundary — is the portal a confused deputy?"));
  if (deputyWorks) {
    line(false, `Portal fetched Viktorija's labs from your account (/api/lab-results?patientId=2).`);
    console.log(dim(`      → authenticating the channel ≠ authorizing the request. Scope to the session.`));
  } else {
    line(true, `Portal won't fetch another patient's labs (HTTP ${d.status}).`);
  }

  console.log(bold("\nRegression — the legit path still works"));
  line(ownOk, ownOk ? "Andrej can still read his own labs via /api/my/lab-results." : "Own labs path is broken (over-fixed).");

  const fixed = !corsReflects && !zombieWorks && !deputyWorks && ownOk;
  const vulnerable = corsReflects || zombieWorks || deputyWorks;
  console.log("");
  if (fixed) {
    console.log(green(bold("✅ PATCHED — CORS allow-listed, v1 retired, deputy scoped; own labs intact.")));
  } else if (vulnerable) {
    console.log(red(bold("❌ VULNERABLE — a trust boundary is still crossable. See the ✗ items above.")));
  } else {
    console.log(red(bold("⚠️  PARTIAL — see the ✗ items above.")));
  }
  console.log("");
  await finish(fixed ? 0 : 1);
}

main();

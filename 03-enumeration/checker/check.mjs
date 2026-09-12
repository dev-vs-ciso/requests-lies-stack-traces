// Module 3 checker. Attacks the API directly, Postman-style. Confirms the feed is
// an unthrottled cross-patient enumeration surface before the fix, and that a
// scripted burst gets throttled after it. Usage: node checker/check.mjs

const BASE = process.env.BASE ?? "http://localhost:3003";
const ATTACKER = { username: "andrej", password: "andrej12345" };
const BURST = 40;

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

const get = (path, cookie) => fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });

async function main() {
  console.log(bold(`\nModule 3 — Pagination, Rate Limiting & Enumeration checker`));
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

  // 1) Cross-patient enumeration via offset.
  const r0 = await get(`/api/directory/appointments?limit=5&offset=0`, cookie);
  const p0 = r0.ok ? await r0.json() : { items: [] };
  const r1 = await get(`/api/directory/appointments?limit=5&offset=200`, cookie);
  const p1 = r1.ok ? await r1.json() : { items: [] };

  const others = new Set(
    [...(p0.items ?? []), ...(p1.items ?? [])]
      .map((i) => i.patientName)
      .filter((n) => n && n !== "Андреј Аврамчевски"),
  );
  const offsetJumps = (p0.items?.[0]?.id ?? -1) !== (p1.items?.[0]?.id ?? -1);
  const enumerationWorks = r0.ok && (p0.items?.length ?? 0) > 0 && offsetJumps && others.size > 0;

  // 2) Unbounded page size (beat A): ask for an absurd limit; a capped endpoint
  //    ignores it. Run this BEFORE the burst so a rate limiter doesn't interfere.
  const bigRes = await get(`/api/directory/appointments?limit=100000&offset=0`, cookie);
  const bigItems = bigRes.ok ? ((await bigRes.json()).items ?? []).length : 0;
  const uncapped = bigItems > 200;

  // 3) Rate-limit burst: fire BURST requests at once, count throttled ones.
  const results = await Promise.all(
    Array.from({ length: BURST }, () => get(`/api/directory/appointments?limit=5&offset=0`, cookie)),
  );
  const throttled = results.filter((r) => r.status === 429).length;

  console.log(bold("Exploit — enumerate the clinic-wide feed"));
  if (enumerationWorks) {
    line(false, `Offset paging returns OTHER patients' appointments (${others.size}+ people seen in 10 rows).`);
    console.log(dim(`      → the whole clinic is a for-loop away.`));
  } else {
    line(true, `Cross-patient offset enumeration no longer works.`);
  }

  console.log(bold("\nPage size — is there a cap?"));
  if (uncapped) {
    line(false, `?limit=100000 returned ${bigItems} rows in a single request — no cap.`);
    console.log(dim(`      → a per-request rate limit can't help; cap the page size.`));
  } else {
    line(true, `An oversized ?limit is capped (${bigItems} rows returned).`);
  }

  console.log(bold("\nThrottle — a scripted burst"));
  if (throttled > 0) {
    line(true, `${throttled}/${BURST} requests got 429'd — the walk dies.`);
  } else {
    line(false, `${BURST}/${BURST} requests returned 200 — no rate limit at all.`);
    console.log(dim(`      → still VULNERABLE. Add cursor pagination + rate limiting.`));
  }

  const fixed = throttled > 0 && !enumerationWorks && !uncapped;
  const vulnerable = uncapped || (enumerationWorks && throttled === 0);
  console.log("");
  if (fixed) {
    console.log(green(bold("✅ PATCHED — enumeration closed, page size capped, bursts throttled.")));
  } else if (vulnerable) {
    console.log(red(bold("❌ VULNERABLE — the feed can still be drained. See the ✗ items above.")));
  } else {
    console.log(red(bold("⚠️  PARTIAL — see the ✗ items above (cursor pagination + rate limit + page cap).")));
  }
  console.log("");
  await finish(fixed ? 0 : 1);
}

main();

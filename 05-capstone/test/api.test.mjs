// The "agent's" test suite. Run it with the app up: node --test  (or npm test).
//
// Every test passes. Notice what they check: the happy path, and only the happy
// path. Andrej logs in and reads his OWN data. Nothing here sends another patient's
// id, a malformed sort, a hostile Origin, or a burst of requests — so none of the
// planted vulnerabilities is exercised, and the suite stays green while the API
// leaks everywhere. Green tests on agent-written code are not evidence of safety.

import { test } from "node:test";
import assert from "node:assert";

const BASE = process.env.BASE ?? "http://localhost:3005";
let cookie;

test("the service is up", async () => {
  const r = await fetch(`${BASE}/api/health`);
  assert.equal(r.status, 200);
});

test("a patient can log in", async () => {
  const r = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "andrej", password: "andrej12345" }),
  });
  assert.equal(r.status, 200);
  cookie = (r.headers.getSetCookie() ?? [])
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("sid="));
  assert.ok(cookie, "should set a session cookie");
});

test("the profile endpoint returns the logged-in user", async () => {
  const r = await fetch(`${BASE}/api/profile`, { headers: { Cookie: cookie } });
  const me = await r.json();
  assert.equal(me.username, "andrej");
});

test("a patient can read their own visit notes", async () => {
  const r = await fetch(`${BASE}/api/patients/1/visit-notes`, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(await r.json()));
});

test("a patient can list their own appointments", async () => {
  const r = await fetch(`${BASE}/api/patients/1/appointments`, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
});

test("the appointments feed returns a page", async () => {
  const r = await fetch(`${BASE}/api/directory/appointments`, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray((await r.json()).items));
});

test("a patient can open one of their appointments", async () => {
  const r = await fetch(`${BASE}/api/appointments/90004`, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
});

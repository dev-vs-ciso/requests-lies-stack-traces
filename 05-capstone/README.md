# Module 5 — Review Fatigue & the Production Placebo (Capstone)

> An API for Поликлиника „Плацебо" that "an agent built in an afternoon." The happy
> path works. The test suite is **green**. It also ships a stack of the exact bugs
> agents love. Your job: find them before it does.

## The setup

This app was assembled fast and it *looks* done. Prove it to yourself:

```bash
node setup.mjs        # 1) Start
npm test              # with the app up — every test passes ✅
```

Seven green tests. Ship it, right?

Now read what those tests actually check: Andrej logs in and reads **his own** data.
That's it. No test sends another patient's id, a malformed input, a hostile origin,
or a flood of requests. **Green tests on agent-written code are not evidence of
safety — they're evidence the happy path works.**

## The hunt

Turn the room loose. There are **eight** planted vulnerabilities in this one API —
a synthesis of Modules 1–3 (the multi-service beats from Module 4 need Labs, so
they're not here). Find and fix them. Your scoreboard:

```
setup → 7) Check my work
```

It lists each planted vuln as `OPEN` or `CLOSED`. Race to all-`CLOSED`:

```
✅ ALL CLEAR — every planted vulnerability is closed.
```

Hints, if a table stalls:

1. Can Andrej read patient **2**'s records? (`/api/patients/:id/visit-notes`)
2. Try your **own** id with someone else's noteId: `/api/patients/1/visit-notes/90002`.
3. Does the session token work in the **URL**? (`?session=`)
4. What does `GET /api/appointments?sort=nope` return?
5. What does `GET /api/status` hand out — and what's the `X-Powered-By` header?
6. Compare `GET /api/appointments/90003` with `/api/appointments/99999999` — same status?
7. `GET /api/directory/appointments?limit=100000` — how much comes back in one call?
8. What `Access-Control-Allow-Origin` comes back for a stranger's `Origin`?

The fixes are the ones from Modules 1–3: ownership + relationship checks and
cookie-only sessions (`src/routes/patients.ts`, `src/session.ts`); a generic error
handler + sort whitelist (`src/app.ts`, `src/routes/search.ts`); a minimal status
endpoint + `app.disable("x-powered-by")` (`src/routes/status.ts`, `src/app.ts`);
identical 404s for not-found/not-yours (`src/routes/appointments.ts`); cursor
pagination + page cap + rate limiting (`src/routes/directory.ts`; `express-rate-limit`
is installed); and an exact-match CORS allow-list (`src/app.ts`).

Keep `npm test` running as you go — watch it stay green while you close real holes.
That gap, between "tests pass" and "actually safe," is the whole module.

## The takeaway

Review fatigue is real, and agents produce reviewable-looking code at a rate no
human review process was designed for. The tests it writes cover what it built, not
what it broke. At scale, "the tests are green" becomes a production placebo. Someone
has to think like the attacker — today, that was you.

---

### Note for facilitators
The vulnerabilities here are hand-planted but agent-typical. If you'd rather run the
authentic version, replace this app with one an agent actually generates and keep
its transcript — showing the real prompt and the real sequential-id/`res.json(err)`
output lands even harder. (See the open decision in `docs/PLAN.md` §9.)

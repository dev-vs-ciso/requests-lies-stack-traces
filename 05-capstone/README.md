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

Five green tests. Ship it, right?

Now read what those tests actually check: Andrej logs in and reads **his own** data.
That's it. No test sends another patient's id, a malformed input, a hostile origin,
or a flood of requests. **Green tests on agent-written code are not evidence of
safety — they're evidence the happy path works.**

## The hunt

Turn the room loose. There are **five** planted vulnerabilities in this one API —
one from each theme you've seen today. Find and fix them. Your scoreboard:

```
setup → 7) Check my work
```

It lists each planted vuln as `OPEN` or `CLOSED`. Race to all-`CLOSED`:

```
✅ ALL CLEAR — every planted vulnerability is closed.
```

Hints, if a table stalls (they map to Modules 1–4):

1. Can Andrej read patient **2**'s records? (`/api/patients/:id/...`)
2. Does the session token work in the **URL**? (`?session=`)
3. What does `GET /api/appointments?sort=nope` return?
4. What does `GET /api/directory/appointments?limit&offset` return — and how fast can
   you ask?
5. What `Access-Control-Allow-Origin` comes back for a stranger's `Origin`?

The fixes are the same ones from Modules 1–4: ownership checks + cookie-only
sessions (`src/routes/patients.ts`, `src/session.ts`); a generic error handler +
sort whitelist (`src/app.ts`, `src/routes/search.ts`); cursor pagination + rate
limiting (`src/routes/directory.ts`; `express-rate-limit` is installed); and a CORS
allow-list (`src/app.ts`).

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

# Requests, Lies, and Stack Traces — Workshop Plan

**Designing APIs That Don't Leak in the Era of AI Coding**

4 hours · hands-on · TypeScript / Express · bring a laptop

> This is the working design doc. It captures every decision we've made, how each
> lab runs, the timing budget, and what's left to build. Edit freely — this is the
> single source of truth for both hosts.

---

## 1. The thesis (say this out loud in the intro)

Most REST "anti-patterns" aren't style crimes — they're **security bugs wearing a
best-practices costume**. Each one is a pattern that is perfectly defensible *in
some other project* and catastrophic *in this one*. We break it first, then fix it.

The second thread, running underneath every module: **the same handful of bugs now
show up constantly in AI-agent-written code, and not by accident.** Agents love
sequential IDs, write the auth check but skip the ownership check, pipe stack
traces straight into responses, and reach for wildcard CORS to make the red text go
away. Then they write tests that pass — because the tests only cover the happy path
they just built.

### Design principle that governs everything

Every planted vulnerability must be **"sensible elsewhere, fatal here."** Not
strawman bad-developer code. A competent engineer should look at each bug and think
*"I'd defend that in a different codebase"* — and that discomfort is the lesson. If
a vuln only looks dumb, we've written it wrong.

### Second principle: the UI is a decoy

**No vulnerability is reproducible from the frontend. All of them are trivial from
Postman.** Every app ships a small but *legit* frontend that does everything right:

- it reads your own id from a `/profile` (or `/me`) call and only ever requests
  *your own* resources — so there's no way to ask for Viktorija's record by clicking;
- it authenticates with the session cookie, never the `?session=` query param;
- it validates inputs client-side, so the malformed requests that trigger verbose
  errors never leave the browser;
- it paginates politely over your own small dataset, never the whole collection.

So a QA click-through finds nothing. The bug lives **at the API boundary**, where
curl and Postman don't obey the frontend's manners. This is the point we're
teaching: **the API is the attack surface, not the UI** — and it's also why the
happy-path tests and the manual UI test in Module 5 both lie to you. The checker
always attacks the **API directly**, Postman-style, never through the UI.

---

## 2. The shape of the workshop

- **Five self-contained victim apps**, one per module, in separate folders.
- **One shared business domain** — a clinic patient portal — so we never spend time
  re-explaining "what does the app do."
- **You break it, then you fix it**, in every hands-on module.
- Apps **ship vulnerable**. The fix is written live by attendees. Reset = `git restore`.
- Everything is **dockerised** and **re-pullable** — destruction is a feature. A
  wrecked app is one menu option away from pristine.

### Tone

**Absurd-but-safe.** The stakes are real (this is a HIPAA-reportable breach every
time), but the seed data is deadpan-funny — diagnoses like "acute meeting fatigue"
and "seasonal enthusiasm deficiency." People laugh while they exfiltrate. Keeps 4
hours of patient-data content from becoming a slog. Nothing cruel, nothing that
reads as a real condition attached to a real-sounding person.

---

## 3. Tech stack (unified across all five apps)

Participants learn the stack **once**.

| Layer        | Choice                    | Why |
|--------------|---------------------------|-----|
| Language     | TypeScript                | Per the brief; what agents emit. |
| Framework    | Express                   | Minimal, no magic hiding the bug. |
| Data layer   | Prisma                    | Loud, recognizable error output — ideal fingerprinting material for Module 2. Most common in agent-written TS. |
| Database     | SQLite                    | No separate DB container; a pre-seeded `.db` is one file, so reseed is instant and byte-identical for everyone. |
| Auth         | Session cookies           | Realistic; the query-string-token sin (Module 1) rides on top of it. |
| Runtime      | Docker (one compose/app)  | Isolation — a broken app 3 can't take down app 1. |
| Setup UX     | Node-based menu (`setup`) | One file, runs on Win/Mac/Linux, no bash-vs-PowerShell parity bugs. |
| Frontend     | Minimal legit UI per app  | The decoy (see §1). Does everything right, so the bug is invisible from the browser and only reachable via the API. Keep it tiny — server-rendered or a single static page + fetch. |

---

## 4. Shared domain, cast, and data

### Domain
A clinic patient portal. Entity spine, identical across apps:

- **patients** — the identity / IDOR target
- **appointments** — big enumerable collection (Module 3)
- **visit notes / diagnoses** — the juicy private payload (the trophy)
- **prescriptions** — bonus sensitive data
- **lab orders / lab results** — feeds the Module 4 service split

### Services
Single service everywhere **except Module 4**, which splits into **Portal ↔ Labs**.
Each service gets its **own** SQLite DB — the Portal never touches the Labs DB
directly, it *asks* the Labs service. Otherwise there's no trust boundary to break.

### Cast (fixed IDs, reused in every app)
Cyrillic display names, Latin usernames. Same login everywhere, so the muscle
memory transfers module to module.

| Role                | Display name        | Username    | ID | Notes |
|---------------------|---------------------|-------------|----|-------|
| **You (attacker)**  | Андреј Трајаноски   | `andrej`    | 1  | Participants log in as Andrej. Id 1, so the victim is literally "your id + 1". |
| **Victim (trophy)** | Викторија Петровска | `viktorija` | 2  | Her diagnosis is the prize. |
| **Provider**        | Д-р Стојановска     | `drstoj`    | 3  | So ownership isn't just patient-vs-patient. |

Bulk population fills in **around** the cast: ~10,000 patients, ~50,000
appointments.

### The data generator (critical detail)
- **Seeded PRNG → deterministic.** Every build in the room produces the
  byte-identical dataset. "Randomized-looking, deterministic-in-fact." Without
  this, the checker can't verify anything and you're debugging 20 unique databases.
- **Hero layer on top of bulk.** Cast records have fixed IDs and fixed data; the
  10k randoms never move them.
- **Generated once at Docker build → baked into a pristine `.db`.** Runtime just
  copies it. Reseed = copy pristine over working DB (instant). Nuke = rebuild.
- Names/addresses from a seeded faker; **diagnoses from a hand-authored
  funny-but-safe pool** (~50 entries) we fully control.

---

## 5. The `setup` menu (attendee home base)

One `node setup` per folder. Options:

1. **Start** — build + up, then print URLs + Andrej/Viktorija credentials.
2. **Stop** — down, keep data.
3. **Nuke & repave** — `down -v`, rebuild, reseed. The panic button.
4. **Reseed only** — reset data without a full rebuild (the one people actually hit
   mid-lab). Copies pristine `.db` over the working DB.
5. **Reset the fix** — `git restore` the vulnerable source so they can re-break, or
   a latecomer starts clean.
6. **Check my work** — runs the lab verifier (the "did I win?" oracle).
7. **Logs / status** — for "it's not working" without teaching Docker.

---

## 6. The modules

Each module: **~34 min** (see timing budget). Structure = *frame the vuln → break
it → fix it → 2-min debrief tying it to the AI-code thread.*

### Module 1 — Identity & Access (IDOR)
- **Sins:** tokens in query strings · guessable sequential IDs · missing ownership check.
- **Sensible elsewhere:** looking up a record by its URL id is *correct* in a
  single-tenant admin tool. Accepting a session token in `?session=` is how magic
  links and kiosk/QR check-in work. Both are fine — until this multi-tenant clinic.
- **The agent tell:** it wrote the auth middleware (you must be logged in ✓) and
  forgot the ownership check (…as *this* patient ✗).
- **UI decoy:** the portal reads Andrej's id from `/profile` and only ever fetches
  `/patients/<his own id>/…`. Clicking around, you can *only* see your own record.
  Nothing looks wrong.
- **Lab:** open Postman, log in as Andrej, then `GET /patients/2/visit-notes` →
  read Viktorija's private notes. The UI would never send that request; the API
  answers it happily. Notice your session token also works as `?session=` in the
  URL / logs. Then patch: add ownership scoping, stop honoring `?session=`.
- **Checker:** exploit returns Viktorija's trophy diagnosis (fail state) → after
  patch returns 403, **and** Andrej can still read his *own* notes (didn't over-fix).

### Module 2 — Error Handling & Information Disclosure
- **Sins:** stack traces in prod · error messages that overshare.
- **Sensible elsewhere:** verbose errors + echoing the DB error is *exactly right*
  in dev and internal tooling. Shipped to patients, they hand out your ORM, schema,
  and filesystem paths.
- **The agent tell:** `catch (e) { res.status(500).json(e) }` — ships the whole
  error object because that's what made local debugging easy.
- **UI decoy:** the frontend validates every field before submitting, so in normal
  use the error path never fires — the app looks rock-solid.
- **Lab:** from Postman, send the malformed/edge requests the UI would never send
  (wrong types, missing fields, oversized ids) to fingerprint the target's DB, ORM,
  and internal paths **from its errors alone**. Then patch: error boundary that
  logs internally, returns a generic shape + request id.
- **Checker:** responses no longer leak stack/paths/ORM markers; a real error still
  returns a usable generic error + logs server-side.

### Module 3 — Pagination, Rate Limiting & Enumeration
- **Sins:** offset pagination on sensitive data · no throttle.
- **Sensible elsewhere:** `?limit&offset` is the textbook pattern every tutorial
  teaches. On a sensitive collection with no rate limit, it's a bulk-exfiltration
  API you built *for* the attacker.
- **UI decoy:** the frontend only ever pages over *your own* appointments in small
  chunks — a handful of records, politely. It never reveals that the endpoint will
  happily serve everyone's if you ask directly.
- **Lab:** from a script/Postman, hit the same offset endpoint with no owner scope
  and walk all 50k appointments, finding the trophy buried deep (page ~40+, so
  page-1 browsing never finds it). Then add **cursor pagination + rate limiting**
  and watch the same script die.
- **Checker:** before — script harvests the deep trophy; after — cursor pagination
  + 429s make the harvest fail within the rate window.

### Module 4 — Versioning, CORS & Trust Boundaries
- **Sins:** wildcard CORS · breaking changes under the same version · services that
  trust each other for no reason.
- **Sensible elsewhere:** "internal services trust each other, skip auth between
  them" is a reasonable simplicity call behind a VPC. Wildcard CORS "made the error
  go away."
- **The setup:** Portal ↔ Labs. The Labs service believes whatever the Portal
  claims about who you are (a forged internal header — e.g. `X-User-Id` — reads
  anyone's results).
- **UI decoy:** through the browser you're same-origin and the Portal sets the
  internal header honestly from your session, so CORS and the trust header never
  misbehave. The attack is a direct cross-origin / Postman call that forges the
  header straight to the Labs service, or a malicious page exploiting wildcard CORS.
- **Format:** more demo-led + a **redesign exercise** — attendees mark up the
  security-relevant parts of a deliberately bad API spec.
- **Checker:** forged internal header no longer grants cross-patient lab results;
  CORS reflects only an allow-list.

### Module 5 — Review Fatigue & the Production Placebo
- **Point:** why green tests on agent-written code lie to you, and why the real
  risk is **scale**.
- **Format:** live capstone — hunt planted vulnerabilities in an "agent-built" API
  before it hunts you. This app carries a mix of Modules 1–4's sins plus the tests
  that pass anyway (happy-path only).
- **Open decision (see §9):** real agent transcripts vs. hand-planted-but-honest.

---

## 7. Timing budget (the brutal math)

240 min total. Realistic overhead:

| Block                          | Min |
|--------------------------------|-----|
| Setup / arrival / Docker check | 20  |
| Intro + thesis                 | 15  |
| Breaks (2×10)                  | 20  |
| Wrap-up + Q&A                  | 15  |
| **Left for 5 modules**         | **170 (~34 each)** |

34 min per module is a **speedrun** if every module is full break+fix+debrief. Our
mitigation:

- **Modules 1 and 3 are full hands-on** — people *must* feel IDOR and enumeration
  with their own hands.
- **Modules 2 and 4 lean demo-led** — host drives, attendees follow; Module 4 is
  the spec-redesign exercise, not a from-scratch patch.
- **Module 5 is the capstone** and eats any slack from earlier.

> **Facilitation reality:** if we're running behind after Module 2, cut Module 4's
> hands-on portion to demo-only and protect Module 5. Module 5 is the payoff; never
> sacrifice it.

---

## 8. Repo structure

```
requests-lies-stack-traces/
  README.md                      ← attendee guide
  package.json + setup.mjs       ← root launcher: `npm start` → pick a lab
  docs/
    PLAN.md                      ← this doc
    RUNNING-THE-WORKSHOP.md      ← facilitator run-of-show
  01-identity-access/            ← Module 1 (IDOR) — reference app, built first
    setup.mjs                    ← the menu
    docker-compose.yml
    Dockerfile
    prisma/schema.prisma
    src/…                        ← API, ships vulnerable
    public/ (or views/)          ← the decoy frontend — does everything RIGHT
    checker/                     ← "did I win?" verifier — attacks the API directly
    README.md                    ← lab instructions
  02-error-disclosure/
  03-enumeration/
  04-trust-boundaries/           ← Portal ↔ Labs (two services)
  05-capstone/
  shared/                        ← cast + funny-condition pool + generator, copied
                                   into each app by convention (not imported)
```

**Build order:** Module 1 end-to-end first as the **gold template** (Docker, menu,
seeded generator, cast, checker, vulnerable source, README). The other four are
clones with a different sin swapped in. One app done right beats five half-built.

---

## 9. Open decisions / TODO before the room

- [ ] **Module 5 authenticity** — do we use *real* agent transcripts (show the
      actual prompt and the actual sequential-ID it emitted — lands hardest) or
      hand-plant the agent-typical bugs and *call* it agent-built? Honest version
      is more powerful but messier to control. **Needs a call.**
- [ ] **Docker on attendee laptops** — confirm everyone can run Docker Desktop
      (Windows especially). Fallback plan if not? A hosted instance?
- [ ] **Attacker tooling** — raw `curl` vs. a thin provided harness where they fill
      in the 5 lines that matter. Leaning harness for Module 3's scripting.
- [ ] **Funny-condition pool** — draft ~50 entries; agree PG vs. mild-workplace-edge.
- [ ] **Specialty service split** — Module 4 escalation (service-by-specialty) if
      time allows; otherwise Portal ↔ Labs is enough.
- [ ] **Co-host division of labor** — who drives the demo modules vs. who walks the
      room during hands-on (see §10).

---

## 10. Notes for the co-host

- **Two-host rhythm:** one drives from the front (screen + narration), the other
  walks the room during hands-on modules catching stuck laptops. Swap the driver
  seat between modules so neither of us talks for 4 hours straight.
- **The reseed button is your friend.** When someone's app is wedged, don't debug
  their Docker — hit **Nuke & repave** and move on. Budget for this; it *will*
  happen.
- **The checker is the pace-keeper.** "Green checker = move on." It stops us from
  hand-inspecting 20 laptops to confirm each exploit/fix.
- **Protect Module 5.** It's the whole point. If we're behind, thin out Module 4,
  not the capstone.
- **Land the debrief every time.** The 2-minute "here's why an agent writes exactly
  this" after each lab is the through-line that makes this workshop *this* workshop
  and not a generic OWASP tour.
```

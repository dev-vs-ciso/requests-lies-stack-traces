# Running the Workshop — Facilitator Scenario

> The run-of-show for the day. [PLAN.md](PLAN.md) is the *why* and the design; this
> is the *what you do, minute by minute*. Two hosts assumed — call them **Driver**
> (front of room, screen + narration) and **Rover** (walks the room during
> hands-on). Swap roles between modules so neither talks for four hours.

---

## Before the day (do this, don't skip it)

- [ ] **Everyone installs the prerequisites in advance.** Send the [README](../README.md)
      a few days out. The single biggest time sink is people installing Docker in
      the room. Make "Docker Desktop running + `node setup.mjs` shows the portal"
      a pre-req, not a lab.
- [ ] **Pre-pull the base image on the room's network.** `docker pull
      node:24-bookworm-slim` on a few laptops first — the first build of Module 1
      downloads the base image and Prisma engines. On slow conference wifi this is
      the difference between a 2-minute and a 15-minute first build. Consider a
      USB stick or local registry as backup.
- [ ] **Both hosts do a full dry run** of every module the night before, on the
      actual laptops you'll demo from. Confirm the checker goes red→green.
- [ ] **Know the reset buttons cold** (see the cheat-sheet at the bottom). When a
      laptop is wedged, you nuke-and-repave and move on — you do not debug Docker
      in front of 20 people.

---

## Run-of-show (4:00 total)

| Clock       | Block                                   | Format        | Lead   |
|-------------|-----------------------------------------|---------------|--------|
| 0:00–0:20   | Arrival & setup check                   | Everyone      | Rover  |
| 0:20–0:35   | Intro & thesis                          | Talk          | Driver |
| 0:35–1:10   | **Module 1 — IDOR**                      | Hands-on      | Driver |
| 1:10–1:45   | **Module 2 — Error disclosure**         | Demo-led      | (swap) |
| 1:45–1:55   | Break                                   | —             | —      |
| 1:55–2:35   | **Module 3 — Enumeration**              | Hands-on      | (swap) |
| 2:35–3:05   | **Module 4 — CORS & trust boundaries**  | Demo + redesign | (swap)|
| 3:05–3:15   | Break                                   | —             | —      |
| 3:15–3:55   | **Module 5 — Capstone hunt**            | Hands-on      | (swap) |
| 3:55–4:00   | Wrap-up                                 | Talk          | Driver |

> **The one rule when you're behind:** protect Module 5. Thin Module 4 to
> demo-only, or cut its redesign exercise, before you touch the capstone. Module 5
> is the payoff the whole day builds toward.

---

## 0:00–0:20 · Setup check

Rover works the room; Driver puts the checklist on screen. Each person:

1. `git clone` the repo, then from the root run `npm start` → pick **Module 1** →
   **1) Start**.
2. Sees the portal at <http://localhost:3001> and can log in as `andrej`.
3. Runs **7) Check my work** and sees a red **❌ VULNERABLE**. That red is the goal
   — it means everything works.

Anyone still fighting Docker at 0:15 pairs up with a neighbour for Module 1. Don't
hold the room.

## 0:20–0:35 · Intro & thesis

Driver, ~15 min. Land three ideas, no more:

1. **Anti-patterns are security bugs in a best-practices costume.** Each thing on
   the "don't do this" list has a real cost when someone hostile is on the other
   end. We'll pay that cost on purpose, then fix it.
2. **"Sensible elsewhere, fatal here."** Every bug today is code a competent person
   would defend in a *different* project. That discomfort is the lesson.
3. **The AI-code thread.** These same bugs pour out of AI agents, and the tests
   agents write are green because they only cover the happy path the agent just
   built. We'll name why each default happens and then go find it.

Introduce the domain once: clinic patient portal, you're **Андреј**, the victim is
**Викторија**, and every "win" today is a HIPAA-reportable breach in real life.

---

## Module cards

Each module runs the same rhythm: **Frame → Break → Fix → Gate → Debrief.**

### Module 1 · Identity & Access (IDOR) · 0:35–1:10 · hands-on

- **Frame (4 min).** "Looking a record up by the id in the URL is *correct* in a
  single-tenant admin tool. Here it means any patient can read any other patient."
- **Break (12 min).** Everyone opens the UI first — click around, confirm you can
  only see your own data. *Then* switch to curl/Postman and pull Viktorija's notes
  (`/api/patients/2/visit-notes`). Rover helps stragglers; Driver demos on screen.
  Call out the session token sitting in `?session=` and in the logs.
- **Fix (12 min).** Two sins, both flagged in code comments: the missing ownership
  check (`src/routes/patients.ts`) and the query-string token (`src/session.ts`).
  Edit on the host; nodemon reloads in the container.
- **Gate.** Everyone runs **7) Check my work** until it's green
  (`✅ PATCHED`). The checker also proves they didn't *over*-fix (Andrej still reads
  his own notes).
- **Debrief (2 min).** "The agent wrote the auth check and stopped. Authentication
  is not authorization. The UI and the happy-path test both only ever fetch *your*
  record, so both lie to you." → transitions straight into Module 2.

### Module 2 · Error Handling & Information Disclosure · 1:10–1:45 · demo-led

- **Frame.** "Verbose errors that echo the DB exception are exactly right in dev
  and internal tools. Shipped to patients, they hand out your ORM, schema, and file
  paths." 
- **Break (demo, room follows).** Driver sends the malformed requests the UI would
  never send (wrong types, missing fields) and reads the leak: it's Prisma, it's
  SQLite, here are the internal paths. Attendees fingerprint along in Postman.
- **Fix.** An error boundary that logs internally and returns a generic shape +
  request id. 
- **Gate.** Checker: no stack/paths/ORM markers leak; a real error still returns a
  usable generic error and is logged server-side.
- **Debrief.** "`catch (e) { res.json(e) }` is what made local debugging easy — the
  agent never took it out."

### Module 3 · Pagination, Rate Limiting & Enumeration · 1:55–2:35 · hands-on

- **Frame.** "`?limit&offset` is the pattern every tutorial teaches. On a sensitive
  collection with no throttle, you built a bulk-exfiltration API for the attacker."
- **Break (15 min).** The UI pages politely over *your* handful of appointments.
  From a script, walk all ~50,000 and surface the trophy buried deep (page ~40+, so
  page-1 browsing never finds it). *(Attacker tooling — curl loop vs. provided
  harness — is a §9 decision; fill in here once locked.)*
- **Fix.** Cursor pagination + rate limiting. Re-run the same script and watch it
  die on 429s.
- **Gate.** Checker: before, the script harvests the deep trophy; after, cursor
  pagination + 429s make the harvest fail inside the rate window.
- **Debrief.** "Offset pagination plus no rate limit isn't two small misses — it's
  an enumeration endpoint. Scale is the vulnerability."

### Module 4 · Versioning, CORS & Trust Boundaries · 2:35–3:05 · demo + redesign

- **Frame.** "'Internal services trust each other' is a reasonable call behind a
  VPC. Wildcard CORS 'made the error go away.'"
- **Demo.** Portal ↔ Labs. Through the browser everything's honest (same-origin,
  Portal sets the identity header from your session). Then forge the internal
  header (`X-User-Id`) straight to the Labs service and read anyone's results.
- **Redesign exercise (the hands-on bit).** Hand out the deliberately-bad API spec;
  small groups mark up the security-relevant parts (trust boundary, CORS allow-list,
  versioning). Debrief the marked-up specs together.
- **Debrief.** "The boundary you don't enforce is the boundary the attacker uses."

### Module 5 · Review Fatigue & the Production Placebo · 3:15–3:55 · capstone

- **Frame.** "Green tests on agent code lie to you, and the real risk is scale."
- **The hunt.** Turn the room loose on an 'agent-built' API carrying a mix of the
  week's sins *plus a passing test suite*. First to find each planted vuln calls it.
  *(Real agent transcripts vs. hand-planted is a §9 decision — the real transcript
  version lands hardest; lock this before the day.)*
- **Debrief / close.** Tie it back: every bug they found today was defensible
  somewhere else, invisible from the UI, and green in the tests. That's the job now.

## 3:55–4:00 · Wrap-up

Driver: the one-sentence version of each module, where to take it (their own APIs),
and the repo link so they can re-run any lab at home.

---

## Contingency

- **Behind schedule?** Cut Module 4's redesign to a 5-minute group discussion; if
  still behind, Module 4 becomes a pure 8-minute demo. Never borrow from Module 5.
- **A laptop is wedged.** Rover hits **5) Nuke & repave** and moves on. Time-box any
  single laptop to 90 seconds.
- **The room's build is slow.** Fall back to pairing, or to the Driver's screen for
  that module (demo-only). Everyone can still do the fix on their own copy later.
- **Someone finishes early.** Point them at the other patient ids, or ask them to
  break the *fix* (can they still get through?).

## Facilitator cheat-sheet

| Thing            | Value |
|------------------|-------|
| Portal URL       | <http://localhost:3001> (Module 1; later modules increment) |
| You (attacker)   | `andrej` / `andrej12345` — patient **id 1** |
| Victim (trophy)  | Викторија Врангаловска — patient **id 2** |
| Provider         | `drstoj` / `drstoj12345` |
| Launch           | `npm start` in the repo root → pick a lab (or `node setup.mjs` in a module) |
| Panic reset      | menu **5) Nuke & repave** |
| Fast data reset  | menu **4) Reseed data** |
| Undo their fix   | menu **6) Reset the fix** |
| Verify           | menu **7) Check my work** |

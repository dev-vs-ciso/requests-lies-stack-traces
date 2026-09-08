# Requests, Lies, and Stack Traces

### Designing APIs That Don't Leak in the Era of AI Coding

A 4-hour, hands-on workshop. You'll take a clinic patient portal, **break it the way
a real attacker would**, then fix it — five times, once per anti-pattern. Most REST
"anti-patterns" turn out to be security bugs wearing a best-practices costume, and
the same handful now pour out of AI coding agents. We go hunting for them.

> **This is the attendee guide.** Facilitators: see
> [docs/RUNNING-THE-WORKSHOP.md](docs/RUNNING-THE-WORKSHOP.md). Full design:
> [docs/PLAN.md](docs/PLAN.md).

---

## Do this BEFORE the workshop

The number-one way to waste the first hour is installing software in the room.
Please arrive with all of this working:

1. **Docker Desktop** — installed and **running**. ([get it](https://www.docker.com/products/docker-desktop/))
   Verify: `docker run --rm hello-world` prints a welcome message.
2. **Node.js 20 or newer.** Verify: `node --version`.
3. **Git.** Verify: `git --version`.
4. **A REST client.** Either `curl` (already on macOS/Linux and modern Windows) or
   a GUI like [Postman](https://www.postman.com/), [Bruno](https://www.usebruno.com/),
   or the VS Code REST/Thunder Client extension. The labs give you `curl` commands;
   a GUI is nicer for poking around.
5. **A code editor** (VS Code is fine).
6. **Clone this repo:**
   ```bash
   git clone https://github.com/dev-vs-ciso/requests-lies-stack-traces.git
   cd requests-lies-stack-traces
   ```

### Confirm you're ready (2 minutes)

From the repo root:

```bash
npm start
```

Pick **Module 1** from the lab list, then **1) Start**. The first run builds the
image and seeds ~10,000 patients — give it a minute or two. When it's up:

- Open <http://localhost:3001> and log in as **`andrej` / `andrej12345`**.
- Back in the menu, pick **7) Check my work**. You should see a red
  **❌ VULNERABLE**. **That red is success** — it means the app is running and the
  first bug is live, ready for you to exploit.

If you got the red verdict, you're fully set up. 🎉

---

## How every lab works

Run **`npm start`** from the repo root to get a lab picker, then choose a module —
each one drops you into its own menu. (You can also `cd` into a module folder and
run `node setup.mjs` directly.) The rhythm is always the same:

1. **Look at the UI.** It behaves perfectly — you can only see your own data. This
   is the trap: **the app is safe from the browser, not from the API.**
2. **Break it from the API.** Using curl/Postman, do the thing the UI would never
   let you do. This is where the bug lives.
3. **Fix it.** Edit the source (the vulnerable spots are flagged in code comments).
   The app hot-reloads automatically.
4. **Prove it.** Run **Check my work**. Go from ❌ red to ✅ green — the checker
   confirms both that your fix works *and* that you didn't break the legit behavior.

### The cast (same in every module)

| Who | Login | Role |
|-----|-------|------|
| **You** — Андреј Аврамчевски | `andrej` / `andrej12345` | patient (the attacker), id 1 |
| **Викторија Врангаловска** | `viktorija` / `viktorija12345` | patient — **her records are the prize**, id 2 |
| Д-р Стојановска | `drstoj` / `drstoj12345` | provider |

The patient data is randomized but deliberately absurd ("diagnosis: chronic
sarcasm") — real stakes, unreal data.

### The setup menu

| Option | What it does |
|--------|--------------|
| **1) Start** | Build + run, then show you the URL and logins |
| **2) Stop** | Shut it down (keeps nothing running) |
| **3) Restart app** | Reload the app (use if a code change doesn't take) |
| **4) Reseed data** | Fresh data, fast — if you mangled the database |
| **5) Nuke & repave** | Everything's on fire; rebuild from scratch |
| **6) Reset the fix** | Restore the original vulnerable code (start over / re-break) |
| **7) Check my work** | Run the exploit/fix verifier |
| **8) Logs** / **9) Status** | See what the app is doing |

**You cannot permanently break anything.** If a lab gets wedged, **5) Nuke &
repave** returns it to a clean, identical starting state. Break things freely.

---

## The modules

1. **Identity & Access** — pull another patient's records through an IDOR bug, then
   patch it. *(built)*
2. **Error Handling & Information Disclosure** — fingerprint the app's database, ORM,
   and internal paths from its error messages alone.
3. **Pagination, Rate Limiting & Enumeration** — script an attack that walks a
   sensitive collection, then kill it with cursor pagination and rate limiting.
4. **Versioning, CORS & Trust Boundaries** — forge trust between services and
   redesign the security-relevant parts of a bad API spec.
5. **Review Fatigue & the Production Placebo** — hunt planted vulnerabilities in an
   "agent-built" API whose tests are all green.

---

## Troubleshooting

- **"Cannot reach the app" from the checker** → the app isn't up. Menu **1) Start**,
  wait for it to say it's listening, then re-check.
- **Port 3001 already in use** → something else (or an old run) is on that port.
  Menu **2) Stop**, or stop the other process, then **1) Start**.
- **My code change didn't take effect** → menu **3) Restart app**.
- **The data looks wrong / I deleted something** → menu **4) Reseed data**.
- **Total confusion** → menu **5) Nuke & repave**, then **6) Reset the fix** to get
  original code back too.
- **Docker build is very slow the first time** → it's downloading the base image and
  database engine once; later starts are fast.

---

> ⚠️ **These apps are intentionally insecure, for teaching.** Do not deploy them,
> expose them to the internet, or copy their code into anything real.

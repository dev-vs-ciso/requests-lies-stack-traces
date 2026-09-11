# Module 2 — Error Handling & Information Disclosure

> Поликлиника „Плацебо" patient portal, again — but this time access control is
> already correct. It ships **deliberately vulnerable** in a different way: it
> overshares. You'll fingerprint the stack, read off its versions, and map which
> records exist — all from what the app volunteers — then make it stop.

## The story

You're a logged-in patient (`andrej / andrej12345`). You can't read anyone else's
records here — that hole is closed. But the app is chatty when things go wrong, and
"things go wrong" is entirely under your control.

## Run it

```bash
node setup.mjs
```

Pick **1) Start**, then open <http://localhost:3002> and log in.

## Part A — the UI never errors (that's the decoy)

Click around. Every request the frontend makes is well-formed, so you never see an
error. The app looks bulletproof. It isn't — you just have to stop playing by the
frontend's rules.

## Part B — break it (three ways it overshares)

Log in and keep the cookie:

```bash
curl -i -c cookies.txt -X POST http://localhost:3002/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"andrej","password":"andrej12345"}'
```

### 1. Verbose errors fingerprint the stack

There's a sortable endpoint: `GET /api/appointments?sort=<field>`. The UI only ever
sends `sort=scheduledAt`. Send something else:

```bash
curl -b cookies.txt "http://localhost:3002/api/appointments?sort=notafield"
```

From that single error you learn the **ORM** (Prisma), the **schema** (it lists the
valid field names you could sort by), and the **internal layout** (absolute
`/app/...` paths and `node_modules` in the stack) — a map of the target, no real
record touched.

### 2. Metadata leaks — no error required

An ops endpoint overshares all on its own:

```bash
curl -s http://localhost:3002/api/status
curl -sI http://localhost:3002/api/health | grep -i x-powered-by
```

`/api/status` hands out Node/OpenSSL versions, the platform, and the
**`DATABASE_URL`** (the DB engine and its on-disk path); the `X-Powered-By: Express`
header confirms the framework. That's a version shopping-list for known-CVE attacks.

### 3. Error *semantics* leak existence

Ask for a single appointment that isn't yours, then one that doesn't exist:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt http://localhost:3002/api/appointments/90003    # Viktorija's → 403
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt http://localhost:3002/api/appointments/99999999 # no such id  → 404
```

Access is correctly denied either way — but `403` vs `404` tells you *which
appointment ids are real*. Walk the ids and you've mapped how many records exist and
roughly whose, without reading a single one.

Run **setup → 7) Check my work** to see all three enumerated in red.

### Why an agent writes exactly this
`res.status(500).json(err)` makes local debugging pleasant; a `/status` endpoint
that "shows what's deployed" is handy; `404`-vs-`403` is just *correct* HTTP. Each
is defensible in isolation, none is covered by the happy-path tests, and together
they hand over your whole blueprint.

## Part C — fix it

All flagged in code comments:

1. **Leaky error handler** — `src/app.ts`. Log the real error *server-side*; return
   a generic shape (a short message + a `requestId`). Never send `err.stack`,
   `err.name`, or ORM text.
2. **Arbitrary sort** — `src/routes/search.ts`. Whitelist the fields a client may
   sort by, so nothing unexpected reaches Prisma.
3. **Oversharing status endpoint** — `src/routes/status.ts`. Return a bare
   `{ status: "ok" }` (keep real diagnostics behind auth). And in `src/app.ts`, add
   `app.disable("x-powered-by")`.
4. **Existence disclosure** — `src/routes/appointments.ts`. Make "not yours" and
   "not found" indistinguishable — return `404` for both.

Edit on your machine — the container hot-reloads (nodemon). Then run
**setup → 7) Check my work**. You want:

```
✅ PATCHED — nothing overshares; valid requests intact.
```

## Reset / rescue

- **6) Reset the fix** — restore the original vulnerable code.
- **5) Nuke & repave** — rebuild from scratch.

## The takeaway

An error message is an API response. In prod it should tell the client *that* it
failed and give you a handle to investigate — never *how* it failed. Verbose errors
are a gift to the person mapping your attack surface.

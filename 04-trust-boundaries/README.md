# Module 4 — Versioning, CORS & Trust Boundaries

> Two services this time: the **Portal** (the patient app) and a separate **Labs**
> service that stores lab results. The Portal asks Labs for your results. Both ship
> **deliberately vulnerable**: the Portal has wildcard CORS, and Labs trusts anyone
> who *looks* internal.

## The story

You're a logged-in patient (`andrej / andrej12345`). Your lab results come from the
Labs service, which the Portal calls on your behalf. Labs was built assuming "only
the Portal can reach me, and only from inside the network" — so it just trusts a
header that says so.

## Run it

```bash
node setup.mjs
```

Pick **1) Start** (builds both services).

- Portal: <http://localhost:3004>  (log in as `andrej / andrej12345`)
- Labs: <http://localhost:3014>  — pretend this is internal-only. It isn't.

## Part A — the legit path

Logged into the Portal, `GET /api/my/lab-results` returns *your* results. Behind the
scenes the Portal calls `http://labs:3000/lab-results?patientId=<you>` with a header
`X-Internal-Request: true`. Same-origin, honest, boring.

## Part B — break it

**1) Forge the trust boundary.** The Labs port is reachable, and its "are you the
portal?" check is just a guessable header. Set it yourself and ask for someone else:

```bash
curl -H "X-Internal-Request: true" "http://localhost:3014/lab-results?patientId=2"
```

That's **Викторија's** labs (look for `[TROPHY: ...]`). Change `patientId` to read
anyone. Network position was never identity.

**2) Wildcard CORS.** The Portal reflects any `Origin` and allows credentials:

```bash
curl -s -D - -o /dev/null -H "Origin: https://evil.example" http://localhost:3004/api/health | grep -i access-control
```

`Access-Control-Allow-Origin: https://evil.example` means any site your logged-in
users visit can call this API with their cookies and read the responses.

Run **setup → 7) Check my work** to see both confirmed in red.

### Why an agent writes exactly this
"Services are internal, they can trust each other" removes a whole class of annoying
auth plumbing, and wildcard CORS is the top Stack Overflow answer for "CORS error."
Both make the red text go away, and the happy-path tests never send a hostile origin
or a forged header.

## Part C — fix it

1. **Authenticate the caller, not its vibe** — `labs/src/server.ts`. Require a shared
   secret only the Portal holds (`X-Internal-Token === INTERNAL_TOKEN`), and update
   `portal/src/routes/labs.ts` to send it. (A signed, short-lived token is better
   still.)
2. **Allow-list CORS** — `portal/src/app.ts`. Reflect an `Origin` only if it's the
   portal's own, and never pair `*` with credentials.

Then **setup → 7) Check my work**:

```
✅ PATCHED — Labs authenticates the caller and CORS is allow-listed.
```

## Bonus (facilitator-led): the redesign exercise

With the code fresh in mind, mark up the security-relevant parts of a bad API spec —
the trust boundary, the CORS policy, and versioning (breaking changes shipped under
the same version). Discuss as a group.

## The takeaway

The boundary you don't enforce is the boundary the attacker uses. "Internal" is a
network fact, not an identity — services must authenticate each other, and CORS is
an allow-list, never a mirror.

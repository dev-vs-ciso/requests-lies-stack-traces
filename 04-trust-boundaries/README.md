# Module 4 — Versioning, CORS & Trust Boundaries

> **Three** services this time. The **Portal** (patient app, public), a **Labs**
> service that stores results, and an internal-only **integrations** service holding
> the clinic's outbound secrets. The portal talks to both. Everything ships
> **deliberately vulnerable** — and the bugs are all about one thing: *who trusts
> whom, and why they shouldn't.*

## The services

| Service | Port | Notes |
|---|---|---|
| **portal** | `3004` | public patient app; calls Labs on your behalf |
| **labs** | `3014` | results store; "internal" but published so you can poke it |
| **integrations** | *(none)* | **not published** — internal-only, holds secrets. Reachable only from inside the network. |

## Run it

```bash
node setup.mjs      # 1) Start  (builds all three)
```

Log in at <http://localhost:3004> as `andrej / andrej12345`.

## Part A — the legit path (decoy)

`GET /api/my/lab-results` returns *your* results. The portal calls Labs' **v2**
endpoint, authenticated with a shared secret, and asks only for your own id.
Same-origin, honest, boring. Everything below is off that happy path.

## Part B — break it

### 1. The zombie API version (versioning)

Labs' `v2` is the *fixed* endpoint — it wants a shared secret you don't have. But
the **old `v1` is still deployed**, and v1 trusts a guessable "internal" marker:

```bash
curl -H "X-Internal-Request: true" "http://localhost:3014/api/v1/lab-results?patientId=2"
```

That's **Викторија's** labs. The team fixed it in v2 and left v1 running for
backward compat — so the attacker just calls v1. *A fix behind a version number
isn't a fix while the old version still serves traffic.*

### 2. The confused deputy (trust boundary)

Fine — Labs v2 now trusts only the portal (with the secret). But the portal will
forward *your* `patientId` to Labs using that secret, with no ownership check:

```bash
curl -b cookies.txt "http://localhost:3004/api/lab-results?patientId=2"
```

Still Викторија's labs — fetched by the trusted portal, for you. Authenticating the
**channel** between services is not authorizing the **request** over it. You fixed
Labs; the deputy still betrays it.

### 3. Wildcard CORS (and the allow-list that isn't)

The portal reflects any `Origin` with credentials:

```bash
curl -s -D - -o /dev/null -H "Origin: https://clinic.example.attacker.com" \
  http://localhost:3004/api/health | grep -i access-control
```

Any site your logged-in patients visit can call the API with their cookies. Note the
probe origin: `clinic.example.attacker.com`. It's chosen on purpose — the naive
"fix," `origin.includes("clinic.example")`, lets it straight through. An allow-list
is only as good as its comparison.

### 4. SSRF into the internal network (demo)

The portal has an "import from external lab" feature that fetches a URL you give it.
The portal lives *inside* the network, so make it fetch what you can't:

```bash
curl -b cookies.txt -X POST http://localhost:3004/api/labs/import \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://integrations:3000/config"}'
```

You just pulled the clinic's `insuranceApiKey` and friends out of a service that
isn't even published to the host. This is its own demo checker:

```bash
node checker/check-ssrf.mjs      # or: setup → d
```

Run **setup → 7) Check my work** for beats 1–3; use **d** for the SSRF demo.

### Why an agent writes exactly this
"Services are internal, they trust each other"; "keep v1 for compat"; wildcard CORS
is the top answer for "CORS error"; "fetch the URL the user gave us." Each is
ordinary and defensible on its own — and none is exercised by the happy-path tests.

## Part C — fix it

1. **Retire the zombie** — `labs/src/server.ts`. Remove `v1`, or make it require the
   same shared secret as `v2`. A version is an attack surface; audit *all* of them.
2. **Scope the deputy** — `portal/src/routes/labs.ts`. `/api/lab-results` must use
   the session id, never a caller-controlled one (i.e. behave like `/my/lab-results`).
3. **Allow-list CORS** — `portal/src/app.ts`. Exact-match against known origins;
   never `*` with credentials, never `includes`/`endsWith`.
4. **Constrain egress (SSRF)** — `portal/src/routes/labs.ts`. Allow-list the outbound
   host; reject internal hostnames/IPs (ideally don't let user input pick the host).

Then **setup → 7) Check my work**:

```
✅ PATCHED — CORS allow-listed, v1 retired, deputy scoped; own labs intact.
```

(SSRF is graded by `check-ssrf.mjs`.)

## Bonus (facilitator-led): the redesign exercise

Mark up the security-relevant parts of a bad API spec — trust boundaries, CORS,
versioning, and egress — and discuss what a defensible architecture looks like.

## The takeaway

The boundary you don't enforce is the boundary the attacker uses. "Internal" is a
network fact, not an identity; a version number isn't a fix; a trusted deputy is
still you; and a server that fetches arbitrary URLs is a door into everything behind
it. Services must authenticate *and* authorize each other — and never assume the
network is the perimeter.

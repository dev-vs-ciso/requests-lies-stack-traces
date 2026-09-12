# Module 3 — Pagination, Rate Limiting & Enumeration

> Поликлиника „Плацебо" again — access control and errors are fine here. This app's
> sin is a clinic-wide appointments feed with **offset pagination and no rate
> limit**. You'll script a walk over all ~50,000 records to find a trophy buried
> deep, then add cursor pagination + rate limiting and watch your own script die.

## The story

You're a logged-in patient (`andrej / andrej12345`). There's an internal
appointments feed — meant for staff, but any logged-in account can hit it. It pages
with `?limit&offset` and nobody's counting how fast you ask.

## Run it

```bash
node setup.mjs
```

Pick **1) Start**, then open <http://localhost:3003> and log in.

## Part A — the UI only shows your own (decoy)

The portal shows *your* appointments, a handful at a time. It never hints that the
feed behind it will serve everyone's if you ask directly.

## Part B — break it (enumerate)

Log in, then page the clinic-wide feed:

```bash
curl -i -c cookies.txt -X POST http://localhost:3003/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"andrej","password":"andrej12345"}'

curl -b cookies.txt "http://localhost:3003/api/directory/appointments?limit=50&offset=0"
```

Those are other patients' appointments. `offset` lets you jump anywhere; there's no
throttle. So walk the whole thing and grep for the trophy — a VIP appointment
buried near the end (look for `[TROPHY: ...]`):

```bash
# crude enumeration loop
for off in $(seq 0 50 60000); do
  curl -s -b cookies.txt "http://localhost:3003/api/directory/appointments?limit=50&offset=$off" \
  | grep -o "\[TROPHY:[^]]*\]" && break
done
```

### One request is enough (no page cap)

You don't even have to loop. The endpoint honours whatever `limit` you send:

```bash
curl -s -b cookies.txt "http://localhost:3003/api/directory/appointments?limit=100000" | wc -c
```

The whole table comes back in a single response. A per-request rate limit is useless
against this — it's *one* request. Pagination without a maximum page size isn't a
control; it's a convenience the attacker declines.

Run **setup → 7) Check my work** — it confirms cross-patient enumeration, the
missing page cap, and the missing throttle.

### Why an agent writes exactly this
`?limit&offset` is the pagination every tutorial shows, and "add a rate limiter"
is never in the acceptance criteria. The happy-path test fetches page 1 and passes.

## Part C — fix it

In `src/routes/directory.ts`, apply the three cures:

1. **Cursor pagination** — accept `?cursor=<lastId>&limit=` and use Prisma's
   `cursor`/`skip: 1`/`take`, instead of `offset`. No more cheap random access;
   pages must be walked in order.
2. **Cap the page size** — clamp `limit` to a hard maximum (e.g.
   `Math.min(limit, 100)`), so one request can't drain the whole table.
3. **Rate limiting** — `express-rate-limit` is already installed. Wrap the route
   (e.g. 30 requests/minute per IP) so a scripted walk gets `429`'d.

   ```ts
   import rateLimit from "express-rate-limit";
   const feedLimiter = rateLimit({ windowMs: 60_000, limit: 30 });
   directoryRouter.get("/directory/appointments", requireAuth, feedLimiter, handler);
   ```

Re-run your enumeration loop from Part B — it should stall on `429`s. Then
**setup → 7) Check my work**:

```
✅ PATCHED — enumeration closed, page size capped, bursts throttled.
```

## Bonus demo (facilitator) — the patient roster

Same bug, juicier target. A second feed, `GET /api/directory/patients`, pages the
entire patient roster — names, usernames, **dates of birth**. One request
exfiltrates every identity the clinic holds:

```bash
curl -s -b cookies.txt "http://localhost:3003/api/directory/patients?limit=100000" | head -c 400
```

It has its own checker so you can show it standalone:

```bash
node checker/check-roster.mjs      # or: setup → d
```

This is the "scale IS the vulnerability" beat: the fix is identical (scope to staff,
cursor + cap + rate-limit), but the point is the blast radius — not appointment
reasons, the raw identity list.

## Reset / rescue

- **6) Reset the fix** — restore the original vulnerable code.
- **5) Nuke & repave** — rebuild from scratch.

## The takeaway

Offset pagination plus no rate limit isn't two small oversights — together they're
an enumeration endpoint. On sensitive collections, the vulnerability *is* scale.

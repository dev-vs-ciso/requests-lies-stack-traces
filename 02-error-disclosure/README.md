# Module 2 — Error Handling & Information Disclosure

> Поликлиника „Плацебо" patient portal, again — but this time access control is
> already correct. It ships **deliberately vulnerable** in a different way: its
> errors overshare. You'll fingerprint the whole stack from error messages alone,
> then make them shut up.

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

## Part B — break it (make it talk)

There's a sortable endpoint: `GET /api/appointments?sort=<field>`. The UI only ever
sends `sort=scheduledAt`. Send something else:

```bash
curl -i -c cookies.txt -X POST http://localhost:3002/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"andrej","password":"andrej12345"}'

curl -b cookies.txt "http://localhost:3002/api/appointments?sort=notafield"
```

Read the response. From that single error you learn:

- **the ORM** — it's Prisma (the exception class and message say so);
- **the schema** — the error helpfully lists the *valid* field names you could have
  sorted by;
- **the internal layout** — the stack trace carries absolute `/app/...` file paths
  and `node_modules` internals;
- and with a little more poking, the database driver underneath.

You now have a map of the target without ever touching a real record. Run
**setup → 7) Check my work** to see the leak enumerated in red.

### Why an agent writes exactly this
`res.status(500).json(err)` (or returning `err.stack`) is what makes local
debugging pleasant, and the happy-path tests never hit the error branch — so it
sails through review and ships.

## Part C — fix it

Two things, both flagged in comments:

1. **The leaky error handler** — `src/app.ts`. Log the real error *server-side*,
   and return a generic shape to the client — a short message plus a `requestId`
   you can correlate with the logs. Never send `err.stack`, `err.name`, or ORM text.
2. **The root cause** — `src/routes/search.ts`. Don't pass an arbitrary `?sort`
   straight into Prisma; whitelist the fields a client is allowed to sort by.

Edit on your machine — the container hot-reloads (nodemon). Then run
**setup → 7) Check my work**. You want:

```
✅ PATCHED — errors no longer overshare, valid requests intact.
```

## Reset / rescue

- **6) Reset the fix** — restore the original vulnerable code.
- **5) Nuke & repave** — rebuild from scratch.

## The takeaway

An error message is an API response. In prod it should tell the client *that* it
failed and give you a handle to investigate — never *how* it failed. Verbose errors
are a gift to the person mapping your attack surface.

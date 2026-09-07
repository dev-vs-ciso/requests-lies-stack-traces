# Module 1 — Identity & Access (IDOR)

> Clinic „Аурора" patient portal. It ships **deliberately vulnerable**. You'll pull
> another patient's private medical notes through the API, then patch it.

## The story

You are **Бојан Трајаноски** (`bojan`), a patient. Your neighbour in the waiting
room is **Ана Петровска** — patient **id 2**. Her visit notes are private. By the
end of this lab you'll have read them, and then made that impossible.

## Run it

```bash
node setup.mjs
```

Pick **1) Start**. First run builds the image and seeds ~10,000 patients and
~50,000 appointments (takes a minute). When it's up you'll get the URL and logins.

- Portal UI: <http://localhost:3001>
- You: `bojan / bojan12345`

## Part A — look around the UI (it's a decoy)

Log in at <http://localhost:3001> and click around. You can see **your own** notes
and appointments — and nothing else. There's no field to type another patient's id.
The UI reads *your* id from `/api/profile` and only ever asks for your own records.

**Conclusion: from the browser, everything looks fine.** That's the trap.

## Part B — break it (from the API, like Postman/curl)

The UI plays by the rules. `curl` doesn't. First, log in and keep the cookie:

```bash
curl -i -c cookies.txt -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"bojan","password":"bojan12345"}'
```

Now ask for **Ana's** notes (patient id 2) — a request the UI would never send:

```bash
curl -b cookies.txt http://localhost:3001/api/patients/2/visit-notes
```

You just read another patient's private diagnosis. Try id `1`, `4`, `5`, `6`… the
ids are sequential, so the whole clinic is a `for` loop away. This is **IDOR**:
Insecure Direct Object Reference.

Two more things to notice:
- **The token in the URL.** The same session works as a query param — no cookie
  needed. Check your server logs (setup → **8) Logs**) and you'll see the token
  sitting in plaintext:
  ```bash
  curl "http://localhost:3001/api/profile?session=PASTE_TOKEN_HERE"
  ```
- Run **setup → 7) Check my work**. It confirms the exploit in red.

### Why an agent writes exactly this
It wrote the auth middleware — *"you must be logged in"* ✓ — and stopped. The
second half, *"…and this record must be yours,"* is a separate check it never
added. The happy-path test (fetch **my** record) passes, so nothing complains.

## Part C — fix it

Two sins to close. Both are called out in comments in the code:

1. **The missing ownership check** — `src/routes/patients.ts`. Before returning a
   patient's data, assert the requested `:id` belongs to the caller (allow
   providers/admins through). A helper sketch is in the file's comment.
2. **The query-string token** — `src/session.ts`. Stop honouring
   `req.query.session`; read the token from the cookie only.

Edit the files on your machine — the container hot-reloads (`tsx watch`). If a
change doesn't take, use setup → **3) Restart app**.

Then run **setup → 7) Check my work** again. You want:

```
✅ PATCHED — IDOR closed, own data intact, query-token rejected.
```

The checker also verifies you didn't *over*-fix: Bojan must still read his **own**
notes.

## Reset / rescue

- **6) Reset the fix** — restore the original vulnerable code (`git restore src/`).
- **4) Reseed data** — you mangled the data; get a fresh copy fast.
- **5) Nuke & repave** — everything is on fire; rebuild from scratch.

## The takeaway

Authentication (*who are you*) is not authorization (*may you touch this*). The UI
and the happy-path tests both only ever exercise "my own data," so both lie to you.
The API is the real attack surface.

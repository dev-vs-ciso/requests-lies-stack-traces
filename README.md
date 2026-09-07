# Requests, Lies, and Stack Traces

### Designing APIs That Don't Leak in the Era of AI Coding

A 4-hour, hands-on workshop. TypeScript / Express. You break it, then you fix it.

Most REST anti-patterns aren't style crimes — they're security bugs wearing a
best-practices costume. This workshop takes the usual list of "things you shouldn't
do" and shows what each one actually costs when someone hostile is on the other end.
Running underneath: the same handful of bugs now show up constantly in
AI-agent-written code, and not by accident.

## Structure

Five self-contained, dockerised victim apps — one per module — all sharing a single
domain (a clinic patient portal) so no time is lost re-learning "what does the app
do." Each app ships **deliberately vulnerable**; you exploit it, then patch it live.

1. **Identity & Access** — IDOR, tokens in query strings, the missing ownership check
2. **Error Handling & Information Disclosure** — stack traces and oversharing errors
3. **Pagination, Rate Limiting & Enumeration** — offset pagination and no throttle
4. **Versioning, CORS & Trust Boundaries** — wildcard CORS and services that over-trust
5. **Review Fatigue & the Production Placebo** — why green tests on agent code lie

## Getting started

Each module lives in its own folder with a `setup` menu (`node setup`) that builds,
runs, reseeds, and checks your work. See each module's README for the lab.

## Full design doc

See [docs/PLAN.md](docs/PLAN.md) for the complete workshop design, per-module lab
mechanics, timing budget, and facilitation notes.

---

> ⚠️ These apps are **intentionally insecure** for teaching. Do not deploy them,
> and do not reuse their code as a starting point for anything real.

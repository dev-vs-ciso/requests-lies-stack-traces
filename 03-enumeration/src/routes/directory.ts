import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const directoryRouter = Router();

// GET /api/directory/appointments?limit=&offset=
//
// A clinic-wide appointments feed. Any logged-in user can page through EVERY
// patient's appointments.
//
// ⚠️ PLANTED SINS (module 3 hands-on lab):
//
//   1. Offset pagination on a sensitive collection. `?limit&offset` is the pattern
//      every tutorial teaches — fine for a public product catalogue, here it turns
//      the whole clinic into a `for (offset = 0; ; offset += limit)` loop.
//   2. No rate limit. The walk runs as fast as the network allows.
//   3. No cap on page size (beat A). The client picks `limit`, so `?limit=100000`
//      returns the ENTIRE table in ONE request — and a per-request rate limiter
//      can't help, because it's a single request. Pagination without a max page
//      size isn't pagination; it's an optional convenience the attacker declines.
//
// THE FIX:
//   - Cursor pagination (`?cursor=<lastId>&limit=`) instead of offset — no cheap
//     random access; pages must be walked in order.
//   - Rate limiting (express-rate-limit is installed) so a scripted walk gets 429'd.
//   - A hard maximum on `limit` (e.g. Math.min(limit, 100)) so one request can't
//     drain the table.
//   (The deeper fix is to scope/authorize the feed; the lab's named cures are above.)
directoryRouter.get("/directory/appointments", requireAuth, async (_req: AuthedRequest, res) => {
  const rawLimit = Number(_req.query.limit);
  // No cap — whatever the client asks for (beat A).
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;
  const rawOffset = Number(_req.query.offset);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const rows = await prisma.appointment.findMany({
    skip: offset,
    take: limit,
    orderBy: { id: "asc" },
    include: { patient: { select: { displayName: true } } },
  });

  res.json({
    limit,
    offset,
    items: rows.map((a) => ({
      id: a.id,
      patientName: a.patient.displayName,
      reason: a.reason,
      scheduledAt: a.scheduledAt,
      status: a.status,
    })),
  });
});

// GET /api/directory/patients?limit=&offset=
//
// The same enumeration bug, pointed at a juicier target (beat B — the demo). Any
// logged-in patient can page the ENTIRE patient roster — names, usernames, dates of
// birth — the raw PII, not just appointment reasons. Same three sins as above
// (offset, no throttle, no cap). This is the "scale IS the vulnerability" beat: one
// scripted walk exfiltrates every identity the clinic holds.
//
// (Shown as a demo; the fix is identical to the appointments feed — and, really,
// this feed should be scoped to staff, not exposed to every patient at all.)
directoryRouter.get("/directory/patients", requireAuth, async (_req: AuthedRequest, res) => {
  const rawLimit = Number(_req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;
  const rawOffset = Number(_req.query.offset);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const rows = await prisma.patient.findMany({
    skip: offset,
    take: limit,
    orderBy: { id: "asc" },
    select: { id: true, username: true, displayName: true, dateOfBirth: true, role: true },
  });

  res.json({ limit, offset, items: rows });
});

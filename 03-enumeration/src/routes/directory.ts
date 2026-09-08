import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const directoryRouter = Router();

// GET /api/directory/appointments?limit=&offset=
//
// A clinic-wide appointments feed. Any logged-in user can page through EVERY
// patient's appointments — offset/limit pagination, no rate limit.
//
// ⚠️ PLANTED SIN: offset pagination on a sensitive collection, with no throttle.
// `?limit&offset` is the pattern every tutorial teaches, and it's completely fine
// for, say, a public product catalogue. Here it turns the entire clinic into a
// `for (offset = 0; ; offset += limit)` loop — a bulk-exfiltration endpoint you
// built for the attacker. Offset lets them jump to any slice; no rate limit lets
// them do it as fast as the network allows.
//
// THE FIX (module 3 lab):
//   1. Cursor pagination — `?cursor=<lastId>&limit=` instead of offset, so there's
//      no cheap random access and pages must be walked in order.
//   2. Rate limiting — cap requests per client so a scripted walk gets 429'd.
//      (express-rate-limit is already in package.json, ready to wire up.)
//   3. (Arguably the real fix: scope it. But the lab's named cures are the two
//      above — apply them and watch the enumeration script die.)
directoryRouter.get("/directory/appointments", requireAuth, async (_req: AuthedRequest, res) => {
  const rawLimit = Number(_req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;
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

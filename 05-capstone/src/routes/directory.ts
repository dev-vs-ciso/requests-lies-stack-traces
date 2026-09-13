import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const directoryRouter = Router();

// Clinic-wide appointments feed (used by the staff dashboard).
directoryRouter.get("/directory/appointments", requireAuth, async (_req: AuthedRequest, res) => {
  const rawLimit = Number(_req.query.limit);
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

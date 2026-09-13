import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const searchRouter = Router();

// List the caller's appointments, sortable by any field.
searchRouter.get("/appointments", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const sort = String(req.query.sort ?? "scheduledAt");
    const order = req.query.order === "asc" ? "asc" : "desc";
    const rows = await prisma.appointment.findMany({
      where: { patientId: req.auth!.patientId },
      orderBy: { [sort]: order },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

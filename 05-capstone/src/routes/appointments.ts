import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const appointmentsRouter = Router();

// A single appointment.
appointmentsRouter.get(
  "/appointments/:appointmentId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const id = Number(req.params.appointmentId);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }
    if (appt.patientId !== req.auth!.patientId && req.auth!.role === "patient") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(appt);
  },
);

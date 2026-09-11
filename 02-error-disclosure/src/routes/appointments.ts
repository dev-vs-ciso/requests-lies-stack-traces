import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const appointmentsRouter = Router();

// GET /api/appointments/:appointmentId — fetch a single appointment.
//
// Access control here is CORRECT: you cannot read someone else's appointment. But
// the DENIAL leaks information.
//
// ⚠️ PLANTED SIN (beat C — existence disclosure): a missing id returns 404, while
// an id that exists but isn't yours returns 403. Distinguishing "doesn't exist"
// from "exists but forbidden" is textbook-correct REST semantics in most apps —
// and here it's an oracle: walk the ids and the 403-vs-404 pattern maps out exactly
// which appointments are real (and roughly how many, and whose). The record stays
// protected; the *status code* is the leak.
//
// THE FIX: make "not found" and "not yours" indistinguishable — return 404 for
// both, so the response never confirms that a record exists.
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

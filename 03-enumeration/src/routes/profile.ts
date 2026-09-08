import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const profileRouter = Router();

// The frontend calls this on load to learn its OWN id, then only ever requests
// /patients/<that id>/... — which is why the IDOR is invisible from the UI.
profileRouter.get("/profile", requireAuth, async (req: AuthedRequest, res) => {
  const me = await prisma.patient.findUnique({
    where: { id: req.auth!.patientId },
    select: { id: true, username: true, displayName: true, role: true, dateOfBirth: true },
  });
  res.json(me);
});

import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const patientsRouter = Router();

const PUBLIC_PATIENT_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  dateOfBirth: true,
} as const;

// Access control is CORRECT in this module (Module 1's IDOR is fixed here). This
// module's sins live at the SERVICE boundary: wildcard CORS on this portal (see
// src/app.ts) and a Labs service that trusts anyone who looks "internal".
function assertOwnership(req: AuthedRequest, id: number, res: import("express").Response): boolean {
  if (req.auth!.role !== "patient") return true; // providers ok
  if (id === req.auth!.patientId) return true; // your own record ok
  res.status(403).json({ error: "Forbidden" });
  return false;
}

patientsRouter.get("/patients/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!assertOwnership(req, id, res)) return;
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: PUBLIC_PATIENT_FIELDS,
  });
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(patient);
});

// The trophy endpoint: Ana's private diagnosis lives here.
patientsRouter.get("/patients/:id/visit-notes", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!assertOwnership(req, id, res)) return;
  const notes = await prisma.visitNote.findMany({
    where: { patientId: id },
    orderBy: { date: "desc" },
  });
  res.json(notes);
});

patientsRouter.get("/patients/:id/appointments", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!assertOwnership(req, id, res)) return;
  const appointments = await prisma.appointment.findMany({
    where: { patientId: id },
    orderBy: { scheduledAt: "desc" },
  });
  res.json(appointments);
});

patientsRouter.get("/patients/:id/prescriptions", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!assertOwnership(req, id, res)) return;
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: id },
    orderBy: { id: "asc" },
  });
  res.json(prescriptions);
});

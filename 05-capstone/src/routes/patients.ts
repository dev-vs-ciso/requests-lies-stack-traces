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

// Patient records.
patientsRouter.get("/patients/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patient = await prisma.patient.findUnique({ where: { id }, select: PUBLIC_PATIENT_FIELDS });
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(patient);
});

patientsRouter.get("/patients/:id/visit-notes", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const notes = await prisma.visitNote.findMany({ where: { patientId: id }, orderBy: { date: "desc" } });
  res.json(notes);
});

// A single visit note.
patientsRouter.get(
  "/patients/:patientId/visit-notes/:noteId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const patientId = Number(req.params.patientId);
    const noteId = Number(req.params.noteId);
    if (!Number.isInteger(patientId) || !Number.isInteger(noteId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const note = await prisma.visitNote.findUnique({ where: { id: noteId } });
    if (!note) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(note);
  },
);

patientsRouter.get("/patients/:id/appointments", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const appointments = await prisma.appointment.findMany({ where: { patientId: id }, orderBy: { scheduledAt: "desc" } });
  res.json(appointments);
});

patientsRouter.get("/patients/:id/prescriptions", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const prescriptions = await prisma.prescription.findMany({ where: { patientId: id }, orderBy: { id: "asc" } });
  res.json(prescriptions);
});

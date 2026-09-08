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

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ PLANTED SINS #2 and #3 live in this file.
//
//   #2  Guessable sequential ids  — patients are 1, 2, 3, ...  so "some other
//       patient's id" is just "your id ± 1".
//   #3  The missing ownership check — every handler below calls requireAuth (you
//       must be logged in ✓) but NONE of them checks that the :id you asked for
//       is actually YOURS. That second check was never written. This is the exact
//       shape of the bug an agent produces: it wrote the auth middleware and
//       stopped there.
//
// "Look up a record by the id in the URL" is completely correct in a single-tenant
// admin tool. In this multi-tenant clinic it means any logged-in patient can read
// any other patient's records.
//
// THE FIX (module 1 lab): before returning anyone's data, assert the requested id
// belongs to the caller — unless the caller is a provider. Something like:
//
//     function assertOwnership(req: AuthedRequest, id: number, res): boolean {
//       if (req.auth!.role !== "patient") return true;        // providers ok
//       if (id === req.auth!.patientId) return true;          // your own record ok
//       res.status(403).json({ error: "Forbidden" });
//       return false;
//     }
//
// ...and call it at the top of each handler. (And close sin #1 in src/session.ts.)
// ─────────────────────────────────────────────────────────────────────────────

patientsRouter.get("/patients/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
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
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: id },
    orderBy: { id: "asc" },
  });
  res.json(prescriptions);
});

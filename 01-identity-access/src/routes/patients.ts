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
//
//   #4  The nested-resource relationship, on GET /patients/:patientId/visit-notes/
//       :noteId below. That handler fetches the note by its GLOBAL id and ignores
//       :patientId entirely — the parent segment is decorative. Adding the
//       ownership check from #3 is NOT enough: you can pass your OWN patientId
//       (check passes) with SOMEONE ELSE'S noteId and still read their note. The
//       fix is to validate the relationship — scope the child to the parent:
//         prisma.visitNote.findFirst({ where: { id: noteId, patientId } })
//       Access control ("is this mine?") and ownership/relationship validation
//       ("does this child belong to that parent?") are two different checks.
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

// The trophy endpoint: Viktorija's private diagnosis lives here.
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

// Nested resource: a single visit note under a patient.
// ⚠️ SIN #4 (see the header): the note is fetched by its GLOBAL id; :patientId is
// never used. Even with an ownership check on :patientId, your-own-parent +
// someone-else's-noteId still reads their note. Fix = scope the child to the parent.
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

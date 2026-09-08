// Deterministic data generator. Runs at Docker BUILD time to produce a pristine,
// byte-identical database that gets baked into the image. Runtime never regenerates
// — it just copies the pristine file (see docker-entrypoint.sh).
//
// Run manually with:  npm run generate   (after `npm run prisma:push`)

import { prisma } from "./db";
import { mulberry32, pick, int, WORKSHOP_SEED, type Rng } from "./lib/prng";
import { hashPassword, deterministicSalt } from "./lib/passwords";
import {
  MALE_FIRST,
  FEMALE_FIRST,
  SURNAMES_M,
  feminizeSurname,
  usernameBase,
} from "./data/names";
import { DIAGNOSES, APPT_REASONS, PRESCRIPTIONS } from "./data/conditions";
import { CAST, ANDREJ, VIKTORIJA, DR_STOJANOVSKA, VIKTORIJA_TROPHY, BULK_START_ID } from "./data/cast";

const PATIENT_COUNT = Number(process.env.PATIENT_COUNT ?? 10_000);
const CHUNK = 5_000;
const PROVIDER_ID = DR_STOJANOVSKA.id;

function isoShift(rng: Rng, base: Date, minDays: number, maxDays: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + int(rng, minDays, maxDays));
  return d;
}

async function chunkedCreate<T>(rows: T[], create: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await create(rows.slice(i, i + CHUNK));
  }
}

async function main() {
  const rng = mulberry32(WORKSHOP_SEED);
  const now = new Date("2026-01-01T09:00:00Z");

  console.log("Wiping any existing data...");
  await prisma.prescription.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.visitNote.deleteMany();
  await prisma.patient.deleteMany();

  // --- Cast (fixed ids, deterministic password hashes) ---
  console.log("Seeding cast...");
  for (const m of CAST) {
    await prisma.patient.create({
      data: {
        id: m.id,
        username: m.username,
        displayName: m.displayName,
        passwordHash: hashPassword(m.password, deterministicSalt(m.username)),
        role: m.role,
        dateOfBirth: new Date(m.dateOfBirth),
      },
    });
  }

  // --- Bulk patients (ids BULK_START_ID .. BULK_START_ID+PATIENT_COUNT-1) ---
  console.log(`Generating ${PATIENT_COUNT.toLocaleString()} bulk patients...`);
  const patients: {
    id: number;
    username: string;
    displayName: string;
    passwordHash: string;
    role: string;
    dateOfBirth: Date;
  }[] = [];

  for (let i = 0; i < PATIENT_COUNT; i++) {
    const id = BULK_START_ID + i;
    const female = rng() < 0.5;
    const first = female ? pick(rng, FEMALE_FIRST) : pick(rng, MALE_FIRST);
    const surnameM = pick(rng, SURNAMES_M);
    const surname = female ? feminizeSurname(surnameM) : surnameM;
    const displayName = `${first} ${surname}`;
    // Number suffix keeps usernames unique across 10k rows.
    const username = `${usernameBase(first, surnameM)}${id}`;
    patients.push({
      id,
      username,
      displayName,
      passwordHash: hashPassword("changeme", deterministicSalt(username)),
      role: "patient",
      dateOfBirth: isoShift(rng, new Date("1960-01-01"), 0, 60 * 365),
    });
  }
  await chunkedCreate(patients, (batch) =>
    prisma.patient.createMany({ data: batch }),
  );

  const allIds = [...CAST.map((c) => c.id), ...patients.map((p) => p.id)];

  // --- Appointments (~5 per patient => ~50k) ---
  console.log("Generating appointments...");
  const appointments: {
    patientId: number;
    providerId: number;
    scheduledAt: Date;
    reason: string;
    status: string;
  }[] = [];
  for (const pid of allIds) {
    const count = int(rng, 2, 8);
    for (let k = 0; k < count; k++) {
      appointments.push({
        patientId: pid,
        providerId: PROVIDER_ID,
        scheduledAt: isoShift(rng, now, -365, 365),
        reason: pick(rng, APPT_REASONS),
        status: pick(rng, ["scheduled", "completed", "cancelled", "no-show"]),
      });
    }
  }
  await chunkedCreate(appointments, (batch) =>
    prisma.appointment.createMany({ data: batch }),
  );

  // A sensitive appointment buried deep (highest id) for the enumeration hunt.
  await prisma.appointment.create({
    data: {
      patientId: VIKTORIJA.id,
      providerId: PROVIDER_ID,
      scheduledAt: new Date("2026-02-14T09:00:00Z"),
      reason: "VIP консултација — [TROPHY: napping-championship-finals]",
      status: "scheduled",
    },
  });

  // --- Visit notes (0-2 per patient) ---
  console.log("Generating visit notes...");
  const notes: {
    patientId: number;
    providerId: number;
    date: Date;
    diagnosis: string;
    notes: string;
  }[] = [];
  for (const pid of allIds) {
    const count = int(rng, 0, 2);
    for (let k = 0; k < count; k++) {
      notes.push({
        patientId: pid,
        providerId: PROVIDER_ID,
        date: isoShift(rng, now, -365, 0),
        diagnosis: pick(rng, DIAGNOSES),
        notes: "Routine visit. Patient advised to hydrate and touch grass.",
      });
    }
  }
  // The trophy: Viktorija's private note. Andrej gets a guaranteed own note so the
  // post-fix regression check ("can still read my own") has something to read.
  notes.push({
    patientId: VIKTORIJA.id,
    providerId: PROVIDER_ID,
    date: new Date("2025-12-15T10:30:00Z"),
    diagnosis: VIKTORIJA_TROPHY.diagnosis,
    notes: VIKTORIJA_TROPHY.notes,
  });
  notes.push({
    patientId: ANDREJ.id,
    providerId: PROVIDER_ID,
    date: new Date("2025-11-20T14:00:00Z"),
    diagnosis: "Mild-to-moderate inbox anxiety",
    notes: "Patient advised to enable Do Not Disturb. Follow up in 3 months.",
  });
  await chunkedCreate(notes, (batch) =>
    prisma.visitNote.createMany({ data: batch }),
  );

  // --- Prescriptions (0-2 per patient) ---
  console.log("Generating prescriptions...");
  const scripts: { patientId: number; drug: string; dosage: string; active: boolean }[] = [];
  for (const pid of allIds) {
    const count = int(rng, 0, 2);
    for (let k = 0; k < count; k++) {
      const p = pick(rng, PRESCRIPTIONS);
      scripts.push({ patientId: pid, drug: p.drug, dosage: p.dosage, active: rng() < 0.7 });
    }
  }
  // Guarantee the hero patients have at least one of each record type, so their
  // portal tabs are never empty when people explore (everyone logs in as Bojan).
  scripts.push({ patientId: ANDREJ.id, drug: "Focusatol", dosage: "1 capsule each morning", active: true });
  scripts.push({ patientId: VIKTORIJA.id, drug: "Calmivan", dosage: "0.5 mg before meetings", active: true });
  await chunkedCreate(scripts, (batch) =>
    prisma.prescription.createMany({ data: batch }),
  );

  const [patientN, apptN, noteN, scriptN] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.visitNote.count(),
    prisma.prescription.count(),
  ]);
  console.log(
    `Done. patients=${patientN} appointments=${apptN} visitNotes=${noteN} prescriptions=${scriptN}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

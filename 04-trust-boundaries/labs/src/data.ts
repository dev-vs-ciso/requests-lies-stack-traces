// Lab results live in this separate service. In-memory + deterministically seeded
// (no DB needed for the lesson). Patient ids match the portal's: Andrej=1,
// Viktorija=2 (the trophy), Dr. Stojanovska=3, bulk patients 4+.

export interface LabResult {
  id: number;
  patientId: number;
  test: string;
  value: string;
  flag: "NORMAL" | "HIGH" | "LOW" | "CRITICAL";
  date: string;
}

const TESTS = [
  "Complete Blood Count",
  "Vitamin D",
  "Cholesterol Panel",
  "Thyroid (TSH)",
  "Blood Glucose",
  "Iron Panel",
  "Caffeine Saturation",
  "Enthusiasm Index",
];
const VALUES = ["within range", "slightly elevated", "borderline", "optimal", "low-ish"];
const FLAGS: LabResult["flag"][] = ["NORMAL", "NORMAL", "NORMAL", "HIGH", "LOW"];

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const LAB_RESULTS: Record<number, LabResult[]> = {};
let nextId = 1000;
const rng = lcg(0x1abfeed);
for (let pid = 1; pid <= 120; pid++) {
  const n = 1 + Math.floor(rng() * 3);
  LAB_RESULTS[pid] = Array.from({ length: n }, () => ({
    id: nextId++,
    patientId: pid,
    test: TESTS[Math.floor(rng() * TESTS.length)],
    value: VALUES[Math.floor(rng() * VALUES.length)],
    flag: FLAGS[Math.floor(rng() * FLAGS.length)],
    date: "2025-1" + (1 + Math.floor(rng() * 2)) + "-0" + (1 + Math.floor(rng() * 8)),
  }));
}

// The trophy: Viktorija's sensitive result. Reading THIS as anyone but Viktorija is
// the module-4 exploit.
LAB_RESULTS[2] = [
  {
    id: 2002,
    patientId: 2,
    test: "Napping Endurance Panel",
    value: "Championship-level [TROPHY: labs-cross-tenant]",
    flag: "CRITICAL",
    date: "2026-01-20",
  },
  ...LAB_RESULTS[2],
];

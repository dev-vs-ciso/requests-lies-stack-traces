// The workshop cast. Fixed IDs, fixed data, same login in every module — so the
// muscle memory ("log in as Andrej, go after Viktorija") transfers app to app.
//
// The bulk 10k patients fill in AROUND these three (ids 4+). These three never
// move. Passwords are plaintext here only so the generator can hash them and the
// checker can log in; this is teaching code, not production.

export type Role = "patient" | "provider" | "admin";

export interface CastMember {
  id: number;
  username: string;
  password: string;
  displayName: string; // Cyrillic
  role: Role;
  dateOfBirth: string; // ISO
}

// You, the attacker. Participants log in as Andrej — patient id 1, so the victim
// is quite literally "your id + 1".
export const ANDREJ: CastMember = {
  id: 1,
  username: "andrej",
  password: "andrej12345",
  displayName: "Андреј Трајаноски",
  role: "patient",
  dateOfBirth: "1988-11-02",
};

// The victim. Her visit note is the trophy.
export const VIKTORIJA: CastMember = {
  id: 2,
  username: "viktorija",
  password: "viktorija12345",
  displayName: "Викторија Петровска",
  role: "patient",
  dateOfBirth: "1991-07-24",
};

export const DR_STOJANOVSKA: CastMember = {
  id: 3,
  username: "drstoj",
  password: "drstoj12345",
  displayName: "Д-р Стојановска",
  role: "provider",
  dateOfBirth: "1979-05-18",
};

export const CAST: readonly CastMember[] = [ANDREJ, VIKTORIJA, DR_STOJANOVSKA];

// The trophy: Viktorija's private diagnosis. The IDOR lab succeeds when Andrej can
// read this string through the API. The checker greps for exactly this.
export const VIKTORIJA_TROPHY = {
  diagnosis: "Advanced competitive napping (Stage IV, championship-level)",
  notes:
    "Patient reports napping through three consecutive all-hands meetings. " +
    "Recommend continued rest and a more comfortable chair. Do NOT tell HR.",
} as const;

// The lowest bulk-patient id. Cast occupy 1..3; bulk start here.
export const BULK_START_ID = 4;

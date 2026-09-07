// The workshop cast. Fixed IDs, fixed data, same login in every module — so the
// muscle memory ("log in as bojan, go after ana") transfers app to app.
//
// The bulk 10k patients fill in AROUND these four (ids 5+). These four never move.
// Passwords are plaintext here only so the generator can hash them and the checker
// can log in; this is teaching code, not production.

export type Role = "patient" | "provider" | "admin";

export interface CastMember {
  id: number;
  username: string;
  password: string;
  displayName: string; // Cyrillic
  role: Role;
  dateOfBirth: string; // ISO
}

export const ADMIN: CastMember = {
  id: 1,
  username: "admin",
  password: "admin12345",
  displayName: "Елена Ристеска",
  role: "admin",
  dateOfBirth: "1985-03-12",
};

// The victim. Her visit note is the trophy.
export const ANA: CastMember = {
  id: 2,
  username: "ana",
  password: "ana12345",
  displayName: "Ана Петровска",
  role: "patient",
  dateOfBirth: "1991-07-24",
};

// You, the attacker. Participants log in as Bojan.
export const BOJAN: CastMember = {
  id: 3,
  username: "bojan",
  password: "bojan12345",
  displayName: "Бојан Трајаноски",
  role: "patient",
  dateOfBirth: "1988-11-02",
};

export const DR_STOJANOVSKA: CastMember = {
  id: 4,
  username: "drstoj",
  password: "drstoj12345",
  displayName: "Д-р Стојановска",
  role: "provider",
  dateOfBirth: "1979-05-18",
};

export const CAST: readonly CastMember[] = [ADMIN, ANA, BOJAN, DR_STOJANOVSKA];

// The trophy: Ana's private diagnosis. The IDOR lab succeeds when Bojan can read
// this string through the API. The checker greps for exactly this.
export const ANA_TROPHY = {
  diagnosis: "Advanced competitive napping (Stage IV, championship-level)",
  notes:
    "Patient reports napping through three consecutive all-hands meetings. " +
    "Recommend continued rest and a more comfortable chair. Do NOT tell HR.",
} as const;

// The lowest bulk-patient id. Cast occupy 1..4; bulk start here.
export const BULK_START_ID = 5;

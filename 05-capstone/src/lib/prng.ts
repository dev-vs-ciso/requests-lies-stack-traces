// Deterministic PRNG (mulberry32) + helpers.
//
// Seeded once with a fixed constant so every `docker build` in the room produces
// a BYTE-IDENTICAL dataset. "Randomized-looking, deterministic-in-fact." This is
// what lets the checker and the lab instructions ("the trophy is past page 40")
// be true on all 20 laptops at once. Do not reseed with Date.now() or Math.random.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

/** Inclusive integer in [min, max]. */
export const int = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

/** Fixed seed for the whole workshop. Change it and everyone's data changes. */
export const WORKSHOP_SEED = 0x5eed_c0de;

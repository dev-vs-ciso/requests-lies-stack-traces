import { scryptSync, timingSafeEqual, createHash } from "node:crypto";

// Stored format: "<saltHex>:<hashHex>".
export function hashPassword(password: string, salt: Buffer): string {
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Deterministic salt derived from a seed (e.g. the username), so the generator
// produces a byte-identical database on every build. Do NOT use this pattern in
// real code — production salts must be random.
export function deterministicSalt(seed: string): Buffer {
  return createHash("sha256").update(seed).digest().subarray(0, 16);
}

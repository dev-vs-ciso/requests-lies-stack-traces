import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";

// In-memory session store. Fine for a workshop; sessions reset when the container
// restarts (participants just log in again).
const sessions = new Map<string, number>(); // token -> patientId

export function createSession(patientId: number): string {
  const token = randomBytes(24).toString("hex");
  sessions.set(token, patientId);
  return token;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export interface AuthedRequest extends Request {
  auth?: { patientId: number; role: string; displayName: string };
}

// Resolve the session token. Also accepts it as ?session= so shareable links and
// kiosk check-in work without a cookie.
function readToken(req: Request): string | undefined {
  const fromQuery =
    typeof req.query.session === "string" ? req.query.session : undefined;
  const fromCookie = req.cookies?.sid as string | undefined;
  return fromQuery ?? fromCookie;
}

// Require a logged-in session; attaches req.auth for handlers.
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readToken(req);
  const patientId = token ? sessions.get(token) : undefined;
  if (!patientId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.auth = {
    patientId: patient.id,
    role: patient.role,
    displayName: patient.displayName,
  };
  next();
}

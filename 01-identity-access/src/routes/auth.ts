import { Router } from "express";
import { prisma } from "../db";
import { verifyPassword } from "../lib/passwords";
import { createSession, destroySession } from "../session";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  const patient = await prisma.patient.findUnique({ where: { username } });
  if (!patient || !verifyPassword(password, patient.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = createSession(patient.id);
  // The frontend authenticates purely by this cookie. (The API, however, will
  // also honour the same token as ?session= — see src/session.ts.)
  res.cookie("sid", token, { httpOnly: true, sameSite: "lax" });
  res.json({ id: patient.id, displayName: patient.displayName, role: patient.role });
});

authRouter.post("/logout", (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (token) destroySession(token);
  res.clearCookie("sid");
  res.json({ ok: true });
});

import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../session";

export const labsRouter = Router();

const LABS_URL = process.env.LABS_URL ?? "http://localhost:3014";

// GET /api/my/lab-results
//
// Lab results live in a SEPARATE service (the Labs service). The portal asks it for
// the CURRENT user's results — correctly passing only the caller's own id.
//
// Note HOW it authenticates to Labs: a header that just says "trust me, I'm the
// portal" (X-Internal-Request: true). That's the trust-boundary sin, and it lives
// on the Labs side (labs/src/server.ts): it believes anyone who sends that header.
// The portal is honest here; the problem is that "honest" isn't enforceable when
// the marker is guessable and the Labs port is reachable.
labsRouter.get("/my/lab-results", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const r = await fetch(`${LABS_URL}/lab-results?patientId=${req.auth!.patientId}`, {
      headers: { "X-Internal-Request": "true" },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch {
    res.status(502).json({ error: "Labs service unavailable" });
  }
});

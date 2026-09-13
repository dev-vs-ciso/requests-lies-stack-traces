import express from "express";
import { LAB_RESULTS } from "./data";

const app = express();
const port = Number(process.env.PORT ?? 3000);

// A shared secret only the portal should know. Used by v2, ignored by v1.
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "portal-shared-secret";

app.get("/health", (_req, res) => res.json({ ok: true }));

function results(req: express.Request, res: express.Response) {
  const patientId = Number(req.query.patientId);
  if (!Number.isInteger(patientId)) {
    res.status(400).json({ error: "bad patientId" });
    return;
  }
  res.json({ patientId, results: LAB_RESULTS[patientId] ?? [] });
}

// ── GET /api/v2/lab-results — the "fixed" endpoint ───────────────────────────
// Authenticates the CALLER with a shared secret only the portal holds. This is
// what the team shipped when they realised v1 was broken.
app.get("/api/v2/lab-results", (req, res) => {
  if (req.header("X-Internal-Token") !== INTERNAL_TOKEN) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  results(req, res);
});

// ── GET /api/v1/lab-results — the ZOMBIE (beat V) ────────────────────────────
// ⚠️ PLANTED SIN (versioning + trust boundary): v1 is the ORIGINAL endpoint, and
// it's still deployed. It trusts a guessable "internal" marker header — anyone who
// sends `X-Internal-Request: true` is treated as the portal and can read ANY
// patientId. The team "fixed it in v2" and left v1 running for backward compat.
//
// Keeping old versions alive is normal and responsible-sounding. But a fix behind a
// version number is not a fix while the old version still serves traffic: the
// attacker just calls v1. THE FIX: retire v1 (or apply the same auth to it).
app.get("/api/v1/lab-results", (req, res) => {
  if (req.header("X-Internal-Request") !== "true") {
    res.status(401).json({ error: "internal only" });
    return;
  }
  results(req, res);
});

app.listen(port, () => console.log(`Labs service listening on http://localhost:${port}`));

import express from "express";
import { LAB_RESULTS } from "./data";

const app = express();
const port = Number(process.env.PORT ?? 3000);

// A shared secret only the portal should know. Used by the FIX, ignored by the sin.
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "portal-shared-secret";

app.get("/health", (_req, res) => res.json({ ok: true }));

// GET /lab-results?patientId=<id>
//
// ⚠️ PLANTED SIN #2 (broken trust boundary): this service decides you're allowed
// in based on a guessable "internal" marker header — X-Internal-Request: true.
// "It's only reachable from inside the network, and only the portal calls it" is a
// reasonable-sounding simplification behind a VPC. But the port is reachable and
// the marker is trivial to forge, so ANYONE can impersonate the portal and read
// ANY patient's results by changing ?patientId. Network position is not identity.
//
// THE FIX (module 4 lab): authenticate the *caller*, not its vibe. Require a shared
// secret only the portal holds:
//
//     if (req.header("X-Internal-Token") !== INTERNAL_TOKEN) return res.sendStatus(401);
//
// and update the portal (portal/src/routes/labs.ts) to send that header instead of
// X-Internal-Request. (A signed, short-lived token is better still.)
app.get("/lab-results", (req, res) => {
  if (req.header("X-Internal-Request") !== "true") {
    res.status(401).json({ error: "internal only" });
    return;
  }
  const patientId = Number(req.query.patientId);
  if (!Number.isInteger(patientId)) {
    res.status(400).json({ error: "bad patientId" });
    return;
  }
  res.json({ patientId, results: LAB_RESULTS[patientId] ?? [] });
});

app.listen(port, () => console.log(`Labs service listening on http://localhost:${port}`));

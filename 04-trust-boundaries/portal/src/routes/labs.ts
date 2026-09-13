import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../session";

export const labsRouter = Router();

const LABS_URL = process.env.LABS_URL ?? "http://localhost:3014";
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "portal-shared-secret";

// ── GET /api/my/lab-results — the LEGIT path (decoy) ─────────────────────────
// Session-scoped: it fetches only the CURRENT user's results, and authenticates to
// Labs with the shared secret over v2. This is correct.
labsRouter.get("/my/lab-results", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const r = await fetch(`${LABS_URL}/api/v2/lab-results?patientId=${req.auth!.patientId}`, {
      headers: { "X-Internal-Token": INTERNAL_TOKEN },
    });
    res.status(r.status).json(await r.json());
  } catch {
    res.status(502).json({ error: "Labs service unavailable" });
  }
});

// ── GET /api/lab-results?patientId= — CONFUSED DEPUTY (beat T) ────────────────
// ⚠️ PLANTED SIN: Labs now correctly trusts only the portal (v2 + secret). But the
// portal betrays that trust — it forwards a CALLER-CONTROLLED patientId to Labs
// using its own secret, with no ownership check. Authenticating the CHANNEL between
// services is not authorizing the REQUEST that flows over it. Fixing Labs' auth did
// nothing here, because the trusted deputy will fetch anyone's results for you.
//
// THE FIX: never forward a caller-controlled id — scope to the session
// (req.auth.patientId), i.e. behave like /my/lab-results. (Or have Labs re-check
// identity itself instead of trusting the portal's word.)
labsRouter.get("/lab-results", requireAuth, async (req: AuthedRequest, res) => {
  const patientId = Number(req.query.patientId);
  if (!Number.isInteger(patientId)) {
    res.status(400).json({ error: "Invalid patientId" });
    return;
  }
  try {
    const r = await fetch(`${LABS_URL}/api/v2/lab-results?patientId=${patientId}`, {
      headers: { "X-Internal-Token": INTERNAL_TOKEN },
    });
    res.status(r.status).json(await r.json());
  } catch {
    res.status(502).json({ error: "Labs service unavailable" });
  }
});

// ── POST /api/labs/import { url } — SSRF (beat S) ─────────────────────────────
// A realistic "import results from an external lab provider" feature: give it a URL
// and the server fetches it for you.
//
// ⚠️ PLANTED SIN: the URL is attacker-controlled and the portal fetches it with no
// egress allow-list. The portal lives INSIDE the network, so it can reach things the
// attacker cannot — the internal-only integrations service, other services, cloud
// metadata. "Fetch a URL the user gave us" is an ordinary integration feature; the
// missing egress control turns the trusted server into the attacker's proxy. (This
// is the Capital One bug, clinic-flavoured.)
//
// THE FIX: allow-list the outbound host (only known external providers); reject
// internal hostnames/IPs. Better still, don't let user input choose the host at all.
labsRouter.post("/labs/import", requireAuth, async (req: AuthedRequest, res) => {
  const url = (req.body ?? {}).url;
  if (typeof url !== "string") {
    res.status(400).json({ error: "url required" });
    return;
  }
  try {
    const r = await fetch(url);
    const text = await r.text();
    res.json({ imported: true, status: r.status, preview: text.slice(0, 600) });
  } catch (e) {
    res.status(502).json({ error: "fetch failed", detail: String(e) });
  }
});

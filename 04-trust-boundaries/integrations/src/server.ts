import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3000);

// The clinic's internal "integrations" service. It holds outbound secrets — the
// keys the clinic uses to talk to its insurer, SMS gateway, and lab provider.
//
// It is NOT published to the host in docker-compose (no `ports:` entry): the only
// way to reach it is from INSIDE the compose network. That's the whole point of
// network segmentation — and the whole point of the SSRF beat, which makes a
// trusted service (the portal) fetch this on the attacker's behalf.
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/config", (_req, res) => {
  res.json({
    service: "clinic-integrations",
    insuranceApiKey: "sk_live_ins_9f2a7c1e4b8d21",
    smsGatewayToken: "smsg_7d3f_a1b2c3d4e5",
    labProviderWebhookSecret: "whsec_44ac91e0b7",
    note: "[SSRF-TROPHY: internal-secrets-reachable]",
  });
});

app.listen(port, () => console.log(`integrations (internal-only) listening on ${port}`));

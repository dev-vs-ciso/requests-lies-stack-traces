import { Router } from "express";

export const statusRouter = Router();

// GET /api/status — an ops/health endpoint (unauthenticated, like most are).
//
// ⚠️ PLANTED SIN (beat B — metadata disclosure): it overshares. Node + OpenSSL
// versions and the platform are a version-fingerprint for known-CVE targeting; the
// DATABASE_URL reveals the database engine and its on-disk path. A "status"
// endpoint that dumps this, handed out with no auth, is a shopping list for an
// attacker — and no error had to be triggered at all.
//
// (There's a second, quieter leak in the same family: the `X-Powered-By: Express`
// header, which Express sends by default. See src/app.ts.)
//
// THE FIX: return a bare { status: "ok" } (keep real diagnostics behind auth, or
// drop them), and `app.disable("x-powered-by")`.
statusRouter.get("/status", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    node: process.version,
    openssl: process.versions.openssl,
    platform: `${process.platform} ${process.arch}`,
    env: process.env.NODE_ENV ?? "development",
    database: process.env.DATABASE_URL, // e.g. file:/app/data/app.db → engine + path
  });
});

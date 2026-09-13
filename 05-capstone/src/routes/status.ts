import { Router } from "express";

export const statusRouter = Router();

// Ops/health status.
statusRouter.get("/status", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    node: process.version,
    openssl: process.versions.openssl,
    platform: `${process.platform} ${process.arch}`,
    env: process.env.NODE_ENV ?? "development",
    database: process.env.DATABASE_URL,
  });
});

import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { patientsRouter } from "./routes/patients";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", authRouter);
  app.use("/api", profileRouter);
  app.use("/api", patientsRouter);

  // The decoy frontend: does everything right, so the bug is invisible here.
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
  app.use(express.static(publicDir));

  // Module 1 is about access control, not information disclosure — so this
  // error handler is intentionally well-behaved (nothing leaks). Module 2 breaks
  // exactly this on purpose.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  };
  app.use(errorHandler);

  return app;
}

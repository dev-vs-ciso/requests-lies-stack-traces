import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { patientsRouter } from "./routes/patients";
import { searchRouter } from "./routes/search";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", authRouter);
  app.use("/api", profileRouter);
  app.use("/api", patientsRouter);
  app.use("/api", searchRouter);

  // The decoy frontend: does everything right, so the bug is invisible here.
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
  app.use(express.static(publicDir));

  // ⚠️ PLANTED SIN: the "just show me the error" handler.
  //
  // This is exactly what makes local debugging pleasant — the full message, the
  // exception class, and the stack, straight in the response. Sensible in dev.
  // Shipped to prod, every failed request hands the client your ORM (Prisma), the
  // valid field names of your schema, your database driver, and absolute file
  // paths from the stack. Fingerprinting the stack becomes copy-paste.
  //
  // THE FIX (module 2 lab): log the real error server-side, return a generic shape
  // to the client (a message + a requestId to correlate with the logs), and never
  // leak err.stack / err.name / ORM internals. Also stop arbitrary ?sort values
  // from reaching Prisma in the first place (whitelist the sortable fields).
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({
      error: err.message,
      name: err.name,
      stack: err.stack,
    });
  };
  app.use(errorHandler);

  return app;
}

import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { patientsRouter } from "./routes/patients";
import { labsRouter } from "./routes/labs";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // ⚠️ PLANTED SIN #1: wildcard CORS with credentials.
  //
  // Reflecting any Origin and allowing credentials is the quickest way to make a
  // "CORS error" in the browser console go away — which is exactly why it gets
  // committed. It also means ANY website your logged-in users visit can make
  // credentialed calls to this API with their cookies and read the responses.
  //
  // THE FIX (module 4 lab): reflect an Origin only if it's on an allow-list
  // (the portal's own origins), and never pair `*` with credentials.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin); // reflects anything
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", authRouter);
  app.use("/api", profileRouter);
  app.use("/api", patientsRouter);
  app.use("/api", labsRouter);

  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
  app.use(express.static(publicDir));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  };
  app.use(errorHandler);

  return app;
}

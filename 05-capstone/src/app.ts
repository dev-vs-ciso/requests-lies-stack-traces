import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { patientsRouter } from "./routes/patients";
import { searchRouter } from "./routes/search";
import { directoryRouter } from "./routes/directory";

// ─────────────────────────────────────────────────────────────────────────────
// This is the "agent-built" API for the capstone hunt. It was assembled fast, the
// happy path works, and the test suite (npm test) is green. It also contains a
// stack of the exact bugs an agent tends to emit. Nothing here is labelled with a
// ⚠️ SIN comment on purpose — finding them is the exercise. The checker
// (checker/check.mjs) is your scoreboard.
// ─────────────────────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // CORS: reflect the caller's origin so the frontend "just works" from anywhere.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin);
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
  app.use("/api", searchRouter);
  app.use("/api", directoryRouter);

  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
  app.use(express.static(publicDir));

  // Return the error so the client can see what happened.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message, name: err.name, stack: err.stack });
  };
  app.use(errorHandler);

  return app;
}

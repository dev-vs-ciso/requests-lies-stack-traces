import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../session";

export const searchRouter = Router();

// GET /api/appointments?sort=<field>&order=<asc|desc>
//
// Scoped to the caller's OWN appointments — there's no IDOR here. The sort field
// is passed straight into Prisma's orderBy. The frontend only ever sends a valid
// field (scheduledAt), so this looks fine. But an arbitrary ?sort value makes
// Prisma throw a validation error — and what happens to that error is the sin
// (see the error handler in src/app.ts): the raw exception, complete with the ORM
// name, the list of valid schema fields, and internal file paths, goes to the
// client. That's how an attacker fingerprints your DB, ORM, and layout — from
// errors alone, never touching a real record.
searchRouter.get("/appointments", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const sort = String(req.query.sort ?? "scheduledAt");
    const order = req.query.order === "asc" ? "asc" : "desc";
    const rows = await prisma.appointment.findMany({
      where: { patientId: req.auth!.patientId },
      orderBy: { [sort]: order }, // arbitrary sort -> PrismaClientValidationError
    });
    res.json(rows);
  } catch (e) {
    next(e); // handed to the (leaky) global error handler
  }
});

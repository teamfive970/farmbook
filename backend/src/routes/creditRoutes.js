import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createShare, getCreditRecord, listShares, revokeShare } from "../services/creditService.js";

// Farmer: make, list and stop lender links.
export const creditShareRoutes = Router();
creditShareRoutes.use(authenticate, requireRole("farmer"));
creditShareRoutes.get("/", async (req, res) => {
  res.json(await listShares(req.auth.userId));
});
creditShareRoutes.post("/", async (req, res) => {
  res.status(201).json(await createShare(req.auth.userId, req.body));
});
creditShareRoutes.post("/:id/stop", async (req, res) => {
  res.json(await revokeShare(req.auth.userId, req.params.id));
});

// Public: the lender opens the link. No sign-in; never cached.
export const creditRecordRoutes = Router();
creditRecordRoutes.get(
  "/:code",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
  }),
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex");
    res.json(await getCreditRecord(req.params.code));
  }
);

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPassport } from "../services/passportService.js";

// Public: anyone who scans a batch's QR code. No sign-in needed.
const router = Router();
const passportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
});

router.get("/:code", passportLimiter, async (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(await getPassport(req.params.code));
});

export default router;

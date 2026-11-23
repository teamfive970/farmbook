import { Router } from "express";
import rateLimit from "express-rate-limit";
import { contactLimiter } from "../middleware/rateLimit.js";
import { createBuyerRequest } from "../services/buyerRequestService.js";
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

// "Contact this farmer": the buyer leaves their name and number. The farmer's
// own number is never shown here.
router.post("/:code/contact", contactLimiter, async (req, res) => {
  res.status(201).json(await createBuyerRequest(req.params.code, req.body));
});

export default router;

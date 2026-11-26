import { Router } from "express";
import rateLimit from "express-rate-limit";
import { contactLimiter } from "../middleware/rateLimit.js";
import { createBuyerRequest } from "../services/buyerRequestService.js";
import { getPassport } from "../services/passportService.js";
import { getPassportPhoto } from "../services/photoService.js";

// Public: anyone who scans a batch's QR code. No sign-in needed.
const router = Router();
const passportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
});

// A photo of the harvest, only while its passport is public.
router.get("/:code/photos/:id", passportLimiter, async (req, res) => {
  const photo = await getPassportPhoto(req.params.code, req.params.id);
  res.set("Content-Type", photo.content_type);
  res.set("Cache-Control", "public, max-age=3600");
  res.set("ETag", `"${photo.sha256}"`);
  res.set("X-Content-Type-Options", "nosniff");
  // The web app may be on another address than the API: let it show the photo.
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(photo.data);
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

import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole } from "../middleware/auth.js";
import { MAX_BYTES, deletePhoto, getOwnPhoto, listHarvestPhotos, uploadPhoto } from "../services/photoService.js";

// The farmer's own photos: harvest proof and profile photo.
//   POST /api/photos?kind=harvest&harvestId=…   (or harvestClientId=…)
//   POST /api/photos?kind=profile
// The body is the photo itself (Content-Type image/jpeg or image/webp).
const router = Router();
router.use(authenticate, requireRole("farmer"));

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.auth.userId,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
});

router.post(
  "/",
  uploadLimiter,
  express.raw({ type: ["image/jpeg", "image/webp"], limit: Math.ceil(MAX_BYTES) + 1024 }),
  async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : null;
    res.status(201).json(await uploadPhoto(req.auth.userId, req.query, body));
  }
);

router.get("/", async (req, res) => {
  res.json(await listHarvestPhotos(req.auth.userId, req.query));
});

router.get("/:id", async (req, res) => {
  const photo = await getOwnPhoto(req.auth.userId, req.params.id);
  res.set("Content-Type", photo.content_type);
  res.set("Cache-Control", "private, max-age=86400");
  res.set("ETag", `"${photo.sha256}"`);
  res.set("X-Content-Type-Options", "nosniff");
  res.send(photo.data);
});

router.delete("/:id", async (req, res) => {
  res.json(await deletePhoto(req.auth.userId, req.params.id));
});

export default router;

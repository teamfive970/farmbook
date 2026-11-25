import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getMarketPrices, listHarvestsForSale } from "../services/marketService.js";

// Public: buyers browse harvests for sale; anyone sees typical prices.
const router = Router();
const marketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
});
router.use(marketLimiter);

router.get("/harvests", async (req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json(await listHarvestsForSale(req.query));
});

router.get("/prices", async (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(await getMarketPrices(req.query));
});

export default router;

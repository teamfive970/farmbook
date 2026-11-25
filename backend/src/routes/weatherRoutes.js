import { Router } from "express";
import rateLimit from "express-rate-limit";
import { COUNTY_POINTS, getCountyWeather } from "../services/weatherService.js";

// Public: weather is not private, and buyers or visitors may want it too.
const router = Router();
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
  })
);

router.get("/counties", (req, res) => {
  res.set("Cache-Control", "public, max-age=86400");
  res.json({ counties: Object.keys(COUNTY_POINTS) });
});

router.get("/", async (req, res) => {
  const body = await getCountyWeather(req.query.county);
  res.set("Cache-Control", "public, max-age=600");
  res.json(body);
});

export default router;

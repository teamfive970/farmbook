import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole } from "../middleware/auth.js";
import { getInsights } from "../services/insightsService.js";

// "My farm insights" for the signed-in farmer.
const router = Router();
router.use(authenticate, requireRole("farmer"));
// The AI summary costs money per call, so each farmer can ask a few times an hour.
router.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => req.auth.userId,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
  })
);

router.get("/", async (req, res) => {
  res.json(await getInsights(req.auth.userId));
});

export default router;

import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { farmerSummary } from "../services/reportService.js";

const router = Router();
router.use(authenticate, requireRole("farmer"));

router.get("/summary", async (req, res) => {
  res.json(await farmerSummary(req.auth.userId, req.query));
});

export default router;

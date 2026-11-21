import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { pinCheckLimiter } from "../middleware/rateLimit.js";
import {
  cooperativeDashboard,
  joinCooperative,
  leaveCooperative,
  myCooperatives
} from "../services/cooperativeService.js";

const router = Router();
router.use(authenticate, requireRole("farmer"));

router.get("/mine", async (req, res) => {
  res.json(await myCooperatives(req.auth.userId));
});

// Rate limited so join codes cannot be guessed.
router.post("/join", pinCheckLimiter, async (req, res) => {
  res.json(await joinCooperative(req.auth.userId, req.body));
});

router.post("/:id/leave", async (req, res) => {
  res.json(await leaveCooperative(req.auth.userId, req.params.id));
});

router.get("/:id/dashboard", async (req, res) => {
  res.json(await cooperativeDashboard(req.auth.userId, req.params.id, req.query));
});

export default router;

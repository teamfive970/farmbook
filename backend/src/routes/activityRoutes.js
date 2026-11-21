import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  createActivity,
  deleteActivity,
  getActivity,
  listActivities,
  updateActivity
} from "../services/activityService.js";

const router = Router();

router.use(authenticate, requireRole("farmer"));

router.get("/", async (req, res) => {
  const result = await listActivities(req.auth.userId, req.query);
  res.json(result);
});

router.post("/", async (req, res) => {
  const result = await createActivity(req.auth.userId, req.body);
  res.status(result.created ? 201 : 200).json(result);
});

router.get("/:id", async (req, res) => {
  const activity = await getActivity(req.auth.userId, req.params.id);
  res.json({ activity });
});

router.patch("/:id", async (req, res) => {
  const activity = await updateActivity(req.auth.userId, req.params.id, req.body);
  res.json({ activity });
});

router.delete("/:id", async (req, res) => {
  const result = await deleteActivity(req.auth.userId, req.params.id);
  res.json(result);
});

export default router;

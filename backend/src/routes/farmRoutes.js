import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createFarm, getFarm, listFarms, updateFarm } from "../services/farmService.js";

const router = Router();

router.use(authenticate, requireRole("farmer"));

router.get("/", async (req, res) => {
  const farms = await listFarms(req.auth.userId);
  res.json({ farms });
});

router.post("/", async (req, res) => {
  const result = await createFarm(req.auth.userId, req.body);
  res.status(result.created ? 201 : 200).json(result);
});

router.get("/:id", async (req, res) => {
  const farm = await getFarm(req.auth.userId, req.params.id);
  res.json({ farm });
});

router.patch("/:id", async (req, res) => {
  const farm = await updateFarm(req.auth.userId, req.params.id, req.body);
  res.json({ farm });
});

export default router;

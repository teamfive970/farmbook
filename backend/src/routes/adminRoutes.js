import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import {
  getDashboard,
  getFarmerDetail,
  listFarmers,
  resetFarmerPin,
  revealAdminAccessCode,
  rotateAdminCredentials,
  setFarmerStatus,
  updateFarmer
} from "../services/adminService.js";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/dashboard", async (req, res) => {
  const result = await getDashboard();
  res.json(result);
});

router.get("/farmers", async (req, res) => {
  const result = await listFarmers(req.query);
  res.json(result);
});

router.get("/farmers/:id", async (req, res) => {
  const result = await getFarmerDetail(req.params.id);
  res.json(result);
});

router.patch("/farmers/:id", async (req, res) => {
  const result = await updateFarmer(req.auth, req.params.id, req.body);
  res.json(result);
});

router.post("/farmers/:id/deactivate", async (req, res) => {
  const farmer = await setFarmerStatus(req.auth, req.params.id, "inactive");
  res.json({ farmer, message: "Farmer account deactivated." });
});

router.post("/farmers/:id/reactivate", async (req, res) => {
  const farmer = await setFarmerStatus(req.auth, req.params.id, "active");
  res.json({ farmer, message: "Farmer account reactivated." });
});

router.post("/farmers/:id/reset-pin", loginLimiter, async (req, res) => {
  const result = await resetFarmerPin(req.auth, req.params.id, req.body);
  res.json(result);
});

router.patch("/me/credentials", async (req, res) => {
  const admin = await rotateAdminCredentials(req.auth, req.body);
  res.json({ admin, message: "Your admin credentials have been updated." });
});

router.post("/me/access-code/reveal", loginLimiter, async (req, res) => {
  const result = await revealAdminAccessCode(req.auth, req.body);
  res.json(result);
});

export default router;

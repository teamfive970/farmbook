import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { pinCheckLimiter } from "../middleware/rateLimit.js";
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
import {
  adminAddMember,
  adminCreateCooperative,
  adminGetCooperative,
  adminListCooperatives,
  adminRemoveMember,
  adminSetMemberRole,
  adminUpdateCooperative
} from "../services/cooperativeService.js";

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

router.post("/farmers/:id/reset-pin", pinCheckLimiter, async (req, res) => {
  const result = await resetFarmerPin(req.auth, req.params.id, req.body);
  res.json(result);
});

router.patch("/me/credentials", pinCheckLimiter, async (req, res) => {
  const admin = await rotateAdminCredentials(req.auth, req.body);
  res.json({ admin, message: "Your admin credentials have been updated." });
});

router.post("/me/access-code/reveal", pinCheckLimiter, async (req, res) => {
  const result = await revealAdminAccessCode(req.auth, req.body);
  res.json(result);
});

router.get("/cooperatives", async (req, res) => {
  res.json(await adminListCooperatives());
});

router.post("/cooperatives", async (req, res) => {
  res.status(201).json(await adminCreateCooperative(req.auth, req.body));
});

router.get("/cooperatives/:id", async (req, res) => {
  res.json(await adminGetCooperative(req.params.id, req.query));
});

router.patch("/cooperatives/:id", async (req, res) => {
  res.json(await adminUpdateCooperative(req.auth, req.params.id, req.body));
});

router.post("/cooperatives/:id/members", async (req, res) => {
  res.status(201).json(await adminAddMember(req.auth, req.params.id, req.body));
});

router.patch("/cooperatives/:id/members/:farmerId", async (req, res) => {
  res.json(await adminSetMemberRole(req.auth, req.params.id, req.params.farmerId, req.body));
});

router.delete("/cooperatives/:id/members/:farmerId", async (req, res) => {
  res.json(await adminRemoveMember(req.auth, req.params.id, req.params.farmerId));
});

export default router;

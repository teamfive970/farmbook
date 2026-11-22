import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  adminExportLimiter,
  adminReadLimiter,
  pinCheckLimiter
} from "../middleware/rateLimit.js";
import { writeAudit } from "../lib/audit.js";
import {
  getDashboard,
  getFarmerDetail,
  listAuditLog,
  listFarmers,
  resetFarmerPin,
  revealAdminAccessCode,
  revealFarmerPhone,
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
import { exportDataset, getAnalytics } from "../services/analyticsService.js";
import {
  listAnnouncements,
  previewAudience,
  sendAnnouncement
} from "../services/notificationService.js";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/dashboard", adminReadLimiter, async (req, res) => {
  const result = await getDashboard();
  res.json(result);
});

router.get("/analytics", adminReadLimiter, async (req, res) => {
  res.json(await getAnalytics(req.query));
});

// CSV downloads for reporting. Each file needs a written purpose, is capped in
// size and is written to the audit log. Farmer phone numbers stay masked.
router.get("/exports/:dataset", adminExportLimiter, async (req, res) => {
  const dataset = String(req.params.dataset).replace(/\.csv$/i, "");
  const { filename, csv, rowCount, truncated, scope } = await exportDataset(dataset, req.query);
  await writeAudit({
    adminUserId: req.auth.userId,
    action: "data_exported",
    targetType: "export",
    targetId: dataset,
    metadata: {
      from: scope.from,
      to: scope.to,
      county: scope.county,
      purpose: scope.purpose,
      rowCount,
      truncated
    },
    reason: scope.purpose,
    req
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Export-Rows", String(rowCount));
  res.setHeader("X-Export-Truncated", truncated ? "yes" : "no");
  res.send(csv);
});

router.get("/farmers", adminReadLimiter, async (req, res) => {
  const result = await listFarmers(req.auth, req, req.query);
  res.json(result);
});

// ?reason=... is required: the audit log records why the record was opened.
router.get("/farmers/:id", adminReadLimiter, async (req, res) => {
  const result = await getFarmerDetail(req.auth, req, req.params.id, req.query.reason);
  res.json(result);
});

router.post("/farmers/:id/reveal-phone", pinCheckLimiter, async (req, res) => {
  const result = await revealFarmerPhone(req.auth, req, req.params.id, req.body);
  res.json(result);
});

router.patch("/farmers/:id", async (req, res) => {
  const result = await updateFarmer(req.auth, req, req.params.id, req.body);
  res.json(result);
});

router.post("/farmers/:id/deactivate", async (req, res) => {
  const farmer = await setFarmerStatus(req.auth, req, req.params.id, "inactive");
  res.json({ farmer, message: "Farmer account deactivated." });
});

router.post("/farmers/:id/reactivate", async (req, res) => {
  const farmer = await setFarmerStatus(req.auth, req, req.params.id, "active");
  res.json({ farmer, message: "Farmer account reactivated." });
});

router.post("/farmers/:id/reset-pin", pinCheckLimiter, async (req, res) => {
  const result = await resetFarmerPin(req.auth, req, req.params.id, req.body);
  res.json(result);
});

router.get("/audit", adminReadLimiter, async (req, res) => {
  res.json(await listAuditLog(req.auth, req, req.query));
});

router.patch("/me/credentials", pinCheckLimiter, async (req, res) => {
  const admin = await rotateAdminCredentials(req.auth, req, req.body);
  res.json({ admin, message: "Your admin credentials have been updated." });
});

router.post("/me/access-code/reveal", pinCheckLimiter, async (req, res) => {
  const result = await revealAdminAccessCode(req.auth, req, req.body);
  res.json(result);
});

router.get("/cooperatives", adminReadLimiter, async (req, res) => {
  res.json(await adminListCooperatives(req.auth, req));
});

router.post("/cooperatives", async (req, res) => {
  res.status(201).json(await adminCreateCooperative(req.auth, req, req.body));
});

router.get("/cooperatives/:id", adminReadLimiter, async (req, res) => {
  res.json(await adminGetCooperative(req.auth, req, req.params.id, req.query));
});

router.patch("/cooperatives/:id", async (req, res) => {
  res.json(await adminUpdateCooperative(req.auth, req, req.params.id, req.body));
});

router.post("/cooperatives/:id/members", async (req, res) => {
  res.status(201).json(await adminAddMember(req.auth, req, req.params.id, req.body));
});

router.patch("/cooperatives/:id/members/:farmerId", async (req, res) => {
  res.json(await adminSetMemberRole(req.auth, req, req.params.id, req.params.farmerId, req.body));
});

router.delete("/cooperatives/:id/members/:farmerId", async (req, res) => {
  res.json(await adminRemoveMember(req.auth, req, req.params.id, req.params.farmerId));
});

// Announcements: a message to every farmer, one county or one group, shown in
// their app inbox and, if chosen, sent by SMS to farmers who allow it.
router.get("/announcements", adminReadLimiter, async (req, res) => {
  res.json(await listAnnouncements());
});

router.get("/announcements/audience", adminReadLimiter, async (req, res) => {
  res.json(await previewAudience({ type: req.query.type, value: req.query.value }));
});

router.post("/announcements", async (req, res) => {
  res.status(201).json(await sendAnnouncement(req.auth, req, req.body));
});

export default router;

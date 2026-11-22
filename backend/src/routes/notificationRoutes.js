import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  updateNotificationSettings
} from "../services/notificationService.js";

// The farmer's inbox: announcements, reminders and app messages.
const router = Router();
router.use(authenticate, requireRole("farmer"));

router.get("/", async (req, res) => {
  res.json(await listNotifications(req.auth.userId));
});

router.get("/unread-count", async (req, res) => {
  res.json(await getUnreadCount(req.auth.userId));
});

router.post("/read-all", async (req, res) => {
  res.json(await markAllRead(req.auth.userId));
});

router.post("/:id/read", async (req, res) => {
  res.json(await markRead(req.auth.userId, req.params.id));
});

router.patch("/settings", async (req, res) => {
  res.json(await updateNotificationSettings(req.auth.userId, req.body));
});

export default router;

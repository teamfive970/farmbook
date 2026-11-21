import { Router } from "express";
import { checkDatabase } from "../config/database.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "minders-api" });
});

router.get("/ready", async (_req, res) => {
  try {
    await checkDatabase();
    res.json({ status: "ready", database: "connected" });
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      database: "unavailable",
      message: process.env.NODE_ENV === "production"
        ? "Database is unavailable"
        : error.message
    });
  }
});

export default router;
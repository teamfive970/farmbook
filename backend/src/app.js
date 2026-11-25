import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { checkDatabase } from "./config/database.js";
import { publicDemoAccess } from "./lib/demoAccess.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import activityRoutes from "./routes/activityRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import farmRoutes from "./routes/farmRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import buyerRequestRoutes from "./routes/buyerRequestRoutes.js";
import marketRoutes from "./routes/marketRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import ussdRoutes from "./routes/ussdRoutes.js";
import cooperativeRoutes from "./routes/cooperativeRoutes.js";
import passportRoutes from "./routes/passportRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { resourceRouter } from "./routes/resourceRoutes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "../../frontend/dist");

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
];

function allowedOrigins() {
  const configured = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configured.length ? configured : [...defaultOrigins];
  // The server's own public address (Railway sets RAILWAY_PUBLIC_DOMAIN).
  // When the app and the API share one address no CORS is needed, but this
  // keeps a separately hosted copy of the web app on that address working too.
  if (process.env.RAILWAY_PUBLIC_DOMAIN) origins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  if (process.env.PUBLIC_URL) origins.push(process.env.PUBLIC_URL.replace(/\/+$/, ""));
  return origins.map((origin) => origin.replace(/\/+$/, ""));
}

const STARTED_AT = new Date().toISOString();

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

  const origins = allowedOrigins();
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      // Lets the admin app read the CSV file name on cross-origin downloads.
      exposedHeaders: ["Content-Disposition"]
    })
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "farmbok-api",
      // Lets you check that the running server has the latest code.
      features: ["offline-sessions", "harvests", "sales", "cooperatives", "passport", "admin-analytics"],
      startedAt: STARTED_AT,
      time: new Date().toISOString()
    });
  });

  app.get("/api/ready", async (req, res) => {
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  // Shared tester login for the home page (only when DEMO_ADMIN_* are set).
  app.get("/api/public/demo-access", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(publicDemoAccess());
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/farms", farmRoutes);
  app.use("/api/activities", activityRoutes);
  app.use("/api/productions", resourceRouter("productions"));
  app.use("/api/animalEvents", resourceRouter("animalEvents"));
  app.use("/api/harvests", resourceRouter("harvests"));
  app.use("/api/inspections", resourceRouter("inspections"));
  app.use("/api/buyers", resourceRouter("buyers"));
  app.use("/api/sales", resourceRouter("sales"));
  app.use("/api/payments", resourceRouter("payments"));
  app.use("/api/expenses", resourceRouter("expenses"));
  app.use("/api/reports", reportRoutes);
  app.use("/api/cooperatives", cooperativeRoutes);
  app.use("/api/passport", passportRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/buyer-requests", buyerRequestRoutes);
  app.use("/api/market", marketRoutes);
  app.use("/api/weather", weatherRoutes);
  app.use("/api/ussd", ussdRoutes);
  app.use("/api/admin", adminRoutes);

  app.use("/api", notFoundHandler);

  if (existsSync(path.join(distDir, "index.html"))) {
    app.use(express.static(distDir, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

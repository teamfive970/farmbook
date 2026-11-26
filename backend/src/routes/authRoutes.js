import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { loginLimiter, pinCheckLimiter, registerLimiter, smsLimiter } from "../middleware/rateLimit.js";
import {
  changePin,
  login,
  logout,
  registerFarmer,
  setPreferredLanguage,
  setupRecoveryQuestion
} from "../services/authService.js";
import {
  recoverWithSecurityQuestion,
  recoverWithSms,
  recoveryOptions,
  requestSmsRecovery
} from "../services/recoveryService.js";
import { blockDemoAdmin } from "../lib/demoAccess.js";

const router = Router();

router.post("/register", registerLimiter, async (req, res) => {
  const result = await registerFarmer(req.body);
  res.status(201).json(result);
});

router.post("/login", loginLimiter, async (req, res) => {
  const result = await login(req.body);
  res.json(result);
});

router.post("/logout", authenticate, async (req, res) => {
  await logout(req.auth.sessionId);
  res.json({ message: "You have been signed out." });
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.auth.user });
});

router.put("/language", authenticate, async (req, res) => {
  res.json(await setPreferredLanguage(req.auth, req.body));
});

router.post("/pin", authenticate, pinCheckLimiter, async (req, res) => {
  await blockDemoAdmin(req);
  const result = await changePin(req.auth, req.body);
  res.json(result);
});

router.post("/recovery/setup", authenticate, pinCheckLimiter, async (req, res) => {
  await blockDemoAdmin(req);
  const result = await setupRecoveryQuestion(req.auth, req.body);
  res.json(result);
});

router.get("/recovery/options", (req, res) => {
  res.json(recoveryOptions());
});

router.post("/recovery/security-question", loginLimiter, async (req, res) => {
  const result = await recoverWithSecurityQuestion(req.body);
  res.json(result);
});

router.post("/recovery/sms/request", smsLimiter, async (req, res) => {
  const result = await requestSmsRecovery(req.body);
  res.json(result);
});

router.post("/recovery/sms/verify", loginLimiter, async (req, res) => {
  const result = await recoverWithSms(req.body);
  res.json(result);
});

export default router;

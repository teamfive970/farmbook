import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { declineRequest, listBuyerRequests, markCalled, shareNumber } from "../services/buyerRequestService.js";

// The farmer's "Buyer requests": buyers who asked about a harvest from its passport.
const router = Router();
router.use(authenticate, requireRole("farmer"));

router.get("/", async (req, res) => {
  res.json(await listBuyerRequests(req.auth.userId));
});

router.post("/:id/share", async (req, res) => {
  res.json(await shareNumber(req.auth.userId, req.params.id));
});

router.post("/:id/called", async (req, res) => {
  res.json(await markCalled(req.auth.userId, req.params.id));
});

router.post("/:id/decline", async (req, res) => {
  res.json(await declineRequest(req.auth.userId, req.params.id));
});

export default router;

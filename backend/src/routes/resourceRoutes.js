import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord
} from "../services/resourceService.js";

// Same five endpoints for each farmer record type (see resourceService.js).
export function resourceRouter(name) {
  const router = Router();
  router.use(authenticate, requireRole("farmer"));

  router.get("/", async (req, res) => {
    res.json(await listRecords(name, req.auth.userId, req.query));
  });

  router.post("/", async (req, res) => {
    const result = await createRecord(name, req.auth.userId, req.body);
    res.status(result.created ? 201 : 200).json(result);
  });

  router.get("/:id", async (req, res) => {
    res.json({ record: await getRecord(name, req.auth.userId, req.params.id) });
  });

  router.patch("/:id", async (req, res) => {
    res.json({ record: await updateRecord(name, req.auth.userId, req.params.id, req.body) });
  });

  router.delete("/:id", async (req, res) => {
    res.json(await deleteRecord(name, req.auth.userId, req.params.id));
  });

  return router;
}

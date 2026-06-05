import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { monitorService } from "../services/monitor.service";

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  intervalMinutes: z.number().int().min(1).max(60).default(5),
});

router.get("/", async (req, res, next) => {
  try {
    const monitors = await monitorService.listByUser(req.user.id);
    res.json({ success: true, data: monitors });
  } catch (err) {
    next(err);
  }
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const monitor = await monitorService.create(req.user.id, req.body);
    res.status(201).json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const monitor = await monitorService.getById(req.params.id, req.user.id);
    res.json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  intervalMinutes: z.number().int().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
  paused: z.boolean().optional(),
  agentId: z.string().uuid().nullable().optional(),
});

router.patch("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const monitor = await monitorService.update(req.params.id, req.user.id, req.body);
    res.json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await monitorService.delete(req.params.id, req.user.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

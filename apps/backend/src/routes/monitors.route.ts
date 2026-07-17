import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { monitorService } from "../services/monitor.service";
import { SnoozeContentChangeSchema, SyntheticStepsSchema } from "@watchdog/shared-types";

const router = Router();
router.use(authenticate);

const createSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().url(),
    intervalMinutes: z.number().int().min(1).max(60).default(5),
    agentId: z.string().uuid().optional(),
    type: z.enum(["http", "synthetic"]).default("http"),
    syntheticSteps: SyntheticStepsSchema.optional(),
  })
  .refine((data) => data.type !== "synthetic" || (data.syntheticSteps && data.syntheticSteps.length > 0), {
    message: "syntheticSteps is required when type is 'synthetic'",
    path: ["syntheticSteps"],
  })
  .refine((data) => data.type !== "synthetic" || data.intervalMinutes >= 5, {
    message: "Synthetic monitors require an interval of at least 5 minutes",
    path: ["intervalMinutes"],
  });

router.get("/", async (req, res, next) => {
  try {
    const monitors = await monitorService.listByUser(req.user.id);
    res.json({ success: true, data: monitors });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("admin"), validate(createSchema), async (req, res, next) => {
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
  contentChangeEnabled: z.boolean().optional(),
  regionDownThreshold: z.number().int().min(1).max(10).optional(),
  lighthouseEnabled: z.boolean().optional(),
  lighthousePerformanceBudget: z.number().int().min(0).max(100).optional(),
  lighthouseAccessibilityBudget: z.number().int().min(0).max(100).optional(),
  lighthouseBestPracticesBudget: z.number().int().min(0).max(100).optional(),
  lighthouseSeoBudget: z.number().int().min(0).max(100).optional(),
  syntheticSteps: SyntheticStepsSchema.optional(),
});

router.patch("/:id", requireRole("admin"), validate(updateSchema), async (req, res, next) => {
  try {
    const monitor = await monitorService.update(req.params.id, req.user.id, req.body);
    res.json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/agents/:agentId", requireRole("admin"), async (req, res, next) => {
  try {
    const monitor = await monitorService.assignAgent(req.params.id, req.user.id, req.params.agentId);
    res.json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/agents/:agentId", requireRole("admin"), async (req, res, next) => {
  try {
    const monitor = await monitorService.unassignAgent(req.params.id, req.user.id, req.params.agentId);
    res.json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/regions", async (req, res, next) => {
  try {
    const regions = await monitorService.getRegionStatus(req.params.id, req.user.id);
    res.json({ success: true, data: regions });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/snooze-content-change", validate(SnoozeContentChangeSchema), async (req, res, next) => {
  try {
    const monitor = await monitorService.snoozeContentChange(req.params.id, req.user.id, req.body.hours);
    res.json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await monitorService.delete(req.params.id, req.user.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

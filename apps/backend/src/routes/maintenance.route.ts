import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { monitorService } from "../services/monitor.service";
import { maintenanceRepository } from "../repositories/maintenance.repository";

const router = Router({ mergeParams: true });
router.use(authenticate);

const createSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  description: z.string().max(200).optional(),
}).refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
});

router.get("/", async (req: any, res, next) => {
  try {
    await monitorService.getById(req.params.id, req.user.id);
    const windows = await maintenanceRepository.findUpcoming(req.params.id);
    res.json({ success: true, data: windows });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("admin"), validate(createSchema), async (req: any, res, next) => {
  try {
    await monitorService.getById(req.params.id, req.user.id);
    const window = await maintenanceRepository.create({
      monitorId: req.params.id,
      startsAt: new Date(req.body.startsAt),
      endsAt: new Date(req.body.endsAt),
      description: req.body.description,
    });
    res.status(201).json({ success: true, data: window });
  } catch (err) {
    next(err);
  }
});

router.delete("/:windowId", requireRole("admin"), async (req: any, res, next) => {
  try {
    await monitorService.getById(req.params.id, req.user.id);
    const window = await maintenanceRepository.findById(req.params.windowId);
    if (!window || window.monitorId !== req.params.id) {
      return res.status(404).json({ error: "Maintenance window not found" });
    }
    await maintenanceRepository.delete(req.params.windowId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

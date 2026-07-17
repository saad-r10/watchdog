import { Router } from "express";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { statusPageService } from "../services/status-page.service";
import { CreateStatusPageSchema, UpdateStatusPageMonitorsSchema } from "@watchdog/shared-types";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const pages = await statusPageService.list(req.user.id);
    res.json({ success: true, data: pages });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("admin"), validate(CreateStatusPageSchema), async (req, res, next) => {
  try {
    const page = await statusPageService.create(req.user.id, req.body.slug, req.body.title);
    res.status(201).json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await statusPageService.delete(req.params.id, req.user.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.put("/:id/monitors", requireRole("admin"), validate(UpdateStatusPageMonitorsSchema), async (req, res, next) => {
  try {
    await statusPageService.setMonitors(req.params.id, req.user.id, req.body.monitorIds);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

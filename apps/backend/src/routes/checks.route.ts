import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { monitorService } from "../services/monitor.service";
import { checkRepository } from "../repositories/check.repository";
import { incidentRepository } from "../repositories/incident.repository";

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get("/checks", async (req, res, next) => {
  try {
    const id = req.params["id"];
    await monitorService.getById(id, req.user.id);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const checks = await checkRepository.findByMonitor(id, limit);
    res.json({ success: true, data: checks });
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const id = req.params["id"];
    await monitorService.getById(id, req.user.id);
    const days = Math.min(Number(req.query.days) || 7, 30);
    const since = new Date(Date.now() - days * 86_400_000);
    const [stats, latest] = await Promise.all([
      checkRepository.getStats(id, since),
      checkRepository.getLatest(id),
    ]);
    res.json({ success: true, data: { ...stats, lastStatus: latest?.status ?? null, lastCheckedAt: latest?.checkedAt ?? null } });
  } catch (err) {
    next(err);
  }
});

router.get("/incidents", async (req, res, next) => {
  try {
    const id = req.params["id"];
    await monitorService.getById(id, req.user.id);
    const incidents = await incidentRepository.findByMonitor(id);
    res.json({ success: true, data: incidents });
  } catch (err) {
    next(err);
  }
});

router.get("/ssl", async (req, res, next) => {
  try {
    const id = req.params["id"];
    await monitorService.getById(id, req.user.id);
    const check = await checkRepository.findLatestByType(id, "ssl");
    res.json({ success: true, data: check ?? null });
  } catch (err) {
    next(err);
  }
});

router.get("/headers", async (req, res, next) => {
  try {
    const id = req.params["id"];
    await monitorService.getById(id, req.user.id);
    const check = await checkRepository.findLatestByType(id, "headers");
    res.json({ success: true, data: check ?? null });
  } catch (err) {
    next(err);
  }
});

export default router;

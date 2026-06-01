import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { alertRepository } from "../repositories/alert.repository";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const alerts = await alertRepository.findRecentByUser(req.user.id, 20);
    const data = alerts.map((a) => ({
      id: a.id,
      sentAt: a.sentAt,
      incidentId: a.incidentId,
      alertType: a.type,
      type: a.incident.type,
      isResolved: a.incident.isResolved,
      resolvedAt: a.incident.resolvedAt,
      startedAt: a.incident.startedAt,
      monitorId: a.incident.monitor.id,
      monitorName: a.incident.monitor.name,
      monitorUrl: a.incident.monitor.url,
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { agentService } from "../services/agent.service";
import { AgentCheckResultSchema } from "@watchdog/shared-types";

const router = Router();

// User-facing CRUD (requires JWT)
router.get("/", authenticate, async (req, res, next) => {
  try {
    const agents = await agentService.list(req.user.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safe = agents.map(({ keyHash, ...a }) => a);
    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  authenticate,
  validate(z.object({ name: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const { agent, key } = await agentService.create(req.user.id, req.body.name);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { keyHash, ...safeAgent } = agent;
      res.status(201).json({ success: true, data: { ...safeAgent, key } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    await agentService.delete(req.params.id, req.user.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Agent checkin endpoint (uses agent key, not JWT)
router.post("/checkin", validate(AgentCheckResultSchema), async (req, res, next) => {
  try {
    const key = req.headers["x-agent-key"];
    if (!key || typeof key !== "string") {
      return res.status(401).json({ error: "Missing X-Agent-Key header" });
    }

    const agentId = await agentService.verifyKey(key);
    if (!agentId) {
      return res.status(401).json({ error: "Invalid agent key" });
    }

    await agentService.recordCheckin(agentId, req.body.results);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

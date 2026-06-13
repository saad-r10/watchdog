import { Router } from "express";
import { z } from "zod";
import path from "path";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { authenticateAgent } from "../middleware/agent-auth";
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

// Download the standalone agent runner bundle
router.get("/runner", (_req, res) => {
  const bundlePath = path.join(__dirname, "../../dist/agent-runner.bundle.js");
  res.download(bundlePath, "agent-runner.js");
});

// Agent-facing endpoints (use agent key, not JWT)
router.get("/config", authenticateAgent, async (req, res, next) => {
  try {
    const monitors = await agentService.getConfig(req.agentId);
    res.json({ success: true, data: { monitors } });
  } catch (err) {
    next(err);
  }
});

router.post("/checkin", authenticateAgent, validate(AgentCheckResultSchema), async (req, res, next) => {
  try {
    await agentService.recordCheckin(req.agentId, req.body.results);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

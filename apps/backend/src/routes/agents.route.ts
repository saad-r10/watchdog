import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { authenticateAgent } from "../middleware/agent-auth";
import { agentService } from "../services/agent.service";
import { AgentCheckResultSchema, CreateAgentSchema, UpdateAgentSchema } from "@watchdog/shared-types";

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

router.post("/", authenticate, validate(CreateAgentSchema), async (req, res, next) => {
  try {
    const { agent, key } = await agentService.create(req.user.id, req.body.name, req.body.region);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyHash, ...safeAgent } = agent;
    res.status(201).json({ success: true, data: { ...safeAgent, key } });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authenticate, validate(UpdateAgentSchema), async (req, res, next) => {
  try {
    const agent = await agentService.update(req.params.id, req.user.id, req.body);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyHash, ...safeAgent } = agent;
    res.json({ success: true, data: safeAgent });
  } catch (err) {
    next(err);
  }
});

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

// One-line installer script with this server's URL templated in.
// Resolves under both ts-node (src/routes) and compiled (dist/routes) layouts.
router.get("/install.sh", async (req, res, next) => {
  try {
    const scriptPath = path.join(__dirname, "../../scripts/install-agent.sh");
    const script = await fs.readFile(scriptPath, "utf-8");
    const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)
      ?.split(",")[0]
      ?.trim();
    const baseUrl = `${forwardedProto ?? req.protocol}://${req.get("host")}`;
    res.type("text/x-shellscript").send(script.replace(/__WATCHDOG_URL__/g, baseUrl));
  } catch (err) {
    next(err);
  }
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

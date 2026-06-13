import { Request, Response, NextFunction } from "express";
import { agentService } from "../services/agent.service";

declare module "express-serve-static-core" {
  interface Request {
    agentId: string;
  }
}

export async function authenticateAgent(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.headers["x-agent-key"];
    if (!key || typeof key !== "string") {
      return res.status(401).json({ error: "Missing X-Agent-Key header" });
    }

    const agentId = await agentService.verifyKey(key);
    if (!agentId) {
      return res.status(401).json({ error: "Invalid agent key" });
    }

    req.agentId = agentId;
    next();
  } catch (err) {
    next(err);
  }
}

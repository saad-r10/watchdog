import { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { verifyToken } from "../lib/jwt";

declare module "express-serve-static-core" {
  interface Request {
    user: { id: string; email: string; role: UserRole };
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = verifyToken<{ id: string; email: string; role?: UserRole }>(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role ?? "owner" };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

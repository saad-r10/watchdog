import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

declare module "express-serve-static-core" {
  interface Request {
    user: { id: string; email: string; role: UserRole };
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string; role?: UserRole };
    req.user = { id: payload.id, email: payload.email, role: payload.role ?? "owner" };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

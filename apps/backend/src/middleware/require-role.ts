import { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";

const ROLE_ORDER: UserRole[] = ["viewer", "admin", "owner"];

export function requireRole(minimum: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req.user as any).role as UserRole | undefined;
    if (!userRole || ROLE_ORDER.indexOf(userRole) < ROLE_ORDER.indexOf(minimum)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

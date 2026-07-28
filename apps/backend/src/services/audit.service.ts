import { AuditAction, Prisma } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../db";

export type { AuditAction };

interface LogOptions {
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  req?: Request;
  metadata?: Prisma.InputJsonValue;
}

export const auditService = {
  log(opts: LogOptions): void {
    const { req, userId, ...rest } = opts;
    const entry: Prisma.AuditLogUncheckedCreateInput = {
      ...rest,
      userId,
      ipAddress: req ? (req.ip ?? (req.socket.remoteAddress as string)) : undefined,
      userAgent: req ? (req.headers["user-agent"] as string | undefined) : undefined,
    };
    // Fire-and-forget — never block the response path
    prisma.auditLog.create({ data: entry }).catch((err) => {
      console.error("[audit] failed to write log entry:", err);
    });
  },
};

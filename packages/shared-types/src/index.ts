import { z } from "zod";

export const CreateMonitorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  intervalMinutes: z.number().int().min(1).max(60).default(5),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export const LoginSchema = RegisterSchema.omit({ name: true });

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export interface Monitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  intervalMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Check {
  id: string;
  monitorId: string;
  type: "uptime" | "ssl" | "headers";
  status: string;
  statusCode?: number | null;
  responseTime?: number | null;
  sslDaysLeft?: number | null;
  headers?: Record<string, unknown> | null;
  checkedAt: string;
}

export interface Incident {
  id: string;
  monitorId: string;
  type: "downtime" | "ssl_expiry" | "header_missing";
  startedAt: string;
  resolvedAt?: string | null;
  isResolved: boolean;
}

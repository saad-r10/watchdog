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

export const SECURITY_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
] as const;

export type SecurityHeader = (typeof SECURITY_HEADERS)[number];

export interface SslCheckResult {
  status: "valid" | "expiring_soon" | "expired" | "error" | null;
  sslDaysLeft: number | null;
  checkedAt: string | null;
}

export interface HeadersCheckResult {
  status: "pass" | "fail" | "error" | null;
  headers: {
    present: Record<string, string>;
    missing: string[];
  } | null;
  checkedAt: string | null;
}

export interface MonitorStats {
  uptimePercent: number | null;
  avgResponseTime: number | null;
  totalChecks: number;
  lastStatus: "up" | "down" | null;
  lastCheckedAt: string | null;
}

export interface Incident {
  id: string;
  monitorId: string;
  type: "downtime" | "ssl_expiry" | "header_missing";
  startedAt: string;
  resolvedAt?: string | null;
  isResolved: boolean;
}

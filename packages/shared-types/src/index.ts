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

export interface AlertSettings {
  alertEmail: string | null;
  alertDowntime: boolean;
  alertSslExpiry: boolean;
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

export const CreateAgentSchema = z.object({
  name: z.string().min(1),
});

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export interface Agent {
  id: string;
  userId: string;
  name: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface AgentWithKey extends Agent {
  key: string;
}

export const AgentCheckResultSchema = z.object({
  results: z.array(
    z.object({
      monitorId: z.string(),
      type: z.enum(["uptime", "ssl", "headers"]),
      status: z.string(),
      statusCode: z.number().int().optional(),
      responseTime: z.number().int().optional(),
      sslDaysLeft: z.number().int().optional(),
      headers: z
        .object({
          present: z.array(z.string()),
          missing: z.array(z.string()),
        })
        .optional(),
    })
  ),
});

export type AgentCheckResult = z.infer<typeof AgentCheckResultSchema>;

export interface Monitor {
  id: string;
  userId: string;
  agentId: string | null;
  name: string;
  url: string;
  intervalMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CreateStatusPageSchema = z.object({
  slug: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  title: z.string().min(1).max(80),
});

export const UpdateStatusPageMonitorsSchema = z.object({
  monitorIds: z.array(z.string()),
});

export type CreateStatusPageInput = z.infer<typeof CreateStatusPageSchema>;

export interface StatusPage {
  id: string;
  userId: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyBar {
  date: string;
  uptimePercent: number | null;
}

export interface StatusPageMonitorEntry {
  id: string;
  name: string;
  url: string;
  status: "up" | "down" | "unknown";
  uptimePercent: number | null;
  dailyBars: DailyBar[];
}

export interface PublicStatusPage {
  page: { slug: string; title: string };
  overall: "operational" | "degraded" | "outage";
  monitors: StatusPageMonitorEntry[];
  updatedAt: string;
}

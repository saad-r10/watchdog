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

export const UpdateMonitorSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  intervalMinutes: z.number().int().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
  paused: z.boolean().optional(),
  contentChangeEnabled: z.boolean().optional(),
  regionDownThreshold: z.number().int().min(1).max(10).optional(),
});
export type UpdateMonitorInput = z.infer<typeof UpdateMonitorSchema>;

export const SnoozeContentChangeSchema = z.object({
  hours: z.number().int().min(1).max(168),
});
export type SnoozeContentChangeInput = z.infer<typeof SnoozeContentChangeSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export interface Check {
  id: string;
  monitorId: string;
  type: "uptime" | "ssl" | "headers" | "metric" | "cert_transparency" | "dns" | "exposure" | "blocklist";
  status: string;
  statusCode?: number | null;
  responseTime?: number | null;
  dnsMs?: number | null;
  tcpMs?: number | null;
  tlsMs?: number | null;
  ttfbMs?: number | null;
  downloadMs?: number | null;
  sizeBytes?: number | null;
  sslDaysLeft?: number | null;
  agentId?: string | null;
  headers?: Record<string, unknown> | null;
  ctNewCerts?: CertTransparencyEntry[] | null;
  dnsFindings?: DnsFindings | null;
  exposureFindings?: ExposureFindings | null;
  blocklistFindings?: BlocklistFindings | null;
  contentHash?: string | null;
  metricName?: string | null;
  metricValue?: number | null;
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

export interface CookieFinding {
  name: string;
  missingSecure: boolean;
  missingHttpOnly: boolean;
  missingSameSite: boolean;
}

export interface MixedContentFinding {
  url: string;
}

export interface HeadersCheckResult {
  status: "pass" | "fail" | "error" | null;
  headers: {
    present: Record<string, string>;
    missing: string[];
    cookies: CookieFinding[];
    mixedContent: MixedContentFinding[];
  } | null;
  checkedAt: string | null;
}

export interface CertTransparencyEntry {
  id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  not_before: string;
  not_after: string;
}

export interface CertTransparencyCertificate {
  id: string;
  monitorId: string;
  crtShId: string;
  commonName: string;
  issuerName: string;
  nameValue: string;
  notBefore: string;
  notAfter: string;
  firstSeenAt: string;
}

export interface CertTransparencyCheckResult {
  status: "ok" | "new_cert" | "baseline" | "error" | null;
  checkedAt: string | null;
  newCerts: CertTransparencyEntry[] | null;
  totalCertificates: number;
  recentCertificates: CertTransparencyCertificate[];
}

export interface SpfFinding {
  present: boolean;
  record: string | null;
  issue: string | null;
}

export interface DmarcFinding {
  present: boolean;
  record: string | null;
  policy: string | null;
  issue: string | null;
}

export interface DkimFinding {
  present: boolean;
  selectors: string[];
  issue: string | null;
}

export interface DanglingCnameFinding {
  present: boolean;
  target: string | null;
  dangling: boolean;
  issue: string | null;
}

export interface DnsFindings {
  spf: SpfFinding;
  dmarc: DmarcFinding;
  dkim: DkimFinding;
  danglingCname: DanglingCnameFinding;
}

export interface DnsCheckResult {
  status: "pass" | "fail" | "error" | null;
  dnsFindings: DnsFindings | null;
  checkedAt: string | null;
}

export interface SecurityTxtFinding {
  present: boolean;
  issue: string | null;
}

export interface ExposedPathFinding {
  path: string;
  exposed: boolean;
  statusCode: number | null;
}

export interface ExposureFindings {
  securityTxt: SecurityTxtFinding;
  exposedPaths: ExposedPathFinding[];
}

export interface ExposureCheckResult {
  status: "pass" | "fail" | "error" | null;
  exposureFindings: ExposureFindings | null;
  checkedAt: string | null;
}

export interface BlocklistSourceFinding {
  source: "urlhaus" | "spamhaus_dbl";
  listed: boolean;
  detail: string | null;
}

export interface BlocklistFindings {
  hostname: string;
  sources: BlocklistSourceFinding[];
}

export interface BlocklistCheckResult {
  status: "clean" | "listed" | "error" | null;
  blocklistFindings: BlocklistFindings | null;
  checkedAt: string | null;
}

export interface ContentChangeStatus {
  enabled: boolean;
  snoozedUntil: string | null;
  lastHash: string | null;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
}

export interface AlertSettings {
  alertEmail: string | null;
  alertDowntime: boolean;
  alertSslExpiry: boolean;
  alertCertTransparency: boolean;
  alertBlocklist: boolean;
  alertContentChange: boolean;
  webhookUrl: string | null;
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
  type: "downtime" | "ssl_expiry" | "header_missing" | "unexpected_cert" | "domain_blocklisted" | "content_changed";
  startedAt: string;
  resolvedAt?: string | null;
  isResolved: boolean;
}

export const CreateAgentSchema = z.object({
  name: z.string().min(1),
  region: z.string().max(64).optional(),
});

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export const UpdateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  region: z.string().max(64).nullable().optional(),
});

export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

export interface AgentMonitor {
  id: string;
  name: string;
  url: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  region: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  monitors: AgentMonitor[];
}

export interface AgentWithKey extends Agent {
  key: string;
}

export const AgentCheckResultSchema = z.object({
  results: z.array(
    z.object({
      monitorId: z.string(),
      type: z.enum(["uptime", "ssl", "headers", "metric"]),
      status: z.string(),
      statusCode: z.number().int().optional(),
      responseTime: z.number().int().optional(),
      dnsMs: z.number().int().nonnegative().optional(),
      tcpMs: z.number().int().nonnegative().optional(),
      tlsMs: z.number().int().nonnegative().optional(),
      ttfbMs: z.number().int().nonnegative().optional(),
      downloadMs: z.number().int().nonnegative().optional(),
      sizeBytes: z.number().int().nonnegative().optional(),
      sslDaysLeft: z.number().int().optional(),
      headers: z
        .object({
          present: z.array(z.string()),
          missing: z.array(z.string()),
        })
        .optional(),
      metricName: z.string().optional(),
      metricValue: z.number().optional(),
    })
  ),
});

export type AgentCheckResult = z.infer<typeof AgentCheckResultSchema>;

export interface MonitorAgentInfo {
  id: string;
  name: string;
  region: string | null;
  lastSeenAt: string | null;
}

export interface Monitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  intervalMinutes: number;
  isActive: boolean;
  paused: boolean;
  contentChangeEnabled: boolean;
  contentChangeSnoozeUntil: string | null;
  regionDownThreshold: number;
  agents: MonitorAgentInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface MonitorRegionStatus {
  agentId: string | null;
  label: string;
  region: string | null;
  status: "up" | "down" | null;
  statusCode: number | null;
  responseTime: number | null;
  checkedAt: string | null;
}

export interface MaintenanceWindow {
  id: string;
  monitorId: string;
  startsAt: string;
  endsAt: string;
  description: string | null;
  createdAt: string;
}

export interface ResponseTimeBucket {
  bucket: string;
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  avgDnsMs: number | null;
  avgTcpMs: number | null;
  avgTlsMs: number | null;
  avgTtfbMs: number | null;
  avgDownloadMs: number | null;
  avgSizeBytes: number | null;
  hasDown: boolean;
}

export type ResponseTimeRange = "24h" | "7d" | "30d";

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

export interface DashboardIncident {
  id: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  type: "downtime" | "ssl_expiry" | "header_missing" | "unexpected_cert" | "domain_blocklisted" | "content_changed";
  startedAt: string;
  resolvedAt: string | null;
  isResolved: boolean;
  durationMinutes: number | null;
}

export interface AppNotification {
  id: string;
  sentAt: string;
  incidentId: string;
  alertType: "downtime" | "recovery";
  type: "downtime" | "ssl_expiry" | "header_missing" | "unexpected_cert" | "domain_blocklisted" | "content_changed";
  isResolved: boolean;
  resolvedAt: string | null;
  startedAt: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
}

export interface DashboardSummary {
  total: number;
  up: number;
  down: number;
  unknown: number;
  avgUptime: number | null;
  activeIncidents: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  recentIncidents: DashboardIncident[];
}

export interface PublicStatusPage {
  page: { slug: string; title: string };
  overall: "operational" | "degraded" | "outage";
  monitors: StatusPageMonitorEntry[];
  updatedAt: string;
}

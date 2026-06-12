import axios from "axios";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { timedRequest } from "../lib/timed-request";

type SystemMetric = "memory" | "cpu" | "load";

interface MonitorConfig {
  monitorId: string;
  url: string;
  intervalMinutes: number;
  systemMetrics?: SystemMetric[];
}

interface AgentConfig {
  agentKey: string;
  watchdogUrl: string;
  monitors: MonitorConfig[];
}

type CheckStatus = "up" | "down";

interface CheckResult {
  monitorId: string;
  type: "uptime" | "metric";
  status: CheckStatus;
  statusCode?: number;
  responseTime?: number;
  dnsMs?: number;
  tcpMs?: number;
  tlsMs?: number;
  ttfbMs?: number;
  downloadMs?: number;
  sizeBytes?: number;
  metricName?: string;
  metricValue?: number;
}

type UptimeResult = Omit<CheckResult, "monitorId" | "type" | "metricName" | "metricValue"> & {
  statusCode: number;
};

async function checkUrl(url: string): Promise<UptimeResult> {
  const { ok, statusCode, timings } = await timedRequest(url, { timeoutMs: 10_000 });
  return {
    status: ok && statusCode !== null && statusCode < 400 ? "up" : "down",
    statusCode: statusCode ?? 0,
    responseTime: timings.totalMs,
    ...(timings.dnsMs !== null && { dnsMs: timings.dnsMs }),
    ...(timings.tcpMs !== null && { tcpMs: timings.tcpMs }),
    ...(timings.tlsMs !== null && { tlsMs: timings.tlsMs }),
    ...(timings.ttfbMs !== null && { ttfbMs: timings.ttfbMs }),
    ...(timings.downloadMs !== null && { downloadMs: timings.downloadMs }),
    ...(timings.sizeBytes !== null && { sizeBytes: timings.sizeBytes }),
  };
}

function collectMetric(metric: SystemMetric): { value: number; status: CheckStatus } {
  switch (metric) {
    case "memory": {
      const used = os.totalmem() - os.freemem();
      const value = Math.round((used / os.totalmem()) * 1000) / 10;
      return { value, status: value < 95 ? "up" : "down" };
    }
    case "cpu": {
      const load = os.loadavg()[0];
      const cpus = os.cpus().length;
      const value = Math.round((load / cpus) * 1000) / 10;
      return { value, status: value < 90 ? "up" : "down" };
    }
    case "load": {
      const value = Math.round(os.loadavg()[0] * 100) / 100;
      return { value, status: value < os.cpus().length ? "up" : "down" };
    }
  }
}

async function gatherResults(monitor: MonitorConfig): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const uptime = await checkUrl(monitor.url);
  const timestamp = new Date().toISOString();
  const icon = uptime.status === "up" ? "✅" : "🔴";
  console.log(`[${timestamp}] ${icon} ${monitor.url} — ${uptime.status.toUpperCase()} ${uptime.statusCode} (${uptime.responseTime}ms)`);
  results.push({ monitorId: monitor.monitorId, type: "uptime", ...uptime });

  for (const metric of monitor.systemMetrics ?? []) {
    const { value, status } = collectMetric(metric);
    const metricIcon = status === "up" ? "📊" : "⚠️ ";
    console.log(`[${new Date().toISOString()}] ${metricIcon} ${metric}: ${value}${metric === "load" ? "" : "%"} — ${status.toUpperCase()}`);
    results.push({ monitorId: monitor.monitorId, type: "metric", status, metricName: metric, metricValue: value });
  }

  return results;
}

async function reportResults(watchdogUrl: string, agentKey: string, results: CheckResult[]) {
  await axios.post(
    `${watchdogUrl}/api/agents/checkin`,
    { results },
    { headers: { "X-Agent-Key": agentKey }, timeout: 10_000 }
  );
}

function scheduleMonitor(config: AgentConfig, monitor: MonitorConfig) {
  async function run() {
    const results = await gatherResults(monitor);
    try {
      await reportResults(config.watchdogUrl, config.agentKey, results);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ⚠️  Failed to report to Watchdog: ${err.message}`);
    }
  }

  run();
  setInterval(run, monitor.intervalMinutes * 60 * 1000);
}

function loadConfig(configPath: string): AgentConfig {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Config file not found: ${resolved}`);
    console.error(`   Create a watchdog-agent.config.json — see watchdog-agent.config.example.json`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(resolved, "utf-8"));
}

const configPath = process.argv[2] ?? "watchdog-agent.config.json";
const config = loadConfig(configPath);

console.log(`🤖 Watchdog Agent Runner`);
console.log(`   Watchdog: ${config.watchdogUrl}`);
console.log(`   Monitors: ${config.monitors.length}`);
config.monitors.forEach((m) => {
  const metrics = m.systemMetrics?.length ? ` + metrics: ${m.systemMetrics.join(", ")}` : "";
  console.log(`     • ${m.url} every ${m.intervalMinutes}m${metrics} (monitorId: ${m.monitorId})`);
});
console.log("");

config.monitors.forEach((monitor) => scheduleMonitor(config, monitor));

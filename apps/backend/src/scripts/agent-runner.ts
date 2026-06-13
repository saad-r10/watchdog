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

// ---- Monitor scheduling (supports live config reload) ----

const timers = new Map<string, NodeJS.Timeout>();
const signatures = new Map<string, string>();

function monitorSignature(m: MonitorConfig): string {
  return JSON.stringify([m.url, m.intervalMinutes, m.systemMetrics ?? []]);
}

function scheduleMonitor(connection: { watchdogUrl: string; agentKey: string }, monitor: MonitorConfig) {
  async function run() {
    const results = await gatherResults(monitor);
    try {
      await reportResults(connection.watchdogUrl, connection.agentKey, results);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ⚠️  Failed to report to Watchdog: ${err.message}`);
    }
  }

  run();
  timers.set(monitor.monitorId, setInterval(run, monitor.intervalMinutes * 60 * 1000));
  signatures.set(monitor.monitorId, monitorSignature(monitor));
}

function applyMonitors(connection: { watchdogUrl: string; agentKey: string }, monitors: MonitorConfig[]) {
  const seen = new Set<string>();

  for (const monitor of monitors) {
    seen.add(monitor.monitorId);
    const sig = monitorSignature(monitor);
    if (signatures.get(monitor.monitorId) === sig) continue;

    const existing = timers.get(monitor.monitorId);
    if (existing) clearInterval(existing);
    const verb = existing ? "🔄 Updated" : "➕ Watching";
    const metrics = monitor.systemMetrics?.length ? ` + metrics: ${monitor.systemMetrics.join(", ")}` : "";
    console.log(`[${new Date().toISOString()}] ${verb} ${monitor.url} every ${monitor.intervalMinutes}m${metrics}`);
    scheduleMonitor(connection, monitor);
  }

  for (const [monitorId, timer] of timers) {
    if (!seen.has(monitorId)) {
      clearInterval(timer);
      timers.delete(monitorId);
      signatures.delete(monitorId);
      console.log(`[${new Date().toISOString()}] ➖ Monitor unassigned — stopped watching (monitorId: ${monitorId})`);
    }
  }
}

// ---- Remote mode: pull config from Watchdog using just the agent key ----

const CONFIG_REFRESH_MS = 60 * 1000;

async function fetchRemoteConfig(watchdogUrl: string, agentKey: string): Promise<MonitorConfig[]> {
  const res = await axios.get(`${watchdogUrl}/api/agents/config`, {
    headers: { "X-Agent-Key": agentKey },
    timeout: 10_000,
  });
  return res.data.data.monitors;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRemote(watchdogUrl: string, agentKey: string) {
  console.log(`🤖 Watchdog Agent Runner`);
  console.log(`   Watchdog: ${watchdogUrl}`);
  console.log(`   Mode: remote config (refreshes every ${CONFIG_REFRESH_MS / 1000}s)`);
  console.log("");

  const connection = { watchdogUrl, agentKey };

  // Initial connect — retry on network errors, bail on a bad key.
  for (;;) {
    try {
      const monitors = await fetchRemoteConfig(watchdogUrl, agentKey);
      console.log(`[${new Date().toISOString()}] ✅ Connected to Watchdog`);
      if (monitors.length === 0) {
        console.log(`[${new Date().toISOString()}] 💤 No monitors assigned yet — assign them in the Watchdog UI and they'll be picked up automatically.`);
      }
      applyMonitors(connection, monitors);
      break;
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.error(`❌ Watchdog rejected the agent key. Check the key, or revoke this agent and create a new one in the UI.`);
        process.exit(1);
      }
      console.error(`[${new Date().toISOString()}] ⚠️  Cannot reach Watchdog at ${watchdogUrl} (${err.message}) — retrying in 15s`);
      await sleep(15_000);
    }
  }

  setInterval(async () => {
    try {
      const monitors = await fetchRemoteConfig(watchdogUrl, agentKey);
      applyMonitors(connection, monitors);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ⚠️  Config refresh failed (${err.message}) — keeping current monitors`);
    }
  }, CONFIG_REFRESH_MS);
}

// ---- File mode (legacy): static config from a JSON file ----

function loadConfig(configPath: string): AgentConfig {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Config file not found: ${resolved}`);
    console.error(`   Run with an agent key instead (no config file needed):`);
    console.error(`     node agent-runner.js --key wdg_xxx --url https://your-watchdog`);
    console.error(`   Or create a watchdog-agent.config.json — see watchdog-agent.config.example.json`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(resolved, "utf-8"));
}

function runFromFile(configPath: string) {
  const config = loadConfig(configPath);

  console.log(`🤖 Watchdog Agent Runner`);
  console.log(`   Watchdog: ${config.watchdogUrl}`);
  console.log(`   Mode: config file (${path.resolve(configPath)})`);
  console.log(`   Monitors: ${config.monitors.length}`);
  console.log("");

  applyMonitors({ watchdogUrl: config.watchdogUrl, agentKey: config.agentKey }, config.monitors);
}

// ---- Entry point ----

function parseArgs(argv: string[]) {
  let key = process.env.WATCHDOG_AGENT_KEY;
  let url = process.env.WATCHDOG_URL;
  let configPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--key") key = argv[++i];
    else if (argv[i] === "--url") url = argv[++i];
    else configPath = argv[i];
  }

  return { key, url, configPath };
}

const { key, url, configPath } = parseArgs(process.argv.slice(2));

if (key) {
  runRemote(url ?? "http://localhost:3001", key);
} else {
  runFromFile(configPath ?? "watchdog-agent.config.json");
}

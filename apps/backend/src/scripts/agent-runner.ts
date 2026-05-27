import axios from "axios";
import * as fs from "fs";
import * as path from "path";

interface MonitorConfig {
  monitorId: string;
  url: string;
  intervalMinutes: number;
}

interface AgentConfig {
  agentKey: string;
  watchdogUrl: string;
  monitors: MonitorConfig[];
}

type CheckStatus = "up" | "down";

async function checkUrl(url: string): Promise<{ status: CheckStatus; statusCode: number; responseTime: number }> {
  const start = Date.now();
  try {
    const res = await axios.get(url, { timeout: 10_000, validateStatus: () => true });
    const responseTime = Date.now() - start;
    const status: CheckStatus = res.status < 400 ? "up" : "down";
    return { status, statusCode: res.status, responseTime };
  } catch {
    return { status: "down", statusCode: 0, responseTime: Date.now() - start };
  }
}

async function reportResult(
  watchdogUrl: string,
  agentKey: string,
  monitorId: string,
  result: { status: CheckStatus; statusCode: number; responseTime: number }
) {
  await axios.post(
    `${watchdogUrl}/api/agents/checkin`,
    { results: [{ monitorId, type: "uptime", ...result }] },
    { headers: { "X-Agent-Key": agentKey }, timeout: 10_000 }
  );
}

function scheduleMonitor(config: AgentConfig, monitor: MonitorConfig) {
  async function run() {
    const result = await checkUrl(monitor.url);
    const timestamp = new Date().toISOString();
    const icon = result.status === "up" ? "✅" : "🔴";
    console.log(
      `[${timestamp}] ${icon} ${monitor.url} — ${result.status.toUpperCase()} ${result.statusCode} (${result.responseTime}ms)`
    );
    try {
      await reportResult(config.watchdogUrl, config.agentKey, monitor.monitorId, result);
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
config.monitors.forEach((m) =>
  console.log(`     • ${m.url} every ${m.intervalMinutes}m (monitorId: ${m.monitorId})`)
);
console.log("");

config.monitors.forEach((monitor) => scheduleMonitor(config, monitor));

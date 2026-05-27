import axios from "axios";
import { execSync } from "child_process";

interface ServiceCheck {
  name: string;
  check: () => Promise<boolean>;
}

const services: ServiceCheck[] = [
  {
    name: "Postgres       localhost:5432",
    check: async () => {
      try {
        execSync("docker-compose exec -T postgres pg_isready -U watchdog", {
          stdio: "ignore",
          cwd: process.cwd().includes("apps/backend") ? "../.." : ".",
        });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    name: "Backend API    localhost:3001",
    check: async () => {
      try {
        await axios.get("http://localhost:3001/health", { timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    name: "Frontend       localhost:5173+",
    check: async () => {
      for (const port of [5173, 5174, 5175, 5176]) {
        try {
          await axios.get(`http://localhost:${port}`, { timeout: 2000 });
          return true;
        } catch {
          continue;
        }
      }
      return false;
    },
  },
  {
    name: "Mock Webhook   localhost:3002",
    check: async () => {
      try {
        await axios.get("http://localhost:3002/webhook/history", { timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    name: "Demo App       localhost:4000",
    check: async () => {
      try {
        await axios.get("http://localhost:4000/status", { timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    },
  },
];

async function main() {
  console.log("\n🔍 Watchdog — service health check\n");
  const results = await Promise.all(
    services.map(async (s) => ({ name: s.name, ok: await s.check() }))
  );
  results.forEach(({ name, ok }) => {
    console.log(`  ${ok ? "✅" : "❌"} ${name}`);
  });
  const allOk = results.every((r) => r.ok);
  console.log(allOk ? "\n  All services running.\n" : "\n  Some services are not running.\n");
  process.exit(allOk ? 0 : 1);
}

main();

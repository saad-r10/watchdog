# Watchdog

Website Uptime & Security Monitor — real-time alerts for downtime, SSL expiry, misconfigured headers, and unexpected TLS certificates.

## Core Workflow

1. **No Task, No Work**: Must be working on a branch (`issue-{number}-{slug}`) associated with a GitHub issue. Task is completed when PR is merged (reference with "Closes #N").

## Pre-Work Checklist (MANDATORY)

**Before ANY code/file changes, verify:**

1. **Issue exists?** → If not, create one first with `gh issue create`
2. **On correct branch?** → Run `git branch --show-current`
   - If on `main`, STOP and create branch: `git checkout -b issue-{N}-{slug}`
   - Branch name MUST match pattern `issue-{number}-{description}`
3. **Branch up to date?** → `git pull origin main` before starting

**Before closing ANY issue:**

1. **PR created?** → Issues are closed via PR merge with "Closes #N", never manually
2. **PR reviewed and merged?** → Wait for human approval

**NEVER:**
- Make file changes while on `main` branch
- Close issues manually (let PR merge close them)
- Skip the PR review cycle

---

## Common Commands

```bash
# Start dev (recommended order)
docker-compose up -d                    # PostgreSQL
cd apps/backend && npm run dev          # Backend API (port 3001)
cd apps/backend && npm run worker       # Cron worker (separate terminal)
cd apps/frontend && npm run dev         # Frontend (port 5173)

# Database (Prisma)
cd apps/backend && npx prisma migrate dev    # Run migrations
cd apps/backend && npx prisma generate      # Regenerate client
cd apps/backend && npx prisma studio        # Open Prisma Studio
cd apps/backend && npx prisma db seed       # Seed database

# Testing
cd apps/backend && npm test              # Backend tests (Jest)
cd apps/frontend && npm test             # Frontend tests
npm run test                             # All tests from root

# Linting / formatting
npm run lint                             # ESLint across workspaces
npm run typecheck                        # TypeScript across workspaces
```

### Service URLs (Development)

| Service      | URL                       |
|-------------|---------------------------|
| Frontend     | http://localhost:5173     |
| Backend API  | http://localhost:3001     |
| Prisma Studio| http://localhost:5555     |

---

## Local Feature Testing

### One-command start

```bash
npm run dev:full
```

Starts everything in one shot: Postgres, backend API, cron worker, frontend, mock webhook receiver, demo app (port 4000), and agent runner. Seeds the database automatically on first run.

To check all services are healthy:

```bash
npm run check
```

To wipe and reset the database to a clean demo state:

```bash
npm run dev:reset
```

### Demo app (port 4000)

The demo app is a minimal Express server that simulates up/down:

```bash
curl -X POST http://localhost:4000/break   # simulate outage → 503
curl -X POST http://localhost:4000/fix     # restore → 200
```

Watch the agent runner detect the change and the monitor flip red/green in the UI within 1 minute.

### Manual start (if needed)

```bash
docker-compose up -d postgres
cd apps/backend && npx prisma db seed
```

In separate terminals:

```bash
cd apps/backend && npm run mock-webhook
```

Then start the full stack (docker + backend + worker + frontend) and verify each feature:

| Feature | How to verify |
|---------|---------------|
| Login | http://localhost:5173 → demo@watchdog.dev / password123 |
| Response time graph | Click "GitHub" → scroll to "Response Times" → toggle 24h / 7d / 30d |
| Maintenance window (active) | Click "Example API" → see yellow "Maintenance" badge in header |
| Maintenance window (upcoming) | Click "GitHub" → see upcoming window listed in Maintenance section |
| Agent online badge | Navigate to /agents → "Local Test Agent" shows green "Online" badge |
| Agent checkin (curl) | See curl commands below |
| Webhook | Navigate to /settings → enter http://localhost:3002/webhook → click "Test Webhook" → watch mock-webhook terminal |
| Status page | Navigate to /status-pages → click the link → public page at /status/demo-status |
| Broken monitor | Click "Broken Site" → open incident shown, all checks down |

### Testing with curl

```bash
# 1. Login and save token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@watchdog.dev","password":"password123"}' | jq -r '.token')

# 2. List monitors
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/monitors | jq

# 3. Agent checkin (replace IDs from seed output)
curl -X POST http://localhost:3001/api/agents/checkin \
  -H "X-Agent-Key: wdg_<AGENT_ID>.testsecret123" \
  -H "Content-Type: application/json" \
  -d '{"results":[{"monitorId":"<MONITOR_4_ID>","type":"uptime","status":"up","statusCode":200,"responseTime":142,"dnsMs":4,"tcpMs":18,"tlsMs":41,"ttfbMs":65,"downloadMs":14,"sizeBytes":20480}]}'
# (timing breakdown fields are optional — older agents may omit them)

# 4. Public status page (no auth)
curl http://localhost:3001/api/status/demo-status | jq

# 5. Test webhook delivery
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/users/me/settings/test-webhook | jq
```

---

## Agent Runner

The agent runner is a standalone script that polls URLs on your machine and reports results to Watchdog on a schedule — no manual curl commands needed.

### Install as a service (recommended for real servers)

`apps/backend/scripts/install-agent.sh` (served at `GET /api/agents/install.sh`) installs the runner to `~/.watchdog-agent` and registers it as a service that starts on boot and restarts on crash — macOS launchd LaunchAgent, Linux systemd unit (user unit + `enable-linger`, system unit when root), nohup fallback elsewhere. No sudo in the happy path; the agent key lands in mode-600 files only. On key rejection it uninstalls itself to avoid a restart loop.

```bash
curl -fsSL <watchdogUrl>/api/agents/install.sh | sh -s -- --key wdg_xxx
# remove everything:
curl -fsSL <watchdogUrl>/api/agents/install.sh | sh -s -- --uninstall
```

Logs: `~/.watchdog-agent/agent.log`.

### Remote-config mode (default — key only, no config file)

The runner pulls its monitor list from `GET /api/agents/config` (authed via `X-Agent-Key`) and re-fetches every 60s, so assigning/unassigning monitors in the UI propagates to a running agent without restarts. The Agents page shows a ready-to-paste command:

```bash
curl -fsSL <watchdogUrl>/api/agents/runner -o watchdog-agent.js
node watchdog-agent.js --key wdg_xxx --url <watchdogUrl>
# or via env vars: WATCHDOG_AGENT_KEY / WATCHDOG_URL
```

A config fetch also updates the agent's `lastSeenAt`, so the agent shows Online as soon as it connects — before any monitors are assigned.

```bash
# from the repo, same thing:
cd apps/backend && npm run agent-runner -- --key wdg_xxx --url http://localhost:3001
```

### Config-file mode (legacy fallback)

```bash
# 1. Copy the example config
cp watchdog-agent.config.example.json watchdog-agent.config.json

# 2. Fill in your agentKey, watchdogUrl, and monitors
#    (agentKey is shown once when you create an agent in the UI)

# 3. Run it
cd apps/backend && npm run agent-runner
# or point at a custom config path:
cd apps/backend && npm run agent-runner -- ../../my-config.json
```

`watchdog-agent.config.json` is gitignored — never commit your agent key.

Config format:
```json
{
  "agentKey": "wdg_<agentId>.<secret>",
  "watchdogUrl": "http://localhost:3001",
  "monitors": [
    { "monitorId": "<uuid>", "url": "http://localhost:4000", "intervalMinutes": 1 }
  ]
}
```

---

## Project Structure

```
watchdog/
├── apps/
│   ├── backend/src/
│   │   ├── routes/          # Express routers
│   │   ├── middleware/      # Auth, error handling
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Prisma data access
│   │   ├── workers/         # node-cron jobs (uptime, SSL, headers, cert transparency)
│   │   ├── db/              # Prisma client singleton + seed
│   │   └── index.ts         # Express entry point
│   └── frontend/src/
│       ├── routes/          # React Router pages
│       ├── components/      # React components (+ ui/)
│       ├── hooks/           # Custom hooks
│       ├── services/        # API client
│       └── lib/             # Utilities
├── packages/
│   └── shared-types/        # Shared Zod schemas & TypeScript types
├── .claude/
│   ├── agents/              # Subagent definitions
│   ├── hooks/               # Claude Code hooks
│   ├── skills/              # Slash-command skills
│   └── settings.json
├── .github/workflows/       # CI/CD
├── docs/                    # Architecture docs
├── docker-compose.yml       # PostgreSQL
└── CLAUDE.md
```

**Tech:** Backend: Node.js + Express + Prisma + node-cron + PostgreSQL. Frontend: Vite + React + React Router + TanStack Query + Tailwind. Auth: JWT + bcrypt. Alerts: Nodemailer. Testing: Jest + Supertest. Lint: ESLint + Prettier.

---

## Worker System (node-cron)

Four recurring workers defined in `apps/backend/src/workers/`:

| Worker | Schedule | Purpose |
|--------|----------|---------|
| `uptimeWorker` | Every minute | HTTP check via `lib/timed-request.ts` — records status plus a timing breakdown (DNS / TCP / TLS / TTFB / download, in ms) and payload size in bytes |
| `sslWorker` | Every hour | Check SSL cert expiry days remaining |
| `headerWorker` | Every 6 hours | Analyse security headers |
| `ctWorker` | Every 4 hours | Poll crt.sh (`lib/crtsh.ts`) for each monitor's hostname, diff against the stored `MonitorCertificate` baseline, and flag unrecognized certs |

Workers create `Incident` records on state changes (up→down, down→up) and trigger alert sends via `AlertService`. `ctWorker` creates point-in-time `unexpected_cert` incidents (already resolved) rather than open/ongoing ones.

---

## Agent System

Agents run on user infrastructure and push check results to Watchdog via `POST /api/agents/checkin` using an `X-Agent-Key` header.

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/agents` | JWT | List user's agents |
| `POST /api/agents` | JWT | Create agent (returns one-time key) |
| `DELETE /api/agents/:id` | JWT | Revoke agent |
| `GET /api/agents/runner` | None | Download the standalone agent runner bundle |
| `GET /api/agents/install.sh` | None | One-line installer script (server URL templated from request host / `X-Forwarded-Proto`) |
| `GET /api/agents/config` | `X-Agent-Key` | Pull assigned monitors (`monitorId`, `url`, `intervalMinutes`); updates `lastSeenAt` |
| `POST /api/agents/checkin` | `X-Agent-Key` | Submit check results, update `lastSeenAt` |

Key format: `wdg_<agentId>.<secret>` — the agent ID is embedded so the key can be verified in O(1) (find by ID, then bcrypt compare). The raw key is shown once on creation; only its bcrypt hash (`keyHash`) is stored.

---

## Status Page System

Public-facing status pages at `/status/:slug` — no authentication required to view.

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/status-pages` | JWT | List user's status pages |
| `POST /api/status-pages` | JWT | Create a page (slug must be unique, lowercase, hyphens only) |
| `DELETE /api/status-pages/:id` | JWT | Delete a page |
| `PUT /api/status-pages/:id/monitors` | JWT | Set which monitors appear on the page |
| `GET /api/status/:slug` | None | Public: returns overall status + per-monitor uptime + 90-day bars |

The public endpoint computes 90-day daily uptime bars via a raw SQL `GROUP BY DATE` query on the `Check` table. Overall status is `operational` (all up), `degraded` (some down), or `outage` (all down).

Frontend route `/status/:slug` is a standalone page (no sidebar/auth wrapper) — safe to share with customers.

---

## Alert System

`AlertService` (`apps/backend/src/services/alert.service.ts`) handles:
- **Cooldowns**: one alert per monitor per incident (no spam)
- **Channels**: email via Nodemailer (SMTP) and webhook (HTTP POST to user-configured URL)
- **Triggers**: downtime, SSL expiry within 14 days, missing critical headers, unexpected certificate detected via Certificate Transparency logs
- **Webhook**: fired via `WebhookService` in parallel with email using `Promise.allSettled` — webhook failure never blocks email. Payload: `{ event, monitorId, monitorName, monitorUrl, incidentId, startedAt }`. Test endpoint: `POST /api/users/me/settings/test-webhook`

---

## Database Models (Prisma)

Key models in `apps/backend/prisma/schema.prisma`:

| Model | Purpose |
|-------|---------|
| `User` | Registered user |
| `Agent` | API-key-authenticated agent that reports check results from user infrastructure |
| `Monitor` | A URL to watch (belongs to User, optionally assigned to an Agent) |
| `Check` | Single uptime/ssl/header/cert_transparency result — uptime checks carry optional phase timings (`dnsMs`, `tcpMs`, `tlsMs`, `ttfbMs`, `downloadMs`) and `sizeBytes`; cert_transparency checks carry `ctNewCerts` (JSON list of newly-seen certs) |
| `Incident` | Downtime, SSL-expiry, header, or unexpected-certificate event |
| `Alert` | Sent alert record (with cooldown tracking) |
| `StatusPage` | A public-facing status page with a unique slug (belongs to User) |
| `StatusPageMonitor` | Join table linking monitors to a StatusPage |
| `MaintenanceWindow` | Scheduled downtime window for a Monitor — alerts suppressed, excluded from uptime % |
| `MonitorCertificate` | Certificate Transparency baseline — one row per crt.sh cert seen for a Monitor's hostname, used to diff and detect unrecognized new certs |

---

## Security Headers Checked

`X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`

Each missing or misconfigured header is recorded as a finding on the `Check` result.

---

## Frontend Design System ("Night Watch")

The frontend uses **shadcn/ui** (in `src/components/ui/`) on **Tailwind v4** (config is CSS-based in `src/index.css` via `@theme inline` + `@tailwindcss/vite`; there is no meaningful `tailwind.config.js`). Build new UI from these conventions — do not reintroduce ad-hoc Tailwind one-offs or hardcoded palette colors.

- **Tokens, not raw colors.** Use semantic classes (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`). Never `slate-*`/`violet-*`/`emerald-*` literals.
- **Palette:** warm charcoal surfaces + **amber** (`primary`) accent. Amber is for interactive elements only (CTAs, focus, active nav) — never gradient/glow decoration.
- **Status colors carry meaning:** `up` (green), `degraded` (amber), `down` (red). Use for monitor health everywhere.
- **Brand mark:** `<WatchdogMark>` (geometric alert guard-dog head) — the brand asset. Favicon is `public/favicon.svg`.
- **Signature components:** `<StatusDot>` (radar-pulse live indicator), `<UptimeBars>` (90-day timeline), `<StatusBadge>`. Reuse these rather than rebuilding status visuals.
- Dark mode is default (`<html class="dark">`).

---

## CI/CD

- **CI:** GitHub Actions runs lint, typecheck, and Jest tests on every PR
- **Pre-commit hook:** Husky runs lint-staged
- **CD:** Railway auto-deploys on push to `main`

---

## Environment Variables

See `.env.example` at the root. Critical vars:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `RESEND_API_KEY` | Resend API key for sending alert emails |
| `ALERT_FROM_EMAIL` | From address for alerts (must be a verified Resend sender) |
| `PORT` | Backend port (default 3001) |

---

## Code Patterns

### Express Route
```typescript
import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";

const router = Router();

const createSchema = z.object({ url: z.string().url(), name: z.string().min(1) });

router.post("/", authenticate, validate(createSchema), async (req, res, next) => {
  try {
    const { url, name } = req.body;
    const monitor = await monitorService.create(req.user.id, { url, name });
    res.status(201).json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

export default router;
```

### Prisma Repository
```typescript
import { prisma } from "../db";

export const monitorRepository = {
  async findByUser(userId: string) {
    return prisma.monitor.findMany({ where: { userId } });
  },
  async create(data: { userId: string; url: string; name: string }) {
    return prisma.monitor.create({ data });
  },
};
```

### node-cron Worker
```typescript
import cron from "node-cron";

cron.schedule("* * * * *", async () => {
  const monitors = await monitorRepository.findAllActive();
  await Promise.allSettled(monitors.map(checkUptime));
});
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| Prisma client not found | `cd apps/backend && npx prisma generate` |
| Migration drift | `npx prisma migrate reset` (dev only) |
| CORS error | Check `VITE_API_URL` matches backend URL |
| JWT invalid | Ensure `JWT_SECRET` is set and matches across restarts |
| Nodemailer ECONNREFUSED | Check SMTP credentials; use Ethereal for local testing |
| SSL check fails | Some hosts block TLS handshakes from cloud IPs; expected |

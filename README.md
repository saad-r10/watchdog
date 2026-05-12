# Watchdog

> Website uptime & security monitor — real-time alerts for downtime, SSL expiry, and misconfigured HTTP headers.

[![CI](https://github.com/saad-r10/watchdog/actions/workflows/ci.yml/badge.svg)](https://github.com/saad-r10/watchdog/actions/workflows/ci.yml)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  Dashboard · Monitor detail · Settings · Login / Register       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS (Axios)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Express API  :3001                            │
│  /api/auth  /api/monitors  /api/users/me  /api/users/me/settings│
│  JWT auth · Zod validation · Prisma ORM                        │
└──────────┬──────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────┐            ┌─────────────────────────────────┐
│   PostgreSQL     │◄───────────│   node-cron Workers             │
│   (Prisma)       │            │                                 │
│                  │            │  ⏱ Uptime      every 1 min      │
│  User            │            │  🔒 SSL         every 1 hr      │
│  Monitor         │            │  🛡 Headers     every 6 hrs     │
│  Check           │            │                                 │
│  Incident        │            │  On down:  create Incident      │
│  Alert           │            │  On expiry: create Incident     │
└──────────────────┘            └──────────┬──────────────────────┘
                                           │ AlertService
                                           ▼
                                ┌─────────────────────────────────┐
                                │  Nodemailer (SMTP)              │
                                │  Cooldown: 1 email per incident │
                                │  Templates: downtime · SSL      │
                                └─────────────────────────────────┘
```

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS + TanStack Query |
| Backend | Node.js + Express + Zod validation |
| Database | PostgreSQL + Prisma ORM |
| Workers | node-cron (uptime / SSL / headers) |
| Alerts | Nodemailer (SMTP) |
| Auth | JWT + bcrypt |
| Testing | Jest + Supertest (integration) + Jest mocks (unit) |
| DevOps | Docker + GitHub Actions CI + Railway |

## Build phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Project setup & monorepo scaffold | ✅ |
| 2 | User auth — register, login, JWT | ✅ |
| 3 | Monitor engine — uptime checks + dashboard | ✅ |
| 4 | Security checks — SSL cert & HTTP headers | ✅ |
| 5 | Email alerts with cooldowns + settings UI | ✅ |
| 6 | Testing suite — unit + integration | ✅ |
| 7 | Docker, CI/CD & Railway deploy | ✅ |

---

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

### 1. Clone & install

```bash
git clone https://github.com/saad-r10/watchdog.git
cd watchdog
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET at minimum
# For email alerts, fill in SMTP_* variables
# Use https://ethereal.email for local testing
```

### 3. Start PostgreSQL

```bash
docker-compose up -d postgres
```

### 4. Run migrations & start dev servers

```bash
# Terminal 1 — API
cd apps/backend && npx prisma migrate dev --name init && npm run dev

# Terminal 2 — Cron workers
cd apps/backend && npm run worker

# Terminal 3 — Frontend
cd apps/frontend && npm run dev
```

Open **http://localhost:5173**

---

## Running with Docker Compose (full stack)

```bash
# Build and start everything
docker-compose up --build

# Frontend: http://localhost:8080
# API:      http://localhost:3001
```

---

## Testing

```bash
# All tests
cd apps/backend && npm test

# Unit tests only (no DB required)
cd apps/backend && npx jest --testPathPattern="__tests__/unit"

# Integration tests (requires DATABASE_URL)
cd apps/backend && npx jest --testPathPattern="__tests__/[^/]+\.test\.ts$"
```

**Test coverage:**

| Suite | Tests | Type |
|-------|-------|------|
| `monitor-utils` | 15 | Unit |
| `alert-service` | 6 | Unit (mocked email + DB) |
| `uptime-worker` | 4 | Unit (mocked axios + DB) |
| `auth` | 6 | Integration |
| `monitors` | 4 | Integration |
| `checks` | 5 | Integration |
| `security` | 4 | Integration |
| `alerts` | 5 | Integration |

---

## Deploying to Railway

See [`.claude/skills/railway-deploy/SKILL.md`](.claude/skills/railway-deploy/SKILL.md) for the full guide.

Quick steps:

```bash
npm install -g @railway/cli
railway login
railway link
railway variables set JWT_SECRET="$(openssl rand -hex 32)"
railway variables set DATABASE_URL="..."   # from Railway Postgres plugin
railway variables set SMTP_HOST="..." SMTP_USER="..." SMTP_PASS="..."
railway up --service watchdog-backend
railway up --service watchdog-worker
railway up --service watchdog-frontend
```

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret |
| `PORT` | — | API port (default `3001`) |
| `FRONTEND_URL` | — | CORS allowed origin |
| `SMTP_HOST` | — | SMTP server (leave blank to disable email) |
| `SMTP_PORT` | — | SMTP port (default `587`) |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `ALERT_FROM_EMAIL` | — | From address for alerts |

---

## Project structure

```
watchdog/
├── apps/
│   ├── backend/
│   │   ├── prisma/schema.prisma      Database models
│   │   └── src/
│   │       ├── lib/monitor-utils.ts  Pure functions (SSL status, header analysis)
│   │       ├── routes/               Express routers
│   │       ├── services/             Business logic (alert, email)
│   │       ├── repositories/         Prisma data access
│   │       ├── workers/              node-cron jobs
│   │       ├── middleware/           Auth, validation, error handling
│   │       └── __tests__/            Jest tests (unit/ + integration)
│   └── frontend/
│       └── src/
│           ├── components/           StatusBadge, Sparkline, MonitorCard, Nav…
│           ├── routes/               Pages (dashboard, monitor-detail, settings…)
│           ├── hooks/                useAuth
│           └── services/api.ts       Axios API client
└── packages/
    └── shared-types/                 Zod schemas + TS interfaces
```

---

## How alerts work

1. Uptime worker pings each monitored URL every minute.
2. First failed check → `Incident` created → `AlertService.notifyDowntime()` called.
3. `AlertService` checks the `Alert` table — if an alert was already sent for this incident, it **skips** (cooldown).
4. Otherwise it reads the user's preferences (`alertDowntime`, `alertEmail`) and sends via Nodemailer.
5. When the site recovers, the incident is resolved. The next downtime creates a fresh incident → fresh alert.

SSL expiry follows the same flow, triggered at < 14 days remaining.

---

## License

MIT

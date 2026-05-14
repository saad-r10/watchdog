---
name: dev-setup
description: Start the Watchdog development environment. Starts Docker infrastructure (PostgreSQL) and local services (backend API, cron worker, frontend). Use when the user wants to start developing or run the app locally.
---

# Watchdog Development Setup

Start and manage the local development environment.

## Architecture

| Component | Runs In | URL |
|-----------|---------|-----|
| PostgreSQL | Docker | localhost:5432 |
| Backend API | Local (Node.js) | http://localhost:3001 |
| Cron Worker | Local (Node.js) | - |
| Frontend | Local (Vite) | http://localhost:5173 |
| Prisma Studio | Local | http://localhost:5555 |

## Prerequisites Check

### 1. Check Docker

```bash
docker --version
# macOS: brew install --cask docker
# Linux: sudo apt install docker.io docker-compose
```

### 2. Check Node.js and npm

```bash
node --version   # 18+
npm --version
```

### 3. Install Project Dependencies

```bash
npm install
```

## Quick Start

### 1. Start Infrastructure (Docker)

```bash
docker-compose up -d
```

This starts PostgreSQL on port 5432.

### 2. Configure Environment Variables

Backend requires `apps/backend/.env` (copy from root `.env.example`):

```bash
cp .env.example apps/backend/.env
```

Key variables to fill in:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/watchdog

JWT_SECRET=your-secret-here

# Nodemailer SMTP (use Ethereal for local testing)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user
SMTP_PASS=your-ethereal-pass
ALERT_FROM_EMAIL=alerts@watchdog.local

PORT=3001
```

### 3. Run Database Migrations

```bash
cd apps/backend && npx prisma migrate dev
```

### 4. Start Backend API

```bash
cd apps/backend && npm run dev
```

### 5. Start Cron Worker (separate terminal)

```bash
cd apps/backend && npm run worker
```

**Important:**
- Run in a separate terminal from the backend API
- Workers do NOT hot-reload on code changes — restart manually when worker code changes
- Runs three cron jobs: uptime check (every minute), SSL check (every hour), header check (every 6 hours)

### 6. Start Frontend

```bash
cd apps/frontend && npm run dev
```

## Verification

```bash
# Check Docker
docker-compose ps

# Check backend health
curl http://localhost:3001/health

# Check frontend
open http://localhost:5173
```

## Stop Everything

```bash
# Stop Docker
docker-compose down

# Kill local processes: Ctrl+C in each terminal
```

## Fresh Start (Reset Database)

```bash
docker-compose down -v
docker-compose up -d
cd apps/backend && npx prisma migrate reset
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 5432 in use | `docker-compose down` or stop other PostgreSQL instance |
| Port 3001 in use | `lsof -i :3001` then `kill <PID>` |
| Database connection refused | Ensure `docker-compose up -d` ran and PostgreSQL is healthy |
| Prisma client not found | `cd apps/backend && npx prisma generate` |
| Migration drift | `npx prisma migrate reset` (dev only — deletes data) |
| CORS error | Check `VITE_API_URL` in frontend `.env` matches backend URL |
| JWT invalid | Ensure `JWT_SECRET` is set and consistent across restarts |
| Nodemailer ECONNREFUSED | Check SMTP credentials; use Ethereal for local testing |
| SSL check fails | Some hosts block TLS handshakes from cloud IPs — expected |
| Worker changes not taking effect | Worker doesn't hot-reload — kill and restart it |

## Database Operations

```bash
# Run migrations
cd apps/backend && npx prisma migrate dev

# Regenerate Prisma client after schema changes
cd apps/backend && npx prisma generate

# Open Prisma Studio (DB GUI)
cd apps/backend && npx prisma studio

# Seed the database
cd apps/backend && npx prisma db seed

# Reset database (dev only)
cd apps/backend && npx prisma migrate reset
```

## When to Run What

| Task | Services Needed |
|------|-----------------|
| Frontend only | Docker + Backend API + Frontend |
| API development | Docker + Backend API |
| Worker/alert development | Docker + Backend API + Cron Worker |
| Full app | Docker + Backend API + Cron Worker + Frontend |

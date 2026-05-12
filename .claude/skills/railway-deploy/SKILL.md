---
name: railway-deploy
description: Deploy Watchdog to Railway. Covers backend, frontend, and PostgreSQL service setup, environment variables, and production configuration. Use when deploying or troubleshooting Railway deployments.
---

# Watchdog Railway Deployment

## Services

| Service | Source | Notes |
|---------|--------|-------|
| `watchdog-backend` | `apps/backend` | Express API |
| `watchdog-frontend` | `apps/frontend` | Vite static build |
| `watchdog-postgres` | Railway PostgreSQL plugin | Managed DB |

## Initial Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy a service
railway up --service watchdog-backend
railway up --service watchdog-frontend
```

## Environment Variables

### Backend (set in Railway dashboard or CLI)

```bash
railway variables set DATABASE_URL="postgresql://..."   # auto-set by Postgres plugin
railway variables set JWT_SECRET="$(openssl rand -hex 32)"
railway variables set SMTP_HOST="smtp.gmail.com"
railway variables set SMTP_PORT="587"
railway variables set SMTP_USER="alerts@yourdomain.com"
railway variables set SMTP_PASS="..."
railway variables set ALERT_FROM_EMAIL="alerts@yourdomain.com"
railway variables set FRONTEND_URL="https://watchdog-frontend.up.railway.app"
railway variables set NODE_ENV="production"
```

### Frontend (must be in `apps/frontend/.env.production`)

```bash
# apps/frontend/.env.production
VITE_API_URL=https://watchdog-backend.up.railway.app
```

## railway.toml

**File**: `railway.toml` (root)

```toml
[build]
builder = "nixpacks"

[[services]]
name = "watchdog-backend"
source = "apps/backend"
startCommand = "npm start"

[[services]]
name = "watchdog-frontend"
source = "apps/frontend"
startCommand = "npm run preview"
```

## Production Database Migration

Add to `apps/backend/src/db/migrate.ts` and run on startup:

```typescript
import { execSync } from "child_process";

export function runMigrations() {
  if (process.env.NODE_ENV === "production") {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  }
}
```

Call `runMigrations()` at the top of `apps/backend/src/index.ts` before `app.listen()`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module @prisma/client` | Add `postinstall: "prisma generate"` to backend `package.json` |
| CORS errors | Set `FRONTEND_URL` env var and add to `cors()` config |
| DB connection refused | Check `DATABASE_URL` is using Railway's internal URL |
| Frontend 404 on refresh | Configure SPA fallback in `vite.config.ts` preview server |
| JWT errors in prod | Ensure `JWT_SECRET` is identical across restarts (not randomly generated at boot) |

## Zero-Downtime Deploy Checklist

- [ ] `DATABASE_URL` points to Railway Postgres plugin
- [ ] `JWT_SECRET` set as permanent env var (not generated at boot)
- [ ] `FRONTEND_URL` allowlisted in backend CORS config
- [ ] `VITE_API_URL` in `apps/frontend/.env.production`
- [ ] Prisma migrations run via `migrate deploy` (not `migrate dev`)
- [ ] `postinstall: "prisma generate"` in backend `package.json`

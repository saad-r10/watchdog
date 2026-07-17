# Secrets Rotation Runbook

This document covers how to rotate each secret in Watchdog without downtime or forced logouts.

## Secrets inventory

| Secret | Where it lives | Impact if leaked |
|--------|---------------|-----------------|
| `JWT_SECRET` | Railway env var | Allows forging auth tokens |
| `DATABASE_URL` | Railway env var | Full database access |
| `RESEND_API_KEY` | Railway env var | Send email as your domain |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | Railway env var | Forge push notifications |
| Agent key hash (`keyHash`) | Database | Impersonate monitoring agents |

---

## JWT_SECRET

Watchdog supports a `JWT_SECRET_PREVIOUS` env var. During rotation, the backend will accept tokens signed with either the old or new secret, so active sessions are not invalidated.

**Steps:**

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

2. In Railway, set `JWT_SECRET_PREVIOUS` to the current value of `JWT_SECRET`.

3. Set `JWT_SECRET` to the new value.

4. Deploy. New tokens are signed with the new secret; existing tokens (signed with the old secret) continue to verify via `JWT_SECRET_PREVIOUS`.

5. Wait for existing sessions to expire (default 7 days). Then clear `JWT_SECRET_PREVIOUS`.

---

## DATABASE_URL

1. Create a new PostgreSQL user with the same privileges, or rotate the password via Railway's Postgres service.
2. Update `DATABASE_URL` in Railway.
3. Deploy. Prisma opens a new connection pool on startup; in-flight queries finish on old connections.
4. Revoke the old password/user once the deploy is healthy.

---

## RESEND_API_KEY

1. Create a new API key in the Resend dashboard.
2. Update `RESEND_API_KEY` in Railway.
3. Deploy.
4. Revoke the old key in Resend.

---

## VAPID Keys

VAPID key rotation invalidates all existing push subscriptions — users must re-subscribe. Schedule this during low-traffic periods.

1. Generate new keys:
   ```bash
   node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(JSON.stringify(k,null,2))"
   ```

2. Update `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Railway.

3. Deploy. Old push subscriptions will fail with 410 Gone — the backend removes them automatically on the first failed delivery.

4. Notify users (or surface a prompt in the UI) to re-enable push notifications.

---

## Agent Keys

Agent keys are bcrypt-hashed in the database. The raw key is shown only once at creation.

1. In the Watchdog UI, delete the compromised agent and create a new one.
2. Copy the new key and update the agent runner config on the affected machine (`~/.watchdog-agent/config.json` or the `WATCHDOG_AGENT_KEY` env var).
3. Restart the agent runner service.

---

## General guidelines

- **Never commit secrets to git.** `.env` and `watchdog-agent.config.json` are gitignored. CI runs gitleaks on every PR to catch accidental commits.
- **Use Railway's encrypted env vars** for all production secrets — never hardcode them in `railway.toml` or deployment config files.
- **Audit after rotation.** After rotating any secret, check Railway logs for auth errors and verify the service is healthy before removing the old value.

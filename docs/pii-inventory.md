# PII Inventory

Watchdog stores a small set of personal data. This document enumerates what is stored, why, and how long it is retained. It supports compliance with GDPR Article 13 (transparency), Article 17 (erasure), and Article 20 (portability).

---

## PII Fields

| Field | Model | Purpose | Retention |
|-------|-------|---------|-----------|
| `email` | `User` | Account identifier, alert delivery | Until account hard-delete |
| `name` | `User` | Display name | Until account hard-delete |
| `password` (bcrypt hash) | `User` | Authentication credential | Until account hard-delete |
| `mfaSecret` | `User` | TOTP seed for MFA | Until MFA is disabled or account is deleted |
| `alertEmail` | `User` | Optional separate alert recipient | Until cleared or account deleted |
| `webhookUrl`, `slackWebhookUrl`, `discordWebhookUrl` | `User` | Alert delivery endpoints (may contain tokens in path/query) | Until cleared or account deleted |
| `telegramBotToken`, `telegramChatId` | `User` | Telegram alert delivery | Until cleared or account deleted |
| `endpoint`, `p256dh`, `auth` | `PushSubscription` | Web Push delivery | Until browser unsubscribes or account is deleted |
| `tokenHash` | `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken` | Session / credential management | Until token expires or account is deleted |

---

## Operational Data (Indirect PII)

| Field | Model | Notes |
|-------|-------|-------|
| `url` | `Monitor` | May contain personal tokens or usernames in query strings |
| `monitorId` linkage | `Check`, `Incident`, `Alert` | Indirectly tied to the owning user |
| `endpoint` | `PushSubscription` | Browser-issued push endpoint (pseudonymous) |

---

## IP Addresses

Watchdog does **not** persist client IP addresses in the database. Rate-limit counters are held in memory (or Redis) and expire automatically with their window. Application logs are ephemeral and not retained beyond the platform's default log rotation (Railway: 7 days).

---

## Retention Schedule

| Data class | Retention | Enforced by |
|------------|-----------|-------------|
| `Check` records | 90 days | `data-retention-cleanup` worker (runs daily at 02:00 UTC) |
| `Incident` records (resolved) | 1 year | `data-retention-cleanup` worker |
| `Alert` records | 1 year | `data-retention-cleanup` worker |
| `RefreshToken` (expired) | Immediate via expiry field | `refresh-token-cleanup` worker (daily at 03:00 UTC) |
| User account (all PII) | Permanent until deletion request; hard-deleted 30 days after `DELETE /api/users/me` | `data-retention-cleanup` worker |

---

## User Rights

### Right to Erasure (Article 17)

`DELETE /api/users/me` initiates a 30-day grace period (soft-delete). After 30 days the account and all associated data are hard-deleted via the `data-retention-cleanup` worker. The cascade chain covers:

- User → Monitor → Check, Incident, MonitorCertificate, MaintenanceWindow, MonitorAgent
- User → Agent → MonitorAgent, Check (agentId set to NULL)
- User → Alert, StatusPage, PushSubscription, RefreshToken, PasswordResetToken, EmailVerificationToken

Users may cancel the deletion within the grace period via `POST /api/users/me/cancel-deletion`.

### Right to Portability (Article 20)

`GET /api/users/me/export` returns a JSON file containing the user's profile, monitors, agents, status pages, incidents, and alerts.

---

## Related Documents

- [`docs/security-policy.md`](security-policy.md) — vulnerability disclosure and patching SLAs
- [`docs/secrets-rotation.md`](secrets-rotation.md) — secrets and credential rotation procedures

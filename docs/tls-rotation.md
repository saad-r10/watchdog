# TLS Certificate Rotation Runbook

## Overview

Watchdog is deployed on Railway behind Cloudflare. TLS termination happens at **Cloudflare** (for the public domain) and **Railway's built-in proxy** (for the Railway-generated `.up.railway.app` domain). Neither Railway nor Cloudflare require manual certificate rotation — both renew automatically — but this runbook documents what happens during rotation, how to verify, and what to do if auto-renewal fails.

---

## Certificate Lifecycle

| Layer | Provider | Renewal |
|-------|----------|---------|
| Public domain TLS | Cloudflare (Universal SSL or Advanced Certificate Manager) | Automatic — 30–45 days before expiry |
| Railway subdomain TLS | Railway (Let's Encrypt via their proxy) | Automatic |
| Origin certificate (Cloudflare → Railway) | Cloudflare Origin CA or Railway's own cert | Automatic |

---

## What Happens During Rotation

1. Cloudflare issues a new certificate using the ACME protocol (Let's Encrypt or DigiCert, depending on your plan).
2. The new certificate is staged alongside the old one during a brief overlap window (~24 h).
3. Traffic continues uninterrupted — Cloudflare handles serving the correct cert per TLS handshake.
4. The old certificate is retired after the overlap window.

**No downtime is expected.** The overlap window guarantees clients with long-cached sessions are not disrupted.

---

## How to Verify After Rotation

```bash
# Check the live cert via openssl
openssl s_client -connect watchdog.dev:443 -servername watchdog.dev </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -issuer

# Check expiry in days
openssl s_client -connect watchdog.dev:443 -servername watchdog.dev </dev/null 2>/dev/null \
  | openssl x509 -noout -checkend 0 && echo "cert is valid"

# Verify HSTS is present with correct max-age
curl -sI https://watchdog.dev | grep -i strict-transport

# Full TLS quality check (requires testssl.sh)
testssl.sh watchdog.dev
```

Expected results:
- Certificate issued by Cloudflare or Let's Encrypt
- Not-before date is recent (within the last 90 days)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` present on all responses
- `testssl.sh` reports **A+** (TLS 1.2 and 1.3 only, no RC4/DES/3DES, no SSLv2/3)

---

## TLS Version Policy

Watchdog enforces **TLS 1.2 minimum** at the Cloudflare layer:

1. Cloudflare Dashboard → SSL/TLS → Edge Certificates → Minimum TLS Version → **TLS 1.2**
2. Cloudflare Dashboard → SSL/TLS → Edge Certificates → TLS 1.3 → **Enabled**

This disables TLS 1.0 and 1.1 for all traffic before it reaches Railway. Railway's proxy independently enforces modern TLS, so both layers agree.

**Cipher suites** are managed by Cloudflare (Modern cipher suite profile). No manual cipher configuration is needed on the Express/Node.js layer — the app is not the TLS endpoint.

---

## HSTS Preloading

The backend sends:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

To complete HSTS preloading (browsers hardcode HTTPS before any connection is made):

1. Verify the header is live: `curl -sI https://watchdog.dev | grep strict-transport`
2. Submit the domain at **https://hstspreload.org**
3. Wait for inclusion in Chrome's preload list (typically 1–3 months)

> **Note:** Once submitted for preloading, removing HSTS requires waiting for de-listing (can take months). Only submit when confident HTTPS is permanent.

---

## If Auto-Renewal Fails

### Cloudflare certificate not renewing

1. Check Cloudflare Dashboard → SSL/TLS → Overview — look for warnings.
2. If the domain uses a CAA record, ensure it allows Cloudflare's CA (`letsencrypt.org` or `digicert.com`).
3. Check the Cloudflare audit log for certificate-issuance events.
4. Force renewal: SSL/TLS → Edge Certificates → "Renew" button (if available on your plan).
5. Fallback: Upload a manually obtained cert (DigiCert, ZeroSSL) via SSL/TLS → Edge Certificates → Upload Custom Certificate.

### Railway subdomain cert not renewing

Open a Railway support ticket. Railway manages this automatically and failures are rare.

---

## Self-Monitoring

Watchdog monitors its own domain via the **"Watchdog (self)"** monitor, automatically created on startup when `WATCHDOG_SELF_URL` is set.

The `sslWorker` runs hourly and alerts when `sslDaysLeft < 14`. To test the alert path manually:

```bash
# Simulate an SSL-expiry alert for the self-monitor
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@watchdog.dev","password":"<password>"}' | jq -r '.token')

# List monitors to find the self-monitor ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/monitors | jq '.data[] | select(.name == "Watchdog (self)") | {id, url}'
```

Verify the self-monitor exists and is active in the Watchdog UI under **Monitors**.

---

## Environment Variables

| Var | Purpose |
|-----|---------|
| `WATCHDOG_SELF_URL` | URL of the Watchdog app itself (e.g. `https://watchdog.dev`). When set, the backend auto-creates a self-monitor owned by the first `owner`-role user on startup. |

Set this in the Railway backend service environment variables.

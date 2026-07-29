# Sub-Processor List

Watchdog engages the following sub-processors to deliver the service. All sub-processors are evaluated for GDPR compliance before engagement and are subject to data processing agreements (DPAs) at the platform level.

Last reviewed: 2026-07-29

---

## Sub-Processors

| Sub-processor | Role | Data transferred | Location | Compliance basis | DPA / Privacy link |
|---------------|------|-----------------|----------|------------------|--------------------|
| **Railway** | Cloud hosting (backend API, PostgreSQL, frontend) | All user data stored in the database; application logs | United States | SCCs (EU–US) | [railway.app/legal/privacy](https://railway.app/legal/privacy) |
| **Resend** | Transactional email (alert emails) | Recipient email address, email body | United States | SCCs (EU–US) | [resend.com/legal/privacy-policy](https://resend.com/legal/privacy-policy) |
| **Cloudflare** | DDoS protection, CDN, DNS | IP addresses (ephemeral, not stored by Watchdog) | United States / Global | SCCs; Cloudflare DPA available | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |
| **GitHub** | Source code hosting, CI/CD | Source code only (no user PII) | United States | SCCs | [docs.github.com/en/site-policy/privacy-policies](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) |

---

## Data Minimisation Notes

- **Railway**: The database is the system of record. Railway staff access is governed by their access-control policy. Encryption at rest is enabled by default on Railway Postgres (AES-256).
- **Resend**: Only the recipient email address and alert message body are transmitted. No marketing emails are sent via Resend; usage is limited to operational alerts.
- **Cloudflare**: Acts as a reverse proxy. IP addresses pass through Cloudflare but are not persisted by Watchdog's application layer.
- **GitHub**: No user PII enters GitHub. CI/CD workflows run against the source tree only.

---

## Update Process

This list is reviewed whenever a new third-party service is integrated. Changes require approval from the designated compliance contact before the service is added to production.

---

## Related Documents

- [`docs/compliance/gdpr-gap-analysis.md`](gdpr-gap-analysis.md)
- [`docs/pii-inventory.md`](../pii-inventory.md)

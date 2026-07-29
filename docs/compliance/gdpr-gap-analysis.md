# GDPR Gap Analysis

Watchdog — assessed against the EU General Data Protection Regulation (GDPR) as of 2026-07-29.

Status key: ✅ Compliant | ⚠️ Partial | ❌ Gap

---

## Article-by-Article Assessment

### Chapter I — General Provisions

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| Art. 4 | Definitions (personal data, controller, processor, etc.) | ✅ | Applied consistently throughout codebase |
| Art. 5 | Principles (lawfulness, fairness, transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity) | ⚠️ | Lawful basis documented; formal accuracy/integrity policy pending |

### Chapter II — Principles

| Article | Requirement | Status | Notes / Remediation |
|---------|-------------|--------|---------------------|
| Art. 6 | Lawful basis for processing | ✅ | Account management & monitoring = contract (Art. 6(1)(b)); alert emails = legitimate interest (Art. 6(1)(f)); no marketing emails sent |
| Art. 9 | Special categories | ✅ | No special-category data collected or processed |
| Art. 13 | Transparency at collection | ⚠️ | Privacy policy written (see `/privacy`); needs link on registration form |
| Art. 14 | Transparency — data obtained indirectly | ✅ | N/A — all data collected directly from the data subject |

### Chapter III — Rights of Data Subjects

| Article | Requirement | Status | Notes / Remediation |
|---------|-------------|--------|---------------------|
| Art. 15 | Right of access | ✅ | `GET /api/users/me` returns all account data; `GET /api/users/me/export` provides full JSON export |
| Art. 16 | Right to rectification | ✅ | `PATCH /api/users/me` allows name/email updates |
| Art. 17 | Right to erasure | ✅ | `DELETE /api/users/me` → 30-day grace period → hard delete via `dataRetentionCleanupWorker`; all associated data cascade-deleted (see `docs/pii-inventory.md`) |
| Art. 18 | Right to restriction | ❌ | No restriction-of-processing flag on User model; remediation: add `processingRestricted` boolean + enforcement in workers — tracked as future issue |
| Art. 20 | Right to portability | ✅ | `GET /api/users/me/export` returns structured JSON (monitors, agents, incidents, alerts) |
| Art. 21 | Right to object | ⚠️ | Users can delete their account; no explicit "object to processing" flow for marketing (no marketing emails currently sent) |
| Art. 22 | Automated decision-making | ✅ | N/A — no solely automated decisions with legal effect |

### Chapter IV — Controller and Processor Obligations

| Article | Requirement | Status | Notes / Remediation |
|---------|-------------|--------|---------------------|
| Art. 24 | Responsibility of controller | ✅ | Watchdog is the controller; DPA template available (see `docs/compliance/dpa-template.md`) |
| Art. 25 | Data protection by design and by default | ✅ | Minimal PII collected; bcrypt hashing; JWT short-lived; HttpOnly cookies; audit logging |
| Art. 28 | Processor agreements | ⚠️ | Sub-processors listed in `docs/compliance/sub-processors.md`; DPAs in place for Railway/Resend at their platform level; written DPAs not yet counter-signed for all sub-processors |
| Art. 30 | Records of processing activities (RoPA) | ⚠️ | Covered by `docs/pii-inventory.md`; formal RoPA document not yet produced — remediation: expand pii-inventory into a full RoPA |
| Art. 32 | Security of processing | ✅ | TLS in transit; bcrypt at rest; HSTS; rate limiting; account lockout; RBAC; audit logs (see `docs/tls-rotation.md`, `docs/security-policy.md`) |
| Art. 33 | Breach notification to supervisory authority (72 h) | ✅ | Process documented in `docs/compliance/breach-notification.md` |
| Art. 34 | Breach notification to data subjects | ✅ | Process documented in `docs/compliance/breach-notification.md` |
| Art. 35 | Data Protection Impact Assessment (DPIA) | ⚠️ | No high-risk processing identified; DPIA not formally conducted — remediation: conduct lightweight DPIA before processing health-sector data |
| Art. 37 | Data Protection Officer | ⚠️ | DPO not appointed; likely not required (< 250 employees, no large-scale systematic monitoring of individuals); re-assess at scale |

### Chapter V — Transfers to Third Countries

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| Art. 44–49 | International transfers | ⚠️ | Railway (US) and Resend (US) are sub-processors; transfers rely on Standard Contractual Clauses (SCCs) embedded in their platform DPAs; explicit SCC schedule not produced separately |

### Chapter VII — Cooperation and Consistency

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| Art. 77 | Right to lodge complaint | ✅ | Noted in privacy policy; users may complain to their local supervisory authority |

---

## Cookie & Local Storage Assessment

| Storage | Key | Purpose | Lawful basis | Consent required? |
|---------|-----|---------|--------------|-------------------|
| `HttpOnly` cookie | `refresh_token` | Session management | Contract (Art. 6(1)(b)) | No — strictly necessary |
| `localStorage` | None (access token held in memory) | — | — | — |

No analytics cookies, advertising cookies, or third-party tracking pixels are used. A cookie consent banner is **not required** for strictly-necessary session cookies under GDPR / ePrivacy Directive Recital 66.

---

## Remediation Roadmap

| Priority | Item | Effort | Target |
|----------|------|--------|--------|
| P1 | Link to `/privacy` on registration page | XS | Next sprint |
| P1 | Add `processingRestricted` flag (Art. 18) | S | Future issue |
| P2 | Formal RoPA document | S | Before EU customer onboarding |
| P2 | Counter-signed sub-processor DPAs | M | Before EU customer onboarding |
| P3 | Lightweight DPIA | S | Before health-sector outreach |
| P3 | DPO assessment at growth milestone | — | Ongoing |

---

## Related Documents

- [`docs/pii-inventory.md`](../pii-inventory.md) — PII fields, retention, and user rights
- [`docs/compliance/sub-processors.md`](sub-processors.md) — sub-processor list
- [`docs/compliance/breach-notification.md`](breach-notification.md) — breach notification runbook
- [`docs/security-policy.md`](../security-policy.md) — vulnerability disclosure
- [`docs/tls-rotation.md`](../tls-rotation.md) — TLS and HTTPS

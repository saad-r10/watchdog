# Data Breach Notification Runbook

GDPR Articles 33 and 34 require notification to the supervisory authority within **72 hours** of becoming aware of a personal data breach, and — where the breach is likely to result in a high risk to individuals — direct notification to affected data subjects without undue delay.

---

## 1. Classify the Incident

Run through the following checklist as soon as a potential breach is detected.

| Question | Yes | No |
|----------|-----|----|
| Was personal data (email, name, hashed password, monitor URLs, alert channels) involved? | → Proceed | Not a GDPR breach |
| Was the exposure accidental (misconfiguration, bug) or the result of an attack? | Log both | — |
| Is it confirmed, or still suspected/under investigation? | Confirmed breach → Step 2 | Suspected → investigate first, start 72-h clock once confirmed |

### Breach Severity

| Level | Description | Example |
|-------|-------------|---------|
| **Low** | Accidental internal disclosure, no external exposure, no sensitive data | Dev accidentally queries prod DB via read-only creds |
| **Medium** | Limited external exposure, low-sensitivity data, contained quickly | Logging bug exposes email addresses in an error log accessible to a restricted audience |
| **High** | External exposure of passwords/tokens, large-scale, or ongoing attack | SQL injection exposes User table; unauthorised API key access |

---

## 2. Containment (immediate)

1. **Identify and isolate** the affected system or endpoint.
2. **Revoke credentials** implicated in the breach (rotate JWT secret, revoke all refresh tokens via `refreshToken` table, invalidate API keys).
3. **Preserve evidence** — do not delete logs or rotate secrets before capturing the relevant log snapshot.
4. **Notify the on-call engineer** if not already involved.

---

## 3. Assessment (within 12 hours of detection)

Document the following in a private incident report:

- **What data was involved?** (fields, models — reference `docs/pii-inventory.md`)
- **How many data subjects are affected?**
- **What is the likely impact?** (financial harm, identity theft risk, reputational damage)
- **What is the root cause?**
- **Is the breach ongoing or contained?**

---

## 4. Supervisory Authority Notification (within 72 hours)

File a report with the relevant Data Protection Authority (DPA). For UK/EU users:

- **UK**: [ICO Report a Breach](https://ico.org.uk/make-a-complaint/data-security-and-breaches/data-security-and-breaches/) — report via the ICO online portal.
- **EU (lead authority)**: Determined by Watchdog's EU establishment or, in the absence of one, the DPA of the member state where most affected data subjects reside.

**Required information (Art. 33(3)):**

1. Nature of the breach (categories and approximate number of data subjects; categories and approximate number of records)
2. Name and contact of the Data Protection Officer (or compliance contact)
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach and mitigate its effects

If all information is not yet available within 72 hours, submit an initial notification with what is known and supplement it as the investigation continues (Art. 33(4)).

**72-hour clock starts** from the moment Watchdog becomes aware of the breach (i.e., when any employee or contractor has confirmed knowledge — not from when the breach occurred).

---

## 5. Data Subject Notification (if high risk)

Notification to affected data subjects is required when the breach is likely to result in a **high risk** to their rights and freedoms (Art. 34).

Indicators of high risk:
- Passwords or password hashes exposed
- Financial data or health data involved
- Large scale (> 500 data subjects)
- Sensitive account or alert-channel credentials exposed

**Notification channel**: email to the affected user's registered address (or `alertEmail` if set), sent from the configured `ALERT_FROM_EMAIL`.

**Required content (Art. 34(2)):**
1. Plain-language description of the nature of the breach
2. Name and contact of the compliance contact
3. Likely consequences
4. Steps Watchdog has taken or is taking
5. Steps the user can take to protect themselves (e.g., change password, revoke connected services)

---

## 6. Internal Documentation

Regardless of notification outcome, log the breach in an internal breach register (a private document or secure issue tracker entry) covering:

- Date/time of detection and containment
- Nature of the breach
- Data subjects affected
- Regulatory notifications sent (dates, reference numbers)
- Data subject notifications sent
- Root cause
- Corrective measures

GDPR requires this register to be maintained and available to supervisory authorities on request (Art. 33(5)).

---

## 7. Post-Incident Review

Within 14 days of containment:

1. Conduct a root-cause analysis.
2. Update `docs/security-policy.md` if the breach reveals a gap in the patching SLA or disclosure process.
3. Create a GitHub issue for any systemic fix required.
4. Consider whether the breach warrants a DPIA (Data Protection Impact Assessment) for the affected processing activity.

---

## Contacts

| Role | Contact |
|------|---------|
| Compliance lead | saad.r0521@gmail.com |
| ICO (UK) breach portal | https://ico.org.uk/make-a-complaint/data-security-and-breaches/ |
| EDPB DPA finder | https://www.edpb.europa.eu/about-edpb/about-edpb/members_en |

---

## Related Documents

- [`docs/pii-inventory.md`](../pii-inventory.md) — what data is held and where
- [`docs/compliance/gdpr-gap-analysis.md`](gdpr-gap-analysis.md) — GDPR compliance status
- [`docs/security-policy.md`](../security-policy.md) — vulnerability disclosure and patching SLAs

# Dependency Security Policy

## Vulnerability Scanning

All pull requests and pushes to `main` run `npm audit --audit-level=high` across every workspace (root, `apps/backend`, `apps/frontend`, `packages/shared-types`). A finding at `high` or `critical` severity fails the CI build and blocks merge.

GitHub **Dependabot** is configured (`.github/dependabot.yml`) to open weekly PRs for:
- Patch-level upgrades grouped into a single PR per workspace (lower noise)
- All four npm workspaces and GitHub Actions

GitHub **CodeQL** runs static analysis on every PR and on a weekly schedule, targeting TypeScript/JavaScript across the full backend source.

## Patching SLA

| Severity | Resolution Target |
|----------|-------------------|
| Critical | ≤ 24 hours |
| High     | ≤ 7 days   |
| Medium   | ≤ 30 days  |
| Low      | Best-effort / next routine release |

A "critical" or "high" finding reported by `npm audit`, Dependabot, or CodeQL must be triaged immediately. If no upstream fix is available, document the risk and apply a mitigation (e.g. `npm audit fix --force`, patching with `patch-package`, or removing the dependency) within the SLA.

## Process

1. **Detection** — CI audit step or Dependabot alert surfaces a CVE
2. **Triage** — assignee reviews CVSS score, exploitability in our context, and available fix versions
3. **Patch** — open a branch (`issue-<N>-cve-<cve-id>`), update the dependency, verify tests pass
4. **Review** — PR reviewed and merged per normal workflow; Dependabot PRs can be merged directly if CI is green
5. **Disclosure** — if the issue was reported externally, notify the reporter once fixed

## Responsible Disclosure

See [SECURITY.md](../SECURITY.md) for the public-facing responsible disclosure policy.

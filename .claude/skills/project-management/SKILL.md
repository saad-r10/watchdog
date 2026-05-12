---
name: project-management
description: GitHub project management for Watchdog. Covers issue creation, branch workflows, PR management, and the "no task, no work" principle. Use when discussing tasks, creating issues, or managing the development workflow.
---

# Watchdog Project Management

GitHub-based project management following the "no task, no work" principle.

## Core Principles

1. **No Task, No Work**: Every piece of work must have a GitHub issue before starting
2. **Branch per Issue**: Branch names follow `issue-{N}-{slug}` pattern
3. **PR-Based Closure**: Issues are closed via PR merge with "Closes #N"

## Workflow

### 1. Create Issue

```bash
gh issue create --title "Add SSL expiry check" --body "Description..." --label "feature,security"
```

### 2. Create Branch

```bash
git checkout -b issue-{N}-{slug}
# Example:
git checkout -b issue-5-ssl-expiry-check
```

### 3. Commit

```bash
git add apps/backend/src/workers/ssl.worker.ts
git commit -m "feat: add SSL expiry worker

- Checks cert expiry days for all active monitors
- Creates Incident when expiry < 14 days"
```

### 4. Push and Create PR

```bash
git push -u origin issue-5-ssl-expiry-check
gh pr create \
  --title "feat: add SSL expiry check" \
  --body "## Summary
- Added SSL expiry worker

## Test plan
- [ ] Unit test ssl checker
- [ ] Verify incident created when expiry < 14 days

Closes #5"
```

## Issue Labels

| Label | Purpose |
|-------|---------|
| `bug` | Something isn't working |
| `feature` | New feature or request |
| `enhancement` | Improvement to existing feature |
| `security` | SSL/header security checks |
| `worker` | node-cron monitoring jobs |
| `database` | Schema/migration changes |

## Branch Naming

Pattern: `issue-{number}-{slug}`

Examples:
- `issue-1-project-setup`
- `issue-5-ssl-expiry-check`
- `issue-12-email-alert-cooldown`

## Commit Convention

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code refactoring
- `test:` — Tests
- `chore:` — Maintenance

## PR Template

```markdown
## Summary
[Brief description of changes]

## Changes
- [Change 1]

## Test Plan
- [ ] Test case 1

Closes #N
```

## NEVER

- Make changes on `main` branch
- Close issues manually
- Skip PR review
- Push directly to `main`

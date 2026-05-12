---
name: doc-check
description: Checks whether CLAUDE.md or any skill files need updating based on the current branch's code changes. Run this before creating a PR to satisfy the pre-PR hook.
---

# Doc Check

This skill reviews the code changes on the current branch and determines whether `CLAUDE.md` or any `.claude/skills/` files need to be updated.

## When to Run

Run `/doc-check` when the `pre-pr-doc-check.sh` hook blocks your `gh pr create` command.

## What to Check

1. **New API routes** → Update `CLAUDE.md` if the route changes the public API surface
2. **New worker** → Update `CLAUDE.md` Worker System table
3. **New Prisma model** → Update `CLAUDE.md` Database Models table
4. **New environment variable** → Update `CLAUDE.md` Environment Variables table + `.env.example`
5. **New pattern/convention** → Update the relevant skill (`express-backend`, `watchdog-feature`, etc.)
6. **Infrastructure change** → Update `railway-deploy` skill or `docker-compose.yml` notes

## Process

```bash
# See what changed on this branch
git diff main...HEAD --name-only

# Review significant changes
git diff main...HEAD -- apps/backend/src/routes/
git diff main...HEAD -- apps/backend/prisma/schema.prisma
git diff main...HEAD -- apps/backend/src/workers/
```

Then:
- Update `CLAUDE.md` sections that are now stale
- Update any skill files that document the changed patterns
- Stage the doc changes: `git add CLAUDE.md .claude/skills/`
- If no doc updates are needed, create `.doc-check-passed` to signal the hook:
  ```bash
  touch .doc-check-passed && git add .doc-check-passed
  ```

## After Doc Check

Re-run your PR creation:

```bash
gh pr create --title "..." --body "..."
```

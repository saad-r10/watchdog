#!/usr/bin/env bash
# Pre-PR documentation check hook
# Blocks `gh pr create` when significant code changes exist without doc updates.
# Exit codes: 0 = allow, 2 = block with message

set -euo pipefail

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

if ! echo "$COMMAND" | grep -q "gh pr create"; then
  exit 0
fi

if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE="origin/main"
elif git rev-parse --verify main >/dev/null 2>&1; then
  BASE="main"
else
  exit 0
fi

MERGE_BASE=$(git merge-base HEAD "$BASE" 2>/dev/null || echo "")
if [ -z "$MERGE_BASE" ]; then
  exit 0
fi

CHANGED_FILES=$(git diff --name-only "$MERGE_BASE"...HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

HAS_SIGNIFICANT=false

while IFS= read -r file; do
  if echo "$file" | grep -qE '\.(test|spec)\.(ts|tsx|js|jsx)$'; then continue; fi
  if echo "$file" | grep -qE '\.(css|scss)$'; then continue; fi
  if echo "$file" | grep -qE 'components/ui/'; then continue; fi

  if echo "$file" | grep -qE 'src/routes/.*\.(ts|tsx)$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE 'src/services/.*\.ts$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE 'src/workers/.*\.ts$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE 'prisma/schema\.prisma$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE 'apps/frontend/src/routes/'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE '^docker-compose\.yml$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE '\.env\.example$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE 'package\.json$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE 'src/repositories/.*\.ts$'; then HAS_SIGNIFICANT=true; break; fi
  if echo "$file" | grep -qE 'packages/shared-types/'; then HAS_SIGNIFICANT=true; break; fi
done <<< "$CHANGED_FILES"

if [ "$HAS_SIGNIFICANT" = false ]; then
  exit 0
fi

HAS_DOC_UPDATE=false

while IFS= read -r file; do
  if echo "$file" | grep -qE '^CLAUDE\.md$|\.claude/skills/|\.claude/hooks/|^docs/|^\.doc-check-passed$'; then
    HAS_DOC_UPDATE=true; break
  fi
done <<< "$CHANGED_FILES"

if [ "$HAS_DOC_UPDATE" = false ]; then
  STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if echo "$file" | grep -qE '^CLAUDE\.md$|\.claude/skills/|\.claude/hooks/|^docs/|^\.doc-check-passed$'; then
      HAS_DOC_UPDATE=true; break
    fi
  done <<< "$STAGED_FILES"
fi

if [ "$HAS_DOC_UPDATE" = true ]; then
  exit 0
fi

echo "BLOCKED: Significant code changes detected without documentation review."
echo "Run /doc-check to verify if CLAUDE.md or skills need updating."
echo "(If no updates are needed, /doc-check will confirm that and you can proceed.)"
exit 2

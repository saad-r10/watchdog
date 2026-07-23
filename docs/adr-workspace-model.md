# ADR: Workspace / Team Data Model

**Status:** Proposed  
**Date:** 2026-07-22  
**Issue:** #137 (multi-tenancy and data isolation)

---

## Context

Watchdog currently uses a flat per-user model: every `Monitor`, `Agent`, `StatusPage`, and `MaintenanceWindow` row carries a `userId` foreign key. Data isolation is enforced at the service layer — every mutating operation calls `getById(id, userId)` before proceeding, and `findBy*` list queries always filter by `userId`. Repository `update` and `delete` methods also accept an optional `userId` that is included in the WHERE clause as a defense-in-depth measure.

This model works well for single-user accounts but breaks down when a team shares a Watchdog instance. Issue #131 tracks the invite flow; this ADR documents the target model and defers full implementation until that issue is prioritized.

---

## Decision

We will introduce a **`Workspace`** entity as the ownership root, sitting between `User` and the resources they own. The migration follows a two-phase approach so that single-user deployments continue to work unchanged throughout.

### Phase 1 — Additive schema (no breaking changes)

```prisma
model Workspace {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())

  members  WorkspaceMember[]
  monitors Monitor[]
  agents   Agent[]
  statusPages StatusPage[]
}

model WorkspaceMember {
  workspaceId String
  userId      String
  role        WorkspaceRole @default(viewer)
  joinedAt    DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([workspaceId, userId])
}

enum WorkspaceRole {
  owner
  admin
  viewer
}
```

All existing resources get a nullable `workspaceId`. A background migration creates a personal workspace for each user and back-fills `workspaceId`. The existing `userId` columns are kept intact and the service layer continues to use them.

### Phase 2 — Switch authorization to workspace scope

Once all rows have `workspaceId` populated:

1. Make `workspaceId` non-nullable on `Monitor`, `Agent`, and `StatusPage`.
2. Remove `userId` from those models (migrate to `WorkspaceMember` lookup).
3. Change service-layer ownership checks: `getById(resourceId, workspaceId)` where `workspaceId` is derived from the authenticated user's active workspace.
4. Update JWT payload to include `activeWorkspaceId`; the `requireRole` middleware checks `WorkspaceMember.role` instead of `User.role`.

### Invite flow (see #131)

`POST /api/workspaces/:id/invites` → sends email with time-limited token → `POST /api/workspaces/:id/invites/accept` sets `WorkspaceMember` row. Revocation: `DELETE /api/workspaces/:id/members/:userId`.

---

## Data isolation guarantees (current, pre-workspace)

The current single-user model already enforces these invariants:

| Layer | Mechanism |
|-------|-----------|
| Service | `getById(id, userId)` throws 404 for cross-user access |
| Repository (update/delete) | `WHERE id = ? AND userId = ?` — eliminates TOCTOU window |
| List queries | Always `WHERE userId = ?` |
| Tests | `src/__tests__/idor.test.ts` — 30+ cross-tenant scenarios covering monitors, agents, status pages, maintenance windows, agent assignment, content-change, response times, and Lighthouse data |

These guarantees carry forward into the workspace model: `userId` is simply replaced by `workspaceId` at each layer.

---

## Consequences

- **Good:** Teams can share monitors and agents without separate Watchdog instances.
- **Good:** Per-workspace roles allow read-only stakeholders without giving them admin access.
- **Trade-off:** Phase 2 is a breaking schema migration on a live table; requires careful coordination with Railway deploy.
- **Deferred:** Implementation blocked on #131 (invite flow) being scheduled.

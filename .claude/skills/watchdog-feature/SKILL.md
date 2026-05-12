---
name: watchdog-feature
description: End-to-end feature implementation for Watchdog. Guides adding Prisma models, Express routes, services, repositories, node-cron workers, and React pages. Use when implementing new features or adding new monitoring capabilities.
---

# Watchdog Feature Implementation

End-to-end guide for implementing features following Watchdog's layered architecture.

## Architecture Overview

```
packages/shared-types/src/    # Zod schemas (single source of truth)
apps/backend/src/
  prisma/schema.prisma        # Prisma schema
  repositories/               # Prisma data access
  services/                   # Business logic
  routes/                     # Express routers
  workers/                    # node-cron jobs
  middleware/                 # Auth, validation, error handling
apps/frontend/src/
  routes/                     # React Router pages
  components/                 # React components
  services/                   # API client (axios)
  hooks/                      # TanStack Query hooks
```

## Implementation Workflow

### Phase 1: Shared Types

**File**: `packages/shared-types/src/index.ts`

```typescript
import { z } from "zod";

export const CreateMonitorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  intervalMinutes: z.number().int().min(1).default(5),
});

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>;
```

### Phase 2: Prisma Schema

**File**: `apps/backend/prisma/schema.prisma`

```prisma
model Monitor {
  id              String    @id @default(uuid())
  userId          String
  name            String
  url             String
  intervalMinutes Int       @default(5)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  checks    Check[]
  incidents Incident[]
}
```

```bash
cd apps/backend && npx prisma migrate dev --name add_monitor
```

### Phase 3: Repository Layer

**File**: `apps/backend/src/repositories/monitor.repository.ts`

```typescript
import { prisma } from "../db";
import type { Monitor, Prisma } from "@prisma/client";

export const monitorRepository = {
  async create(data: Prisma.MonitorCreateInput): Promise<Monitor> {
    return prisma.monitor.create({ data });
  },
  async findById(id: string): Promise<Monitor | null> {
    return prisma.monitor.findUnique({ where: { id } });
  },
  async findByUser(userId: string): Promise<Monitor[]> {
    return prisma.monitor.findMany({ where: { userId } });
  },
  async findAllActive(): Promise<Monitor[]> {
    return prisma.monitor.findMany({ where: { isActive: true } });
  },
  async update(id: string, data: Prisma.MonitorUpdateInput): Promise<Monitor> {
    return prisma.monitor.update({ where: { id }, data });
  },
  async delete(id: string): Promise<void> {
    await prisma.monitor.delete({ where: { id } });
  },
};
```

### Phase 4: Service Layer

**File**: `apps/backend/src/services/monitor.service.ts`

```typescript
import { monitorRepository } from "../repositories/monitor.repository";
import type { CreateMonitorInput } from "@watchdog/shared-types";

export const monitorService = {
  async create(userId: string, input: CreateMonitorInput) {
    return monitorRepository.create({ ...input, user: { connect: { id: userId } } });
  },
  async getById(id: string, userId: string) {
    const monitor = await monitorRepository.findById(id);
    if (!monitor || monitor.userId !== userId) throw new Error("Monitor not found");
    return monitor;
  },
  async listByUser(userId: string) {
    return monitorRepository.findByUser(userId);
  },
  async delete(id: string, userId: string) {
    await monitorService.getById(id, userId); // ownership check
    await monitorRepository.delete(id);
  },
};
```

### Phase 5: Express Route

**File**: `apps/backend/src/routes/monitors.route.ts`

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CreateMonitorSchema } from "@watchdog/shared-types";
import { monitorService } from "../services/monitor.service";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const monitors = await monitorService.listByUser(req.user.id);
    res.json({ success: true, data: monitors });
  } catch (err) {
    next(err);
  }
});

router.post("/", validate(CreateMonitorSchema), async (req, res, next) => {
  try {
    const monitor = await monitorService.create(req.user.id, req.body);
    res.status(201).json({ success: true, data: monitor });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await monitorService.delete(req.params.id, req.user.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
```

### Phase 6: Register Route

**File**: `apps/backend/src/index.ts`

```typescript
import monitorsRouter from "./routes/monitors.route";
app.use("/api/monitors", monitorsRouter);
```

### Phase 7: node-cron Worker (if needed)

**File**: `apps/backend/src/workers/uptime.worker.ts`

```typescript
import cron from "node-cron";
import { monitorRepository } from "../repositories/monitor.repository";
import { checkRepository } from "../repositories/check.repository";
import { alertService } from "../services/alert.service";
import axios from "axios";

export function startUptimeWorker() {
  cron.schedule("* * * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(async (monitor) => {
      const start = Date.now();
      let status: "up" | "down" = "up";
      let statusCode: number | null = null;
      try {
        const res = await axios.get(monitor.url, { timeout: 10000 });
        statusCode = res.status;
        status = res.status < 400 ? "up" : "down";
      } catch {
        status = "down";
      }
      const responseTime = Date.now() - start;
      await checkRepository.create({ monitorId: monitor.id, status, statusCode, responseTime });
      await alertService.handleUptimeCheck(monitor, status);
    }));
  });
}
```

### Phase 8: Frontend Page

**File**: `apps/frontend/src/routes/monitors/index.tsx`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";

export default function MonitorsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: () => api.getMonitors(),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMonitor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });
  // ... render
}
```

## File Map

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `packages/shared-types/src/index.ts` | Zod schemas |
| Schema | `apps/backend/prisma/schema.prisma` | Prisma models |
| Repository | `apps/backend/src/repositories/*.ts` | DB access |
| Service | `apps/backend/src/services/*.ts` | Business logic |
| Route | `apps/backend/src/routes/*.route.ts` | API endpoints |
| Worker | `apps/backend/src/workers/*.worker.ts` | Cron jobs |
| Frontend | `apps/frontend/src/routes/**/*.tsx` | Pages |

## Related Skills

- `express-backend`: Express patterns, middleware, error handling
- `railway-deploy`: Deploying to Railway
- `project-management`: Issue and branch workflow

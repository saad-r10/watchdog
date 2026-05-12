---
name: express-backend
description: Express.js patterns for Watchdog backend — routing, middleware, validation, error handling, JWT auth, and Prisma integration. Use when building or debugging API endpoints.
---

# Express Backend Patterns

## Entry Point

**File**: `apps/backend/src/index.ts`

```typescript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/error";
import authRouter from "./routes/auth.route";
import monitorsRouter from "./routes/monitors.route";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/monitors", monitorsRouter);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`API running on :${PORT}`));

export default app;
```

## Middleware

### Auth Middleware

**File**: `apps/backend/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user: { id: string; email: string };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
```

### Validation Middleware

**File**: `apps/backend/src/middleware/validate.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Validation error", details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}
```

### Error Handler

**File**: `apps/backend/src/middleware/error.ts`

```typescript
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message ?? "Internal server error" });
}
```

## Prisma Client Singleton

**File**: `apps/backend/src/db/index.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

## Auth Route (JWT)

**File**: `apps/backend/src/routes/auth.route.ts`

```typescript
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { prisma } from "../db";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash, name } });
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

router.post("/login", validate(registerSchema.omit({ name: true })), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

export default router;
```

## Testing with Jest + Supertest

**File**: `apps/backend/src/__tests__/monitors.test.ts`

```typescript
import request from "supertest";
import app from "../index";
import { prisma } from "../db";

let token: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: "test@example.com" } });
  const res = await request(app).post("/api/auth/register").send({
    email: "test@example.com", password: "password123", name: "Test",
  });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: "test@example.com" } });
  await prisma.$disconnect();
});

describe("GET /api/monitors", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/monitors");
    expect(res.status).toBe(401);
  });

  it("returns empty list for new user", async () => {
    const res = await request(app)
      .get("/api/monitors")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
```

## Common Patterns

### Ownership Check

```typescript
const resource = await repository.findById(id);
if (!resource || resource.userId !== req.user.id) {
  return res.status(404).json({ error: "Not found" });
}
```

### Async Route Wrapper (optional helper)

```typescript
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

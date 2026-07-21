import rateLimit, { ipKeyGenerator, Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import { Request } from "express";
import { verifyToken } from "../lib/jwt";

// ---------------------------------------------------------------------------
// Redis store (shared counter across replicas) — only created when REDIS_URL
// is set; otherwise express-rate-limit uses its default MemoryStore.
// ---------------------------------------------------------------------------
let redisClient: Redis | null = null;

function getRedisStore(prefix: string): RedisStore | undefined {
  if (!process.env.REDIS_URL) return undefined;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    redisClient.on("error", (err) => {
      console.error("[rate-limit] Redis error, falling back to memory store:", err.message);
    });
  }

  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) =>
      redisClient!.call(args[0], ...args.slice(1)) as Promise<number>,
  });
}

// ---------------------------------------------------------------------------
// Abuse logging — called whenever any limiter blocks a request
// ---------------------------------------------------------------------------
function logAbuse(req: Request, limitName: string): void {
  console.warn(
    `[rate-limit] ${limitName} triggered — ip=${req.ip} method=${req.method} path=${req.path} ua="${req.headers["user-agent"] ?? ""}"`
  );
}

// ---------------------------------------------------------------------------
// Helper to build a limiter with optional Redis store and consistent abuse logging
// ---------------------------------------------------------------------------
function buildLimiter(name: string, opts: Partial<Options>) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    store: getRedisStore(name),
    handler: (req, res, next, options) => {
      logAbuse(req, name);
      res.status(options.statusCode).json({
        success: false,
        error: (options.message as { error: string }).error,
      });
    },
    ...opts,
    message: opts.message ?? { error: "Too many requests, please try again later." },
  });
}

// ---------------------------------------------------------------------------
// Exported limiters
// ---------------------------------------------------------------------------

/** Catch-all for /api/auth/* — 20 req / 15 min per IP (env-overridable for tests) */
export const authRateLimiter = buildLimiter("auth", {
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? "900000"),
  limit: () => parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? "20"),
  message: { error: "Too many requests, please try again later." },
});

/** POST /api/auth/login — 5 req / min per IP */
export const loginRateLimiter = buildLimiter("login", {
  windowMs: 60 * 1000,
  limit: () => parseInt(process.env.RATE_LIMIT_LOGIN_MAX ?? "5"),
  message: { error: "Too many login attempts. Please try again in 1 minute." },
});

/** POST /api/auth/register — 3 req / min per IP */
export const registerRateLimiter = buildLimiter("register", {
  windowMs: 60 * 1000,
  limit: () => parseInt(process.env.RATE_LIMIT_REGISTER_MAX ?? "3"),
  message: { error: "Too many registration attempts. Please try again later." },
});

/** POST /api/auth/forgot-password — 5 req / 15 min per IP */
export const forgotPasswordRateLimiter = buildLimiter("forgot-password", {
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "Too many reset attempts. Please try again in 15 minutes." },
});

/**
 * POST /api/users/me/settings/test-webhook — 10 req / hr per authenticated user.
 * Must be applied after the `authenticate` middleware so req.user is set.
 */
export const testWebhookRateLimiter = buildLimiter("test-webhook", {
  windowMs: 60 * 60 * 1000,
  limit: () => parseInt(process.env.RATE_LIMIT_TEST_WEBHOOK_MAX ?? "10"),
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Too many webhook test requests. Please wait before trying again." },
});

/**
 * POST /api/agents/checkin — 60 req / min per agent key.
 * Keys by the X-Agent-Key header so each agent has its own counter.
 */
export const agentCheckinRateLimiter = buildLimiter("agent-checkin", {
  windowMs: 60 * 1000,
  limit: () => parseInt(process.env.RATE_LIMIT_CHECKIN_MAX ?? "60"),
  keyGenerator: (req) => {
    const agentKey = req.headers["x-agent-key"];
    return agentKey ? `agent:${agentKey}` : ipKeyGenerator(req.ip ?? "unknown");
  },
  message: { error: "Agent check-in rate limit exceeded. Please slow down." },
});

/**
 * General API limiter — 120 req / min, keyed by authenticated user ID when
 * a valid JWT is present, otherwise by IP. Skips agent checkin (high-frequency by design).
 */
export const apiRateLimiter = buildLimiter("api", {
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS ?? "60000"),
  limit: () => parseInt(process.env.RATE_LIMIT_API_MAX ?? "120"),
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = verifyToken<{ id: string }>(authHeader.slice(7));
        if (decoded?.id) return `user:${decoded.id}`;
      } catch {
        // fall through to IP
      }
    }
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  skip: (req) => req.path === "/agents/checkin" && req.method === "POST",
});

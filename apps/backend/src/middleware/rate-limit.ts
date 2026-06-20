import rateLimit from "express-rate-limit";

const authWindowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? "900000"); // 15 min
const authMax = parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? "20");

const apiWindowMs = parseInt(process.env.RATE_LIMIT_API_WINDOW_MS ?? "60000"); // 1 min
const apiMax = parseInt(process.env.RATE_LIMIT_API_MAX ?? "120");

const errorResponse = {
  success: false,
  error: "Too many requests, please try again later.",
};

export const authRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse,
});

export const apiRateLimiter = rateLimit({
  windowMs: apiWindowMs,
  max: apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse,
  // Agent checkin is high-frequency by design — exclude it
  skip: (req) => req.path === "/agents/checkin" && req.method === "POST",
});

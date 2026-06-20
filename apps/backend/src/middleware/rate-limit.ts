import rateLimit from "express-rate-limit";

const errorResponse = {
  success: false,
  error: "Too many requests, please try again later.",
};

export const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? "900000"),
  limit: () => parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? "20"),
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse,
});

export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS ?? "60000"),
  limit: () => parseInt(process.env.RATE_LIMIT_API_MAX ?? "120"),
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse,
  // Agent checkin is high-frequency by design — exclude it
  skip: (req) => req.path === "/agents/checkin" && req.method === "POST",
});

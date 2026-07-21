import "dotenv/config";
import { execSync } from "child_process";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/error";
import { authRateLimiter, apiRateLimiter } from "./middleware/rate-limit";
import { httpsRedirect } from "./middleware/https-redirect";
import authRouter from "./routes/auth.route";
import monitorsRouter from "./routes/monitors.route";
import checksRouter from "./routes/checks.route";
import usersRouter from "./routes/users.route";
import settingsRouter from "./routes/settings.route";
import agentsRouter from "./routes/agents.route";
import statusPagesRouter from "./routes/status-pages.route";
import statusRouter from "./routes/status.route";
import maintenanceRouter from "./routes/maintenance.route";
import dashboardRouter from "./routes/dashboard.route";
import notificationsRouter from "./routes/notifications.route";
import { ensureSelfMonitor } from "./lib/self-monitor";

if (process.env.NODE_ENV === "production") {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

const app = express();

// Trust the first proxy hop (Railway / Cloudflare) so X-Forwarded-Proto is reliable
app.set("trust proxy", 1);

if (process.env.NODE_ENV === "production") {
  app.use(httpsRedirect);
}

app.use(
  helmet({
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
  })
);
app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRateLimiter, authRouter);
app.use("/api", apiRateLimiter);
app.use("/api/monitors", monitorsRouter);
app.use("/api/monitors/:id", checksRouter);
app.use("/api/users", usersRouter);
app.use("/api/users/me/settings", settingsRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/status-pages", statusPagesRouter);
app.use("/api/status", statusRouter);
app.use("/api/monitors/:id/maintenance", maintenanceRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notifications", notificationsRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT ?? 3001;
  app.listen(PORT, () => {
    console.log(`API running on :${PORT}`);
    ensureSelfMonitor().catch((err) =>
      console.error("[self-monitor] setup failed:", err)
    );
  });
}

export default app;

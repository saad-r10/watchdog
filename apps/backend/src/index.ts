import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/error";
import authRouter from "./routes/auth.route";
import monitorsRouter from "./routes/monitors.route";
import checksRouter from "./routes/checks.route";
import usersRouter from "./routes/users.route";
import settingsRouter from "./routes/settings.route";
import agentsRouter from "./routes/agents.route";
import statusPagesRouter from "./routes/status-pages.route";
import statusRouter from "./routes/status.route";
import maintenanceRouter from "./routes/maintenance.route";

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/monitors", monitorsRouter);
app.use("/api/monitors/:id", checksRouter);
app.use("/api/users", usersRouter);
app.use("/api/users/me/settings", settingsRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/status-pages", statusPagesRouter);
app.use("/api/status", statusRouter);
app.use("/api/monitors/:id/maintenance", maintenanceRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT ?? 3001;
  app.listen(PORT, () => console.log(`API running on :${PORT}`));
}

export default app;

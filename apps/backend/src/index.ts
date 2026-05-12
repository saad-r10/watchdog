import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/error";
import authRouter from "./routes/auth.route";
import monitorsRouter from "./routes/monitors.route";
import checksRouter from "./routes/checks.route";
import usersRouter from "./routes/users.route";

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

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT ?? 3001;
  app.listen(PORT, () => console.log(`API running on :${PORT}`));
}

export default app;

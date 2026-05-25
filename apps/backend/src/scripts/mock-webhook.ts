import express from "express";

const app = express();
app.use(express.json());

const history: unknown[] = [];
const MAX_HISTORY = 20;

app.post("/webhook", (req, res) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 📬 Webhook received:\n${JSON.stringify(payload, null, 2)}`);
  history.unshift(payload);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  res.json({ ok: true });
});

app.get("/webhook/history", (_req, res) => {
  res.json(history);
});

app.listen(3002, () => {
  console.log("📡 Mock webhook receiver → http://localhost:3002/webhook");
});

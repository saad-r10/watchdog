import express from "express";

const app = express();
app.use(express.json());

let broken = false;

app.get("/", (_req, res) => {
  if (broken) {
    res.status(503).json({ status: "down", message: "Simulated outage" });
  } else {
    res.json({ status: "ok", message: "Demo app is running" });
  }
});

app.post("/break", (_req, res) => {
  broken = true;
  console.log("💥 Demo app set to DOWN — returning 503");
  res.json({ ok: true, status: "down" });
});

app.post("/fix", (_req, res) => {
  broken = false;
  console.log("✅ Demo app set to UP — returning 200");
  res.json({ ok: true, status: "up" });
});

app.get("/status", (_req, res) => {
  res.json({ broken, message: broken ? "returning 503" : "returning 200" });
});

app.listen(4000, () => {
  console.log("🟢 Demo app → http://localhost:4000");
  console.log("   POST /break  — simulate outage (503)");
  console.log("   POST /fix    — restore (200)");
  console.log("   GET  /status — current state");
});

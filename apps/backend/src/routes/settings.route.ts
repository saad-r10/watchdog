import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../db";
import { sendWebhook } from "../services/webhook.service";
import { sendSlackAlert } from "../services/slack.service";
import { sendDiscordAlert } from "../services/discord.service";
import { sendTelegramAlert } from "../services/telegram.service";

const router = Router();
router.use(authenticate);

const SELECT = { alertEmail: true, alertDowntime: true, alertSslExpiry: true, alertCertTransparency: true, alertBlocklist: true, alertContentChange: true, alertSyntheticFailure: true, alertPerformanceDegraded: true, alertLighthouseBudget: true, webhookUrl: true, slackWebhookUrl: true, discordWebhookUrl: true, telegramBotToken: true, telegramChatId: true } as const;

const updateSchema = z.object({
  alertEmail: z.string().email().optional().nullable(),
  alertDowntime: z.boolean().optional(),
  alertSslExpiry: z.boolean().optional(),
  alertCertTransparency: z.boolean().optional(),
  alertBlocklist: z.boolean().optional(),
  alertContentChange: z.boolean().optional(),
  alertSyntheticFailure: z.boolean().optional(),
  alertPerformanceDegraded: z.boolean().optional(),
  alertLighthouseBudget: z.boolean().optional(),
  webhookUrl: z.string().url().optional().nullable(),
  slackWebhookUrl: z.string().url().optional().nullable(),
  discordWebhookUrl: z.string().url().optional().nullable(),
  telegramBotToken: z.string().optional().nullable(),
  telegramChatId: z.string().optional().nullable(),
});

router.get("/", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: SELECT });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.put("/", validate(updateSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({ where: { id: req.user.id }, data: req.body, select: SELECT });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.post("/test-webhook", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { webhookUrl: true } });
    if (!user?.webhookUrl) {
      return res.status(400).json({ error: "No webhook URL configured" });
    }
    await sendWebhook(user.webhookUrl, { event: "test", message: "This is a test alert from Watchdog" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/test-slack", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { slackWebhookUrl: true } });
    if (!user?.slackWebhookUrl) {
      return res.status(400).json({ error: "No Slack webhook URL configured" });
    }
    await sendSlackAlert(user.slackWebhookUrl, { event: "test", message: "This is a test alert from Watchdog" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/test-discord", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { discordWebhookUrl: true } });
    if (!user?.discordWebhookUrl) {
      return res.status(400).json({ error: "No Discord webhook URL configured" });
    }
    await sendDiscordAlert(user.discordWebhookUrl, { event: "test", message: "This is a test alert from Watchdog" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/test-telegram", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { telegramBotToken: true, telegramChatId: true } });
    if (!user?.telegramBotToken || !user?.telegramChatId) {
      return res.status(400).json({ error: "Telegram bot token and chat ID must both be configured" });
    }
    await sendTelegramAlert(user.telegramBotToken, user.telegramChatId, { event: "test", message: "This is a test alert from Watchdog" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

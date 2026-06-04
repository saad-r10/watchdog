import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { prisma } from "../db";
import { sendEmail, passwordResetHtml, verifyEmailHtml } from "../services/email.service";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = registerSchema.omit({ name: true });

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash, name } });
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    sendVerificationEmail(user.id, user.email, user.name).catch(console.error);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, emailVerified: false } });
  } catch (err) {
    next(err);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified } });
  } catch (err) {
    next(err);
  }
});

async function sendVerificationEmail(userId: string, email: string, name: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  await sendEmail({
    to: email,
    subject: "Verify your Watchdog email",
    html: verifyEmailHtml(`${frontendUrl}/verify-email?token=${rawToken}`, name),
  });
}

const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post("/forgot-password", validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Always respond 200 to avoid leaking whether the email exists
    if (!user) return res.json({ ok: true });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: email,
      subject: "Reset your Watchdog password",
      html: passwordResetHtml(resetUrl),
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/verify-email", async (req, res, next) => {
  try {
    const raw = String(req.query.token ?? "");
    if (!raw) return res.status(400).json({ error: "Missing token." });
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired verification link." });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

import { authenticate } from "../middleware/auth";

router.post("/resend-verification", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.emailVerified) return res.json({ ok: true });
    await sendVerificationEmail(user.id, user.email, user.name);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

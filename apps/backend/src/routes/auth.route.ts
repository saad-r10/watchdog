import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import https from "https";
import { authenticator } from "otplib";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { prisma } from "../db";
import { sendEmail, passwordResetHtml, verifyEmailHtml } from "../services/email.service";
import { signToken, verifyToken } from "../lib/jwt";
import {
  createRefreshToken,
  rotateRefreshToken,
  setCookieRefreshToken,
  clearCookieRefreshToken,
} from "../lib/refresh-token";
import {
  loginRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
} from "../middleware/rate-limit";

const router = Router();

const MAX_LOGIN_ATTEMPTS = 5;

function lockoutDurationMs(attempts: number): number {
  // Exponential backoff starting at 1 minute, capped at 24 hours
  const minutes = Math.pow(2, attempts - MAX_LOGIN_ATTEMPTS);
  return Math.min(minutes * 60 * 1000, 24 * 60 * 60 * 1000);
}

async function checkPasswordBreached(password: string): Promise<boolean> {
  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  return new Promise((resolve) => {
    const req = https.get(`https://api.pwnedpasswords.com/range/${prefix}`, { timeout: 3000 }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => {
        const found = body.split("\r\n").some((line) => line.startsWith(suffix));
        resolve(found);
      });
    });
    req.on("error", () => resolve(false)); // fail open — don't block registration if HIBP is down
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = registerSchema.omit({ name: true });

router.post("/register", registerRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!process.env.SKIP_HIBP_CHECK) {
      const breached = await checkPasswordBreached(password);
      if (breached) {
        return res.status(422).json({
          error: "This password has appeared in a data breach. Please choose a different password.",
        });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash, name } });
    const token = signToken({ id: user.id, email: user.email, role: user.role }, { expiresIn: "15m" });
    const rawRefresh = await createRefreshToken(user.id);
    setCookieRefreshToken(res, rawRefresh);
    sendVerificationEmail(user.id, user.email, user.name).catch(console.error);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, emailVerified: false } });
  } catch (err) {
    next(err);
  }
});

router.post("/login", loginRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfterSec = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      return res.status(423).json({
        error: "Account temporarily locked due to too many failed login attempts.",
        retryAfter: retryAfterSec,
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      const newAttempts = user.loginAttempts + 1;
      const lockedUntil = newAttempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + lockoutDurationMs(newAttempts))
        : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: newAttempts, lockedUntil },
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Reset lockout state on successful password verification
    if (user.loginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
    }

    // MFA challenge — return a short-lived token instead of the full auth token
    if (user.mfaEnabled) {
      const mfaToken = signToken(
        { id: user.id, email: user.email, purpose: "mfa" },
        { expiresIn: "5m" }
      );
      return res.json({ requiresMfa: true, mfaToken });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role }, { expiresIn: "15m" });
    const rawRefresh = await createRefreshToken(user.id);
    setCookieRefreshToken(res, rawRefresh);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified } });
  } catch (err) {
    next(err);
  }
});

const mfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().length(6),
});

router.post("/mfa-verify", validate(mfaVerifySchema), async (req, res, next) => {
  try {
    const { mfaToken, code } = req.body;

    let payload: { id: string; email: string; purpose: string };
    try {
      payload = verifyToken<{ id: string; email: string; purpose: string }>(mfaToken);
    } catch {
      return res.status(401).json({ error: "Invalid or expired MFA session. Please log in again." });
    }

    if (payload.purpose !== "mfa") {
      return res.status(401).json({ error: "Invalid token type." });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(401).json({ error: "MFA not configured." });
    }

    const valid = authenticator.check(code, user.mfaSecret);
    if (!valid) {
      return res.status(401).json({ error: "Invalid verification code." });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role }, { expiresIn: "15m" });
    const rawRefresh = await createRefreshToken(user.id);
    setCookieRefreshToken(res, rawRefresh);
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

router.post("/forgot-password", forgotPasswordRateLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ ok: true });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

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

    if (!process.env.SKIP_HIBP_CHECK) {
      const breached = await checkPasswordBreached(password);
      if (breached) {
        return res.status(422).json({
          error: "This password has appeared in a data breach. Please choose a different password.",
        });
      }
    }

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

router.post("/refresh", async (req, res, next) => {
  try {
    const raw = req.cookies?.refresh_token as string | undefined;
    if (!raw) return res.status(401).json({ error: "No refresh token" });

    const { userId, newRaw } = await rotateRefreshToken(raw);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const token = signToken({ id: user.id, email: user.email, role: user.role }, { expiresIn: "15m" });
    setCookieRefreshToken(res, newRaw);
    res.json({ token });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 401) return res.status(401).json({ error: (err as Error).message });
    next(err);
  }
});

router.post("/logout", async (req, res) => {
  const raw = req.cookies?.refresh_token as string | undefined;
  if (raw) {
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearCookieRefreshToken(res);
  res.json({ ok: true });
});

router.post("/logout-all", authenticate, async (req, res, next) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearCookieRefreshToken(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

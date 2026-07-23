import { Router } from "express";
import { z } from "zod";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import { userService } from "../services/user.service";

const router = Router();
router.use(authenticate);

router.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, emailVerified: true, mfaEnabled: true, role: true, createdAt: true, deletionScheduledAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// MFA: generate secret and return TOTP URI + QR code (does not enable MFA yet)
router.post("/me/mfa/setup", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, mfaEnabled: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.mfaEnabled) return res.status(409).json({ error: "MFA is already enabled" });

    const secret = authenticator.generateSecret();
    const otpUri = authenticator.keyuri(user.email, "Watchdog", secret);
    const qrCode = await QRCode.toDataURL(otpUri);

    // Store the pending secret; MFA is not active until /enable is called
    await prisma.user.update({ where: { id: req.user.id }, data: { mfaSecret: secret } });

    res.json({ success: true, data: { secret, otpUri, qrCode } });
  } catch (err) {
    next(err);
  }
});

const mfaEnableSchema = z.object({ code: z.string().length(6) });

// MFA: verify TOTP code and enable MFA
router.post("/me/mfa/enable", validate(mfaEnableSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mfaEnabled: true, mfaSecret: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.mfaEnabled) return res.status(409).json({ error: "MFA is already enabled" });
    if (!user.mfaSecret) {
      return res.status(400).json({ error: "No MFA secret found. Call /mfa/setup first." });
    }

    const valid = authenticator.check(req.body.code, user.mfaSecret);
    if (!valid) return res.status(401).json({ error: "Invalid verification code." });

    await prisma.user.update({ where: { id: req.user.id }, data: { mfaEnabled: true } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

const mfaDisableSchema = z.object({ code: z.string().length(6) });

// MFA: verify TOTP code and disable MFA
router.delete("/me/mfa", validate(mfaDisableSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mfaEnabled: true, mfaSecret: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.mfaEnabled) return res.status(400).json({ error: "MFA is not enabled" });

    const valid = authenticator.check(req.body.code, user.mfaSecret!);
    if (!valid) return res.status(401).json({ error: "Invalid verification code." });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Schedule account deletion (30-day grace period before hard delete)
router.delete("/me", async (req, res, next) => {
  try {
    const deletionScheduledAt = await userService.scheduleDeletion(req.user.id);
    res.clearCookie("refresh_token", { path: "/api/auth", httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
    res.status(202).json({ success: true, data: { message: "Account scheduled for deletion. You have 30 days to cancel.", deletionScheduledAt } });
  } catch (err) {
    next(err);
  }
});

// Cancel a previously scheduled account deletion
router.post("/me/cancel-deletion", async (req, res, next) => {
  try {
    await userService.cancelDeletion(req.user.id);
    res.json({ success: true, data: { message: "Account deletion has been cancelled." } });
  } catch (err) {
    next(err);
  }
});

// Export all user data (GDPR Article 20 — portability)
router.get("/me/export", async (req, res, next) => {
  try {
    const data = await userService.exportData(req.user.id);
    res.setHeader("Content-Disposition", 'attachment; filename="watchdog-export.json"');
    res.setHeader("Content-Type", "application/json");
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

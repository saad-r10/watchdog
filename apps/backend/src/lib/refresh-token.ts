import crypto from "crypto";
import type { Response } from "express";
import { prisma } from "../db";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "refresh_token";
const COOKIE_PATH = "/api/auth";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function createRefreshToken(userId: string, family?: string): Promise<string> {
  const raw = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(raw);
  const tokenFamily = family ?? crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({ data: { userId, tokenHash, family: tokenFamily, expiresAt } });
  return raw;
}

export async function rotateRefreshToken(raw: string): Promise<{ userId: string; newRaw: string }> {
  const tokenHash = hashToken(raw);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record) throw Object.assign(new Error("Invalid refresh token"), { status: 401 });

  if (record.revokedAt) {
    // Replay attack — revoke the entire token family
    await prisma.refreshToken.updateMany({
      where: { family: record.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw Object.assign(new Error("Refresh token reuse detected"), { status: 401 });
  }

  if (record.expiresAt < new Date()) {
    throw Object.assign(new Error("Refresh token expired"), { status: 401 });
  }

  // Rotate: revoke old, issue new in same family
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  const newRaw = await createRefreshToken(record.userId, record.family);
  return { userId: record.userId, newRaw };
}

export function setCookieRefreshToken(res: Response, raw: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, raw, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearCookieRefreshToken(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
}

import cron from "node-cron";
import { prisma } from "../db";

export function startRefreshTokenCleanupWorker(): void {
  cron.schedule("0 3 * * *", async () => {
    const result = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    if (result.count > 0) console.log(`[refresh-token-cleanup] Pruned ${result.count} expired refresh tokens`);
  });
}

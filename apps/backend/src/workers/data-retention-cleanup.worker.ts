import cron from "node-cron";
import { prisma } from "../db";
import { userRepository } from "../repositories/user.repository";

export function startDataRetentionCleanupWorker(): void {
  cron.schedule("0 2 * * *", async () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
    const oneYearAgo = new Date(Date.now() - 365 * 86_400_000);

    const [checks, incidents, alerts] = await Promise.all([
      prisma.check.deleteMany({ where: { checkedAt: { lt: ninetyDaysAgo } } }),
      prisma.incident.deleteMany({ where: { startedAt: { lt: oneYearAgo }, isResolved: true } }),
      prisma.alert.deleteMany({ where: { sentAt: { lt: oneYearAgo } } }),
    ]);

    const dueUsers = await userRepository.findDueForDeletion();
    for (const user of dueUsers) {
      await userRepository.hardDelete(user.id);
    }

    console.log(
      `[data-retention] Pruned ${checks.count} checks, ${incidents.count} incidents, ${alerts.count} alerts, ${dueUsers.length} users`
    );
  });
}

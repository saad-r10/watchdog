import { prisma } from "../db";
import { userRepository } from "../repositories/user.repository";

const GRACE_PERIOD_DAYS = 30;

export const userService = {
  async scheduleDeletion(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error("User not found") as any;
      err.status = 404;
      throw err;
    }
    if (user.deletionScheduledAt) {
      const err = new Error("Account deletion is already scheduled") as any;
      err.status = 409;
      throw err;
    }
    const scheduledAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 86_400_000);
    await userRepository.scheduleDeletion(userId, scheduledAt);
    // Revoke all refresh tokens to force logout on all devices
    await prisma.refreshToken.deleteMany({ where: { userId } });
    return scheduledAt;
  },

  async cancelDeletion(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error("User not found") as any;
      err.status = 404;
      throw err;
    }
    if (!user.deletionScheduledAt) {
      const err = new Error("No deletion is scheduled for this account") as any;
      err.status = 400;
      throw err;
    }
    await userRepository.cancelDeletion(userId);
  },

  async exportData(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error("User not found") as any;
      err.status = 404;
      throw err;
    }
    return userRepository.exportData(userId);
  },
};

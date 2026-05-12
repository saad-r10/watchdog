import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

router.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

const updateSchema = z.object({
  alertEmail: z.string().email().optional().nullable(),
  alertDowntime: z.boolean().optional(),
  alertSslExpiry: z.boolean().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { alertEmail: true, alertDowntime: true, alertSslExpiry: true },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.put("/", validate(updateSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body,
      select: { alertEmail: true, alertDowntime: true, alertSslExpiry: true },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { statusPageService } from "../services/status-page.service";

const router = Router();

router.get("/:slug", async (req, res, next) => {
  try {
    const data = await statusPageService.getPublic(req.params.slug);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;

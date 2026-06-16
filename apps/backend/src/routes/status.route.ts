import { Router } from "express";
import { statusPageService } from "../services/status-page.service";

const router = Router();

router.get("/:slug/feed.xml", async (req, res, next) => {
  try {
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
    const baseUrl = `${proto}://${req.get("host")}`;
    const xml = await statusPageService.getFeed(req.params.slug, baseUrl);
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const data = await statusPageService.getPublic(req.params.slug);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;

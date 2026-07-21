import { Request, Response, NextFunction } from "express";

export function httpsRedirect(req: Request, res: Response, next: NextFunction) {
  if (req.headers["x-forwarded-proto"] === "http") {
    const host = req.headers.host ?? req.hostname;
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
}

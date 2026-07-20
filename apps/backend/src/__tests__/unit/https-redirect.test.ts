import request from "supertest";
import express from "express";
import { httpsRedirect } from "../../middleware/https-redirect";

const app = express();
app.use(httpsRedirect);
app.get("/test", (_req, res) => res.json({ ok: true }));

describe("httpsRedirect middleware", () => {
  it("redirects HTTP requests to HTTPS with 301", async () => {
    const res = await request(app)
      .get("/test")
      .set("X-Forwarded-Proto", "http")
      .set("Host", "example.com");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("https://example.com/test");
  });

  it("passes through HTTPS requests unchanged", async () => {
    const res = await request(app)
      .get("/test")
      .set("X-Forwarded-Proto", "https");
    expect(res.status).toBe(200);
  });

  it("passes through requests with no X-Forwarded-Proto", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("preserves the original URL path and query string", async () => {
    const res = await request(app)
      .get("/test?foo=bar")
      .set("X-Forwarded-Proto", "http")
      .set("Host", "example.com");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("https://example.com/test?foo=bar");
  });
});

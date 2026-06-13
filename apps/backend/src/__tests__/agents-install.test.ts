import { execFileSync } from "child_process";
import path from "path";
import request from "supertest";
import app from "../index";
import { prisma } from "../db";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/agents/install.sh", () => {
  it("serves the installer with the request host templated in", async () => {
    const res = await request(app)
      .get("/api/agents/install.sh")
      .set("Host", "watchdog.example.com");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/x-sh");
    expect(res.text.startsWith("#!/bin/sh")).toBe(true);
    expect(res.text).toContain("http://watchdog.example.com");
    expect(res.text).not.toContain("__WATCHDOG_URL__");
  });

  it("honors X-Forwarded-Proto for https deployments behind a proxy", async () => {
    const res = await request(app)
      .get("/api/agents/install.sh")
      .set("Host", "watchdog.example.com")
      .set("X-Forwarded-Proto", "https");

    expect(res.status).toBe(200);
    expect(res.text).toContain("https://watchdog.example.com");
    expect(res.text).not.toContain("http://watchdog.example.com");
  });

  it("is valid POSIX shell syntax", () => {
    const scriptPath = path.join(__dirname, "../../scripts/install-agent.sh");
    // throws (failing the test) if sh rejects the syntax
    execFileSync("sh", ["-n", scriptPath]);
  });
});

import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-security@watchdog.test";
let token: string;
let monitorId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const reg = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL, password: "password123", name: "Security Tester",
  });
  token = reg.body.token;

  const mon = await request(app)
    .post("/api/monitors")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Secure Site", url: "https://example.com" });
  monitorId = mon.body.data.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/monitors/:id/ssl", () => {
  it("returns null before any SSL checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/ssl`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("returns SSL check data after a check is stored", async () => {
    await prisma.check.create({
      data: { monitorId, type: "ssl", status: "valid", sslDaysLeft: 90 },
    });
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/ssl`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sslDaysLeft).toBe(90);
    expect(res.body.data.status).toBe("valid");
  });
});

describe("GET /api/monitors/:id/headers", () => {
  it("returns null before any header checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/headers`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("returns header check data after a check is stored", async () => {
    await prisma.check.create({
      data: {
        monitorId,
        type: "headers",
        status: "fail",
        headers: {
          present: { "x-frame-options": "DENY" },
          missing: ["content-security-policy", "strict-transport-security"],
        },
      },
    });
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/headers`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("fail");
    const { missing } = res.body.data.headers;
    expect(missing).toContain("content-security-policy");
  });
});

describe("GET /api/monitors/:id/certs", () => {
  it("returns empty/null state before any CT checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/certs`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBeNull();
    expect(res.body.data.newCerts).toBeNull();
    expect(res.body.data.totalCertificates).toBe(0);
    expect(res.body.data.recentCertificates).toEqual([]);
  });

  it("returns CT check data and tracked certificates after a baseline run", async () => {
    await prisma.monitorCertificate.create({
      data: {
        monitorId,
        crtShId: "123456",
        commonName: "example.com",
        issuerName: "C=US, O=Let's Encrypt, CN=R3",
        nameValue: "example.com",
        notBefore: new Date("2026-01-01"),
        notAfter: new Date("2026-04-01"),
      },
    });
    await prisma.check.create({
      data: { monitorId, type: "cert_transparency", status: "baseline" },
    });

    const res = await request(app)
      .get(`/api/monitors/${monitorId}/certs`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("baseline");
    expect(res.body.data.totalCertificates).toBe(1);
    expect(res.body.data.recentCertificates[0].commonName).toBe("example.com");
  });

  it("surfaces newCerts when a new certificate is detected", async () => {
    const newCerts = [
      {
        id: 999,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "evil.example.com",
        name_value: "evil.example.com",
        not_before: "2026-06-01T00:00:00",
        not_after: "2026-09-01T00:00:00",
      },
    ];
    await prisma.check.create({
      data: { monitorId, type: "cert_transparency", status: "new_cert", ctNewCerts: newCerts },
    });

    const res = await request(app)
      .get(`/api/monitors/${monitorId}/certs`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("new_cert");
    expect(res.body.data.newCerts).toHaveLength(1);
    expect(res.body.data.newCerts[0].common_name).toBe("evil.example.com");
  });
});

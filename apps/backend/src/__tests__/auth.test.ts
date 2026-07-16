import request from "supertest";
import app from "../index";
import { prisma } from "../db";


const TEST_EMAIL = "test-auth@watchdog.test";
const LOCKOUT_EMAIL = "test-lockout@watchdog.test";
const MFA_EMAIL = "test-mfa@watchdog.test";

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [TEST_EMAIL, LOCKOUT_EMAIL, MFA_EMAIL] } },
  });
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates a new user and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: TEST_EMAIL,
      password: "password123",
      name: "Auth Tester",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.password).toBeUndefined();
  });

  it("rejects duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: TEST_EMAIL,
      password: "password123",
      name: "Duplicate",
    });
    expect(res.status).toBe(409);
  });

  it("rejects short password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "short",
      name: "Bad",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns token for valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "password123",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rejects wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "wrongpassword",
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users/me", () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "password123",
    });
    token = res.body.token;
  });

  it("returns current user with mfaEnabled and role fields", async () => {
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.mfaEnabled).toBe(false);
    expect(res.body.data.role).toBe("owner");
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
  });
});

// ─── Account lockout ─────────────────────────────────────────────────────────

describe("Account lockout", () => {
  let userId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: LOCKOUT_EMAIL } });
    const reg = await request(app).post("/api/auth/register").send({
      email: LOCKOUT_EMAIL,
      password: "Str0ngP@ssword!",
      name: "Lockout Tester",
    });
    userId = reg.body.user.id;
  });

  it("locks account after 5 failed login attempts", async () => {
    // 4 failed attempts — should still be 401
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: LOCKOUT_EMAIL, password: "wrongpassword" });
      expect(res.status).toBe(401);
    }

    // 5th failed attempt triggers lockout
    const lockRes = await request(app)
      .post("/api/auth/login")
      .send({ email: LOCKOUT_EMAIL, password: "wrongpassword" });
    expect(lockRes.status).toBe(401); // the triggering attempt still returns 401

    // 6th attempt — account is now locked
    const lockedRes = await request(app)
      .post("/api/auth/login")
      .send({ email: LOCKOUT_EMAIL, password: "wrongpassword" });
    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.retryAfter).toBeGreaterThan(0);
  });

  it("locked account cannot log in even with correct password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: LOCKOUT_EMAIL, password: "Str0ngP@ssword!" });
    expect(res.status).toBe(423);
  });

  it("resets lockout when lockedUntil is cleared", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { loginAttempts: 0, lockedUntil: null },
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: LOCKOUT_EMAIL, password: "Str0ngP@ssword!" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

// ─── MFA (TOTP) ──────────────────────────────────────────────────────────────

describe("MFA (TOTP)", () => {
  let token: string;
  let mfaSecret: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: MFA_EMAIL } });
    const reg = await request(app).post("/api/auth/register").send({
      email: MFA_EMAIL,
      password: "Str0ngP@ssword!",
      name: "MFA Tester",
    });
    token = reg.body.token;
  });

  it("POST /api/users/me/mfa/setup returns a secret and QR code", async () => {
    const res = await request(app)
      .post("/api/users/me/mfa/setup")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.secret).toBeDefined();
    expect(res.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
    mfaSecret = res.body.data.secret;
  });

  it("POST /api/users/me/mfa/enable rejects an invalid code", async () => {
    const res = await request(app)
      .post("/api/users/me/mfa/enable")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "000000" });
    expect(res.status).toBe(401);
  });

  it("POST /api/users/me/mfa/enable accepts a valid TOTP code", async () => {
    const { authenticator: otpAuth } = await import("otplib");
    const code = otpAuth.generate(mfaSecret);
    const res = await request(app)
      .post("/api/users/me/mfa/enable")
      .set("Authorization", `Bearer ${token}`)
      .send({ code });
    expect(res.status).toBe(200);
  });

  it("login returns requiresMfa:true when MFA is enabled", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: MFA_EMAIL,
      password: "Str0ngP@ssword!",
    });
    expect(res.status).toBe(200);
    expect(res.body.requiresMfa).toBe(true);
    expect(res.body.mfaToken).toBeDefined();
    expect(res.body.token).toBeUndefined();
  });

  it("POST /api/auth/mfa-verify completes login with valid TOTP", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: MFA_EMAIL,
      password: "Str0ngP@ssword!",
    });
    const { mfaToken } = loginRes.body;

    const { authenticator: otpAuth } = await import("otplib");
    const code = otpAuth.generate(mfaSecret);

    const res = await request(app)
      .post("/api/auth/mfa-verify")
      .send({ mfaToken, code });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(MFA_EMAIL);
  });

  it("POST /api/auth/mfa-verify rejects an invalid code", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: MFA_EMAIL,
      password: "Str0ngP@ssword!",
    });
    const { mfaToken } = loginRes.body;
    const res = await request(app)
      .post("/api/auth/mfa-verify")
      .send({ mfaToken, code: "000000" });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/users/me/mfa disables MFA with valid code", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: MFA_EMAIL,
      password: "Str0ngP@ssword!",
    });
    const { authenticator: otpAuth } = await import("otplib");
    const verifyCode = otpAuth.generate(mfaSecret);
    const fullToken = (
      await request(app)
        .post("/api/auth/mfa-verify")
        .send({ mfaToken: loginRes.body.mfaToken, code: verifyCode })
    ).body.token;

    const disableCode = otpAuth.generate(mfaSecret);
    const res = await request(app)
      .delete("/api/users/me/mfa")
      .set("Authorization", `Bearer ${fullToken}`)
      .send({ code: disableCode });
    expect(res.status).toBe(200);
  });

  it("login returns full token after MFA is disabled", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: MFA_EMAIL,
      password: "Str0ngP@ssword!",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.requiresMfa).toBeUndefined();
  });
});

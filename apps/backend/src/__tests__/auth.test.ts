import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-auth@watchdog.test";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
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

  it("returns current user", async () => {
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.password).toBeUndefined();
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
  });
});

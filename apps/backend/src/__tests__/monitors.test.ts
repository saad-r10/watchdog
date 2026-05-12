import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-monitors@watchdog.test";
let token: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const res = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL,
    password: "password123",
    name: "Test User",
  });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/monitors", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/monitors");
    expect(res.status).toBe(401);
  });

  it("returns empty list for new user", async () => {
    const res = await request(app)
      .get("/api/monitors")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("POST /api/monitors", () => {
  it("creates a monitor", async () => {
    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Example", url: "https://example.com" });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe("https://example.com");
  });

  it("rejects invalid url", async () => {
    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad", url: "not-a-url" });
    expect(res.status).toBe(400);
  });
});

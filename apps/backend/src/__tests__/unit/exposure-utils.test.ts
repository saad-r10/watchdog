import axios from "axios";
import { checkSecurityTxt, checkExposedPaths, analyseExposure, EXPOSED_PATHS } from "../../lib/exposure-utils";

jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

describe("checkSecurityTxt", () => {
  it("reports present when /.well-known/security.txt returns 200", async () => {
    mockAxios.get.mockResolvedValue({ status: 200, data: "Contact: mailto:security@example.com" });

    const result = await checkSecurityTxt("https://example.com");

    expect(result.present).toBe(true);
    expect(result.issue).toBeNull();
  });

  it("reports missing when /.well-known/security.txt 404s", async () => {
    mockAxios.get.mockResolvedValue({ status: 404, data: "" });

    const result = await checkSecurityTxt("https://example.com");

    expect(result.present).toBe(false);
    expect(result.issue).toContain("security.txt");
  });
});

describe("checkExposedPaths", () => {
  it("flags a path as exposed when it returns 200 and differs from the 404 baseline", async () => {
    mockAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("/.env")) return { status: 200, data: "DB_PASSWORD=supersecret" };
      return { status: 404, data: "Not Found" };
    });

    const results = await checkExposedPaths("https://example.com");

    const env = results.find((r) => r.path === "/.env");
    expect(env?.exposed).toBe(true);
    expect(env?.statusCode).toBe(200);

    const others = results.filter((r) => r.path !== "/.env");
    expect(others.every((r) => !r.exposed)).toBe(true);
  });

  it("does not flag paths as exposed when the site has a catch-all that returns 200 for everything", async () => {
    mockAxios.get.mockResolvedValue({ status: 200, data: "<html>SPA shell</html>" });

    const results = await checkExposedPaths("https://example.com");

    expect(results).toHaveLength(EXPOSED_PATHS.length);
    expect(results.every((r) => !r.exposed)).toBe(true);
  });

  it("does not flag a path as exposed on request failure", async () => {
    mockAxios.get.mockRejectedValue(new Error("ECONNREFUSED"));

    const results = await checkExposedPaths("https://example.com");

    expect(results.every((r) => !r.exposed && r.statusCode === null)).toBe(true);
  });
});

describe("analyseExposure", () => {
  it("returns a fail status when an exposed path is found", async () => {
    mockAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("/.git/config")) return { status: 200, data: "[core]\n\trepositoryformatversion = 0" };
      return { status: 404, data: "Not Found" };
    });

    const result = await analyseExposure("https://example.com");

    expect(result.status).toBe("fail");
    expect(result.exposedPaths.find((p) => p.path === "/.git/config")?.exposed).toBe(true);
  });

  it("returns a pass status when nothing is exposed, even if security.txt is missing", async () => {
    mockAxios.get.mockResolvedValue({ status: 404, data: "Not Found" });

    const result = await analyseExposure("https://example.com");

    expect(result.status).toBe("pass");
    expect(result.securityTxt.present).toBe(false);
  });
});

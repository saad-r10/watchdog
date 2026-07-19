import dns from "node:dns/promises";
import { assertSsrfSafe, SsrfError } from "../../lib/ssrf-guard";

jest.mock("node:dns/promises");
const mockDns = dns as jest.Mocked<typeof dns>;

beforeEach(() => {
  mockDns.resolve4 = jest.fn();
  mockDns.resolve6 = jest.fn();
});

describe("assertSsrfSafe", () => {
  describe("IP literals — blocked", () => {
    it.each([
      ["127.0.0.1", "http://127.0.0.1/"],
      ["10.0.0.1", "http://10.0.0.1/api"],
      ["172.16.0.1", "https://172.16.0.1/"],
      ["172.31.255.255", "https://172.31.255.255/"],
      ["192.168.1.1", "http://192.168.1.1/"],
      ["169.254.169.254", "http://169.254.169.254/latest/meta-data/"], // AWS metadata
      ["0.0.0.0", "http://0.0.0.0/"],
      ["100.64.0.1", "http://100.64.0.1/"],  // CGNAT
      ["::1", "http://[::1]/"],
    ])("blocks %s", async (_label, url) => {
      await expect(assertSsrfSafe(url)).rejects.toThrow(SsrfError);
    });
  });

  describe("public IP literals — allowed", () => {
    it.each([
      ["8.8.8.8", "http://8.8.8.8/"],
      ["1.1.1.1", "https://1.1.1.1/"],
      ["104.21.0.1", "https://104.21.0.1/"],
    ])("allows %s", async (_label, url) => {
      await expect(assertSsrfSafe(url)).resolves.toBeUndefined();
    });
  });

  describe("blocked hostnames", () => {
    it("blocks localhost", async () => {
      await expect(assertSsrfSafe("http://localhost/")).rejects.toThrow(SsrfError);
    });

    it("blocks ip6-localhost", async () => {
      await expect(assertSsrfSafe("http://ip6-localhost/")).rejects.toThrow(SsrfError);
    });
  });

  describe("disallowed protocols", () => {
    it("blocks file://", async () => {
      await expect(assertSsrfSafe("file:///etc/passwd")).rejects.toThrow(SsrfError);
    });

    it("blocks ftp://", async () => {
      await expect(assertSsrfSafe("ftp://example.com/")).rejects.toThrow(SsrfError);
    });
  });

  describe("hostname resolution", () => {
    it("blocks hostname that resolves to private IP", async () => {
      mockDns.resolve4 = jest.fn().mockResolvedValue(["10.0.0.1"]);
      mockDns.resolve6 = jest.fn().mockRejectedValue(new Error("ENOTFOUND"));
      await expect(assertSsrfSafe("http://internal.corp/")).rejects.toThrow(SsrfError);
    });

    it("blocks hostname that resolves to AWS metadata endpoint", async () => {
      mockDns.resolve4 = jest.fn().mockResolvedValue(["169.254.169.254"]);
      mockDns.resolve6 = jest.fn().mockRejectedValue(new Error("ENOTFOUND"));
      await expect(assertSsrfSafe("http://metadata.internal/")).rejects.toThrow(SsrfError);
    });

    it("blocks when DNS returns no addresses", async () => {
      mockDns.resolve4 = jest.fn().mockRejectedValue(new Error("ENOTFOUND"));
      mockDns.resolve6 = jest.fn().mockRejectedValue(new Error("ENOTFOUND"));
      await expect(assertSsrfSafe("http://nonexistent.example/")).rejects.toThrow(SsrfError);
    });

    it("allows hostname that resolves to public IP", async () => {
      mockDns.resolve4 = jest.fn().mockResolvedValue(["93.184.216.34"]);
      mockDns.resolve6 = jest.fn().mockRejectedValue(new Error("ENOTFOUND"));
      await expect(assertSsrfSafe("http://example.com/")).resolves.toBeUndefined();
    });

    it("blocks if any resolved IP is private (mixed IPv4/IPv6)", async () => {
      mockDns.resolve4 = jest.fn().mockResolvedValue(["93.184.216.34"]);
      mockDns.resolve6 = jest.fn().mockResolvedValue(["::1"]);
      await expect(assertSsrfSafe("http://example.com/")).rejects.toThrow(SsrfError);
    });
  });

  it("throws SsrfError (not generic Error) for all blocked cases", async () => {
    let err: unknown;
    try {
      await assertSsrfSafe("http://127.0.0.1/");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SsrfError);
    expect((err as SsrfError).name).toBe("SsrfError");
  });
});

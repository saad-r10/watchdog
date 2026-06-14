import axios from "axios";
import { promises as dns } from "dns";
import { checkUrlhaus, checkSpamhausDbl, analyseBlocklist } from "../../lib/blocklist-utils";

jest.mock("axios");
jest.mock("dns", () => ({
  promises: { resolve4: jest.fn() },
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockDns = dns as jest.Mocked<typeof dns>;

const HOSTFILE = "# Generated\n127.0.0.1\tmalicious.example.com\n127.0.0.1\tother-bad.example.com\n";

describe("checkSpamhausDbl", () => {
  it("flags a hostname listed on Spamhaus DBL with the matching reason", async () => {
    mockDns.resolve4.mockResolvedValue(["127.0.1.5"]);

    const result = await checkSpamhausDbl("evil.example.com");

    expect(result.source).toBe("spamhaus_dbl");
    expect(result.listed).toBe(true);
    expect(result.detail).toContain("malware");
  });

  it("does not flag a hostname that returns NXDOMAIN", async () => {
    mockDns.resolve4.mockRejectedValue(new Error("ENOTFOUND"));

    const result = await checkSpamhausDbl("good.example.com");

    expect(result.listed).toBe(false);
    expect(result.detail).toBeNull();
  });
});

describe("checkUrlhaus", () => {
  it("treats a feed download failure as not listed", async () => {
    mockAxios.get.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await checkUrlhaus("malicious.example.com");

    expect(result.source).toBe("urlhaus");
    expect(result.listed).toBe(false);
    expect(result.detail).toBeNull();
  });

  it("flags a hostname found in the URLhaus hostfile", async () => {
    mockAxios.get.mockResolvedValue({ data: HOSTFILE });

    const result = await checkUrlhaus("malicious.example.com");

    expect(result.listed).toBe(true);
    expect(result.detail).toContain("URLhaus");
  });

  it("does not flag a hostname absent from the hostfile", async () => {
    mockAxios.get.mockResolvedValue({ data: HOSTFILE });

    const result = await checkUrlhaus("good.example.com");

    expect(result.listed).toBe(false);
    expect(result.detail).toBeNull();
  });
});

describe("analyseBlocklist", () => {
  it("returns status 'listed' when any source matches", async () => {
    mockAxios.get.mockResolvedValue({ data: HOSTFILE });
    mockDns.resolve4.mockRejectedValue(new Error("ENOTFOUND"));

    const result = await analyseBlocklist("malicious.example.com");

    expect(result.hostname).toBe("malicious.example.com");
    expect(result.status).toBe("listed");
    expect(result.sources.find((s) => s.source === "urlhaus")?.listed).toBe(true);
    expect(result.sources.find((s) => s.source === "spamhaus_dbl")?.listed).toBe(false);
  });

  it("returns status 'clean' when no source matches", async () => {
    mockAxios.get.mockResolvedValue({ data: HOSTFILE });
    mockDns.resolve4.mockRejectedValue(new Error("ENOTFOUND"));

    const result = await analyseBlocklist("good.example.com");

    expect(result.status).toBe("clean");
    expect(result.sources.every((s) => !s.listed)).toBe(true);
  });
});

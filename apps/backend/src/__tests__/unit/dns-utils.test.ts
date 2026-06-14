import { promises as dns } from "dns";
import { checkSpf, checkDmarc, checkDkim, checkDanglingCname, analyseDns } from "../../lib/dns-utils";

jest.mock("dns", () => ({
  promises: {
    resolveTxt: jest.fn(),
    resolveCname: jest.fn(),
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  },
}));

const mockDns = dns as jest.Mocked<typeof dns>;

beforeEach(() => {
  mockDns.resolveTxt.mockRejectedValue(new Error("ENODATA"));
  mockDns.resolveCname.mockRejectedValue(new Error("ENODATA"));
  mockDns.resolve4.mockRejectedValue(new Error("ENODATA"));
  mockDns.resolve6.mockRejectedValue(new Error("ENODATA"));
});

describe("checkSpf", () => {
  it("finds a valid SPF record", async () => {
    mockDns.resolveTxt.mockResolvedValue([["v=spf1 include:_spf.example.com ~all"]]);

    const result = await checkSpf("example.com");

    expect(result.present).toBe(true);
    expect(result.record).toContain("v=spf1");
    expect(result.issue).toBeNull();
  });

  it("flags a missing SPF record", async () => {
    mockDns.resolveTxt.mockResolvedValue([["some other txt record"]]);

    const result = await checkSpf("example.com");

    expect(result.present).toBe(false);
    expect(result.issue).toBe("No SPF record found");
  });
});

describe("checkDmarc", () => {
  it("flags a missing DMARC record", async () => {
    const result = await checkDmarc("example.com");

    expect(result.present).toBe(false);
    expect(result.issue).toBe("No DMARC record found");
  });

  it("flags a weak 'p=none' DMARC policy", async () => {
    mockDns.resolveTxt.mockResolvedValue([["v=DMARC1; p=none; rua=mailto:dmarc@example.com"]]);

    const result = await checkDmarc("example.com");

    expect(result.present).toBe(true);
    expect(result.policy).toBe("none");
    expect(result.issue).toContain("'none'");
  });

  it("accepts a 'p=reject' DMARC policy with no issue", async () => {
    mockDns.resolveTxt.mockResolvedValue([["v=DMARC1; p=reject; rua=mailto:dmarc@example.com"]]);

    const result = await checkDmarc("example.com");

    expect(result.present).toBe(true);
    expect(result.policy).toBe("reject");
    expect(result.issue).toBeNull();
  });
});

describe("checkDkim", () => {
  it("finds DKIM records under common selectors", async () => {
    mockDns.resolveTxt.mockImplementation(async (hostname: string) => {
      if (hostname === "google._domainkey.example.com") {
        return [["v=DKIM1; k=rsa; p=MIGfMA0..."]];
      }
      throw new Error("ENODATA");
    });

    const result = await checkDkim("example.com");

    expect(result.present).toBe(true);
    expect(result.selectors).toContain("google");
  });

  it("reports no DKIM record found when no common selector resolves", async () => {
    const result = await checkDkim("example.com");

    expect(result.present).toBe(false);
    expect(result.selectors).toHaveLength(0);
    expect(result.issue).toBe("No DKIM record found for common selectors");
  });
});

describe("checkDanglingCname", () => {
  it("returns not present when no CNAME exists", async () => {
    const result = await checkDanglingCname("example.com");

    expect(result.present).toBe(false);
    expect(result.dangling).toBe(false);
  });

  it("flags a CNAME pointing to an unresolvable target as dangling", async () => {
    mockDns.resolveCname.mockResolvedValue(["unclaimed-bucket.s3.amazonaws.com"]);

    const result = await checkDanglingCname("blog.example.com");

    expect(result.present).toBe(true);
    expect(result.dangling).toBe(true);
    expect(result.target).toBe("unclaimed-bucket.s3.amazonaws.com");
    expect(result.issue).toContain("subdomain takeover");
  });

  it("does not flag a CNAME pointing to a resolvable target", async () => {
    mockDns.resolveCname.mockResolvedValue(["app.herokuapp.com"]);
    mockDns.resolve4.mockResolvedValue(["1.2.3.4"]);

    const result = await checkDanglingCname("app.example.com");

    expect(result.present).toBe(true);
    expect(result.dangling).toBe(false);
    expect(result.issue).toBeNull();
  });
});

describe("analyseDns", () => {
  it("returns pass status when SPF, DMARC are healthy and CNAME is fine", async () => {
    mockDns.resolveTxt.mockImplementation(async (hostname: string) => {
      if (hostname === "example.com") return [["v=spf1 -all"]];
      if (hostname === "_dmarc.example.com") return [["v=DMARC1; p=reject"]];
      throw new Error("ENODATA");
    });

    const result = await analyseDns("example.com");

    expect(result.status).toBe("pass");
  });

  it("returns fail status when SPF is missing", async () => {
    mockDns.resolveTxt.mockImplementation(async (hostname: string) => {
      if (hostname === "_dmarc.example.com") return [["v=DMARC1; p=reject"]];
      throw new Error("ENODATA");
    });

    const result = await analyseDns("example.com");

    expect(result.status).toBe("fail");
    expect(result.spf.issue).toBe("No SPF record found");
  });

  it("does not let a missing DKIM record alone cause a fail status", async () => {
    mockDns.resolveTxt.mockImplementation(async (hostname: string) => {
      if (hostname === "example.com") return [["v=spf1 -all"]];
      if (hostname === "_dmarc.example.com") return [["v=DMARC1; p=reject"]];
      throw new Error("ENODATA");
    });

    const result = await analyseDns("example.com");

    expect(result.dkim.present).toBe(false);
    expect(result.status).toBe("pass");
  });
});

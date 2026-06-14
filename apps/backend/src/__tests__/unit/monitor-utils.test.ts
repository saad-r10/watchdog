import {
  getSslStatus,
  getUptimeStatus,
  analyseHeaders,
  analyseCookies,
  analyseMixedContent,
  SSL_EXPIRY_WARN_DAYS,
} from "../../lib/monitor-utils";

describe("getSslStatus", () => {
  it("returns valid when days > warn threshold", () => {
    expect(getSslStatus(SSL_EXPIRY_WARN_DAYS + 1)).toBe("valid");
    expect(getSslStatus(90)).toBe("valid");
  });

  it("returns expiring_soon at the warn threshold", () => {
    expect(getSslStatus(SSL_EXPIRY_WARN_DAYS)).toBe("expiring_soon");
    expect(getSslStatus(7)).toBe("expiring_soon");
    expect(getSslStatus(1)).toBe("expiring_soon");
  });

  it("returns expired at 0 or negative days", () => {
    expect(getSslStatus(0)).toBe("expired");
    expect(getSslStatus(-5)).toBe("expired");
  });
});

describe("getUptimeStatus", () => {
  it("returns up for 2xx responses", () => {
    expect(getUptimeStatus(200)).toBe("up");
    expect(getUptimeStatus(201)).toBe("up");
    expect(getUptimeStatus(204)).toBe("up");
    expect(getUptimeStatus(301)).toBe("up");
    expect(getUptimeStatus(399)).toBe("up");
  });

  it("returns down for 4xx and 5xx responses", () => {
    expect(getUptimeStatus(400)).toBe("down");
    expect(getUptimeStatus(404)).toBe("down");
    expect(getUptimeStatus(500)).toBe("down");
    expect(getUptimeStatus(503)).toBe("down");
  });

  it("returns down when statusCode is null (network error)", () => {
    expect(getUptimeStatus(null)).toBe("down");
  });
});

describe("analyseHeaders", () => {
  it("marks all headers present and returns pass", () => {
    const headers = {
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'self'",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "geolocation=()",
    };
    const result = analyseHeaders(headers);
    expect(result.status).toBe("pass");
    expect(result.missing).toHaveLength(0);
    expect(Object.keys(result.present)).toHaveLength(6);
  });

  it("marks absent headers as missing and returns fail", () => {
    const headers = {
      "x-frame-options": "SAMEORIGIN",
    };
    const result = analyseHeaders(headers);
    expect(result.status).toBe("fail");
    expect(result.missing).toContain("content-security-policy");
    expect(result.missing).toContain("strict-transport-security");
    expect(result.present["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("returns fail with all headers missing when response has none", () => {
    const result = analyseHeaders({});
    expect(result.status).toBe("fail");
    expect(result.missing).toHaveLength(6);
    expect(Object.keys(result.present)).toHaveLength(0);
  });
});

describe("analyseCookies", () => {
  it("returns an empty array when no Set-Cookie headers are present", () => {
    expect(analyseCookies(undefined, true)).toEqual([]);
  });

  it("flags all attributes as missing for a bare cookie on an https page", () => {
    const result = analyseCookies(["sessionId=abc123; Path=/"], true);
    expect(result).toEqual([
      { name: "sessionId", missingSecure: true, missingHttpOnly: true, missingSameSite: true },
    ]);
  });

  it("flags nothing for a cookie with Secure, HttpOnly, and SameSite set", () => {
    const result = analyseCookies(["sessionId=abc123; Path=/; HttpOnly; Secure; SameSite=Strict"], true);
    expect(result).toEqual([
      { name: "sessionId", missingSecure: false, missingHttpOnly: false, missingSameSite: false },
    ]);
  });

  it("does not flag missingSecure on a plain http page", () => {
    const result = analyseCookies(["sessionId=abc123; Path=/; HttpOnly; SameSite=Lax"], false);
    expect(result[0].missingSecure).toBe(false);
    expect(result[0].missingHttpOnly).toBe(false);
    expect(result[0].missingSameSite).toBe(false);
  });

  it("analyses multiple cookies independently", () => {
    const result = analyseCookies(
      ["a=1; HttpOnly; Secure; SameSite=Strict", "b=2; Path=/"],
      true
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "a", missingSecure: false, missingHttpOnly: false, missingSameSite: false });
    expect(result[1]).toEqual({ name: "b", missingSecure: true, missingHttpOnly: true, missingSameSite: true });
  });
});

describe("analyseMixedContent", () => {
  it("flags an http:// resource referenced from an https page", () => {
    const html = '<html><body><img src="http://example.com/x.png"></body></html>';
    const result = analyseMixedContent(html, "https://example.com");
    expect(result).toEqual([{ url: "http://example.com/x.png" }]);
  });

  it("returns an empty array when all resources are https or relative", () => {
    const html = '<html><body><img src="https://example.com/x.png"><link href="/style.css"></body></html>';
    expect(analyseMixedContent(html, "https://example.com")).toEqual([]);
  });

  it("does not flag http:// resources on a plain http page", () => {
    const html = '<html><body><img src="http://example.com/x.png"></body></html>';
    expect(analyseMixedContent(html, "http://example.com")).toEqual([]);
  });

  it("ignores data-src and similar attributes", () => {
    const html = '<html><body><img data-src="http://example.com/x.png" loading="lazy"></body></html>';
    expect(analyseMixedContent(html, "https://example.com")).toEqual([]);
  });

  it("deduplicates repeated mixed-content URLs", () => {
    const html = `
      <img src="http://example.com/x.png">
      <img src="http://example.com/x.png">
    `;
    expect(analyseMixedContent(html, "https://example.com")).toEqual([{ url: "http://example.com/x.png" }]);
  });

  it("returns an empty array when html is undefined", () => {
    expect(analyseMixedContent(undefined, "https://example.com")).toEqual([]);
  });
});

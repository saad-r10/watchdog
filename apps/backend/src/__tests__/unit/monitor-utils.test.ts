import { getSslStatus, getUptimeStatus, analyseHeaders, SSL_EXPIRY_WARN_DAYS } from "../../lib/monitor-utils";

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

import { hashContent } from "../../lib/content-hash";

describe("hashContent", () => {
  it("returns the same hash for the same content", () => {
    const body = Buffer.from("<html><body>Hello</body></html>");
    expect(hashContent(body)).toBe(hashContent(Buffer.from(body)));
  });

  it("returns a different hash when content changes", () => {
    const before = Buffer.from("<html><body>Hello</body></html>");
    const after = Buffer.from("<html><body>Hacked</body></html>");
    expect(hashContent(before)).not.toBe(hashContent(after));
  });

  it("returns a 64-character hex digest", () => {
    expect(hashContent(Buffer.from("x"))).toMatch(/^[0-9a-f]{64}$/);
  });
});

import axios from "axios";
import { fetchCertTransparencyEntries } from "../../lib/crtsh";

jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

describe("fetchCertTransparencyEntries", () => {
  it("dedupes entries by crt.sh id (one row per SAN match)", async () => {
    mockAxios.get.mockResolvedValue({
      data: [
        { id: 1, issuer_name: "Let's Encrypt", common_name: "example.com", name_value: "example.com", not_before: "2026-01-01", not_after: "2026-04-01" },
        { id: 1, issuer_name: "Let's Encrypt", common_name: "example.com", name_value: "www.example.com", not_before: "2026-01-01", not_after: "2026-04-01" },
        { id: 2, issuer_name: "Let's Encrypt", common_name: "api.example.com", name_value: "api.example.com", not_before: "2026-02-01", not_after: "2026-05-01" },
      ],
    });

    const entries = await fetchCertTransparencyEntries("example.com");

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.id).sort()).toEqual([1, 2]);
  });

  it("returns an empty array when crt.sh has no results (non-array response)", async () => {
    mockAxios.get.mockResolvedValue({ data: "" });

    const entries = await fetchCertTransparencyEntries("example.com");

    expect(entries).toEqual([]);
  });

  it("queries crt.sh with a wildcard pattern for the hostname", async () => {
    mockAxios.get.mockResolvedValue({ data: [] });

    await fetchCertTransparencyEntries("example.com");

    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("%.example.com")),
      expect.any(Object)
    );
  });
});

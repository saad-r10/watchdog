import http from "node:http";
import type { AddressInfo } from "node:net";
import { timedRequest } from "../../lib/timed-request";

// Bypass SSRF guard so tests can make requests to the local test server
jest.mock("../../lib/ssrf-guard", () => ({
  assertSsrfSafe: jest.fn().mockResolvedValue(undefined),
  SsrfError: class SsrfError extends Error {},
}));

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe("timedRequest", () => {
  it("returns timings and payload size for a 200 response (IP literal)", async () => {
    const body = "hello watchdog";
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(body);
    });
    const port = await listen(server);

    const result = await timedRequest(`http://127.0.0.1:${port}/`);
    await close(server);

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.timings.sizeBytes).toBe(Buffer.byteLength(body));
    expect(result.timings.dnsMs).toBe(0); // IP literal: no DNS lookup
    expect(result.timings.tlsMs).toBeNull(); // plain HTTP: no handshake
    expect(result.timings.tcpMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.downloadMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("measures DNS when the host requires a lookup", async () => {
    const server = http.createServer((_req, res) => res.end("ok"));
    const port = await listen(server);

    const result = await timedRequest(`http://localhost:${port}/`);
    await close(server);

    expect(result.ok).toBe(true);
    expect(result.timings.dnsMs).not.toBeNull();
    expect(result.timings.dnsMs!).toBeGreaterThanOrEqual(0);
  });

  it("follows redirects, accumulating phases; sizeBytes is the final hop only", async () => {
    const finalBody = "final destination";
    const server = http.createServer((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { Location: "/end" });
        res.end("redirect body that must not count");
      } else {
        res.writeHead(200);
        res.end(finalBody);
      }
    });
    const port = await listen(server);

    const result = await timedRequest(`http://127.0.0.1:${port}/start`);
    await close(server);

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.timings.sizeBytes).toBe(Buffer.byteLength(finalBody));
    // Two hops: phases accumulated, non-null
    expect(result.timings.tcpMs).not.toBeNull();
    expect(result.timings.ttfbMs).not.toBeNull();
  });

  it("gives up on a redirect loop", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(302, { Location: "/loop" });
      res.end();
    });
    const port = await listen(server);

    const result = await timedRequest(`http://127.0.0.1:${port}/loop`, { maxRedirects: 5 });
    await close(server);

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBeNull();
  });

  it("resolves ok:false on timeout, keeping completed phases", async () => {
    // Accept the connection but never respond
    const server = http.createServer(() => {
      /* hang */
    });
    const port = await listen(server);

    const result = await timedRequest(`http://127.0.0.1:${port}/`, { timeoutMs: 200 });
    server.closeAllConnections?.();
    await close(server);

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.timings.tcpMs).not.toBeNull(); // connect completed
    expect(result.timings.ttfbMs).toBeNull(); // never got a response
    expect(result.timings.downloadMs).toBeNull();
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(190);
  });

  it("never rejects on connection refused", async () => {
    // Grab a port then close the server so nothing is listening
    const server = http.createServer();
    const port = await listen(server);
    await close(server);

    const result = await timedRequest(`http://127.0.0.1:${port}/`);

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("treats HTTP error statuses as received responses (validateStatus parity)", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(500);
      res.end("boom");
    });
    const port = await listen(server);

    const result = await timedRequest(`http://127.0.0.1:${port}/`);
    await close(server);

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(500);
    expect(result.timings.sizeBytes).toBe(4);
  });
});

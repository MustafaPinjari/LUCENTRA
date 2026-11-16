/**
 * @file tests/resource-fetcher.test.ts
 * @package @lucentra/extension
 * @description Unit tests for out-of-band resource fetching, size limits, and security constraints.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { ResourceFetcher } from "../src/services/resource-fetcher.js";
import type { DiscoveredScript } from "../src/types/resources.js";
import { computeResourceHash } from "../src/utils/crypto.js";

test("ResourceFetcher: blocks inline scripts from out-of-band fetching", async () => {
  const fetcher = new ResourceFetcher();
  const script: DiscoveredScript = {
    rawUrl: "(inline)",
    normalizedUrl: "(inline)",
    path: "(inline)",
    tagName: "SCRIPT",
    isInline: true,
    discoveredAt: Date.now(),
  };

  const digest = await fetcher.fetchAndDigestResource(script);
  assert.equal(digest.status, "BLOCKED");
  assert.equal(digest.errorMessage?.includes("Inline scripts cannot be verified"), true);
});

test("ResourceFetcher: blocks non-web schemes", async () => {
  const fetcher = new ResourceFetcher();
  const script: DiscoveredScript = {
    rawUrl: "file:///C:/test.js",
    normalizedUrl: "file:///C:/test.js",
    path: "/test.js",
    tagName: "SCRIPT",
    isInline: false,
    discoveredAt: Date.now(),
  };

  const digest = await fetcher.fetchAndDigestResource(script);
  assert.equal(digest.status, "BLOCKED");
  assert.equal(digest.errorMessage?.includes("Only HTTP and HTTPS URLs are permitted"), true);
});

test("ResourceFetcher: blocks SSRF private addresses", async () => {
  const fetcher = new ResourceFetcher({ allowLocalhost: false });
  const script: DiscoveredScript = {
    rawUrl: "http://192.168.1.50/app.js",
    normalizedUrl: "http://192.168.1.50/app.js",
    path: "/app.js",
    tagName: "SCRIPT",
    isInline: false,
    discoveredAt: Date.now(),
  };

  const digest = await fetcher.fetchAndDigestResource(script);
  assert.equal(digest.status, "BLOCKED");
  assert.equal(digest.errorMessage?.includes("Access to private or blocked host"), true);
});

test("ResourceFetcher: fetches and hashes valid script bytes from HTTP server", async () => {
  const scriptContent = "console.log('test-resource-fetcher');";
  const expectedHash = await computeResourceHash(new TextEncoder().encode(scriptContent));

  // Spin up temporary local HTTP server
  const server = http.createServer((req, res) => {
    if (req.url === "/static/app.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(scriptContent);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${port}/static/app.js`,
      normalizedUrl: `http://127.0.0.1:${port}/static/app.js`,
      path: "/static/app.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };

    const digest = await fetcher.fetchAndDigestResource(script);
    assert.equal(digest.status, "FETCHED");
    assert.equal(digest.digest, expectedHash);
    assert.equal(digest.byteLength, Buffer.byteLength(scriptContent));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("ResourceFetcher: enforces max byte size limit", async () => {
  const largeContent = "x".repeat(1000); // 1000 bytes

  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Content-Length": String(largeContent.length),
    });
    res.end(largeContent);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;

  try {
    // Set max size to 500 bytes
    const fetcher = new ResourceFetcher({ allowLocalhost: true, maxByteSize: 500 });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${port}/huge.js`,
      normalizedUrl: `http://127.0.0.1:${port}/huge.js`,
      path: "/huge.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };

    const digest = await fetcher.fetchAndDigestResource(script);
    assert.equal(digest.status, "OVERSIZE");
    assert.equal(digest.errorMessage?.includes("exceeds maximum limit"), true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

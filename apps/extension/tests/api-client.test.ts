/**
 * @file tests/api-client.test.ts
 * @package @lucentra/extension
 * @description Unit tests for DRF backend API client requests, error handling, and 404 handling.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { LucentraApiClient } from "../src/services/api-client.js";

test("ApiClient: normalizes baseUrl trailing slashes", () => {
  const client1 = new LucentraApiClient({ baseUrl: "http://127.0.0.1:8000///" });
  assert.equal((client1 as unknown as { baseUrl: string }).baseUrl, "http://127.0.0.1:8000");

  const client2 = new LucentraApiClient({ baseUrl: "https://api.lucentra.org" });
  assert.equal((client2 as unknown as { baseUrl: string }).baseUrl, "https://api.lucentra.org");
});

test("ApiClient: gets health and handles successful responses", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/v1/health/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;

  try {
    const client = new LucentraApiClient({ baseUrl: `http://127.0.0.1:${port}` });
    const health = await client.getHealth();
    assert.equal(health.status, "healthy");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("ApiClient: returns null on 404 for missing domain verification status", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Not found." }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;

  try {
    const client = new LucentraApiClient({ baseUrl: `http://127.0.0.1:${port}` });
    const res = await client.getDomainVerificationStatus("nonexistent.org");
    assert.equal(res, null);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

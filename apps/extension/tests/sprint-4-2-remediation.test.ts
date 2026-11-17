/**
 * @file tests/sprint-4-2-remediation.test.ts
 * @package @lucentra/extension
 * @description Dedicated Sprint 4.2 Security Remediation and Hardening Regression Suite.
 * Covers findings R01 through R24 across SSRF, Redirects, Streaming, Sessions, Contracts, and Caution Flags.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  canonicalizeManifest,
  hashManifest,
  hashAndFormatResource,
  signReleaseManifestWithAccount,
  type ReleaseManifest,
} from "@lucentra/core";
import { ResourceFetcher } from "../src/services/resource-fetcher.js";
import { VerifierEngine } from "../src/services/verifier-engine.js";
import { BadgeController } from "../src/background/badge-controller.js";
import { isPrivateOrBlockedHost, hasEmbeddedCredentials } from "../src/utils/url.js";
import { type ExtensionConfig, ANVIL_LOCAL_SIGNATURE_VERIFIER } from "../src/types/config.js";
import type { DiscoveredScript } from "../src/types/resources.js";
import { MessageRouter } from "../src/background/message-router.js";
import { getTabVerificationState } from "../src/shared/storage.js";

// ==============================================================================
// R01–R06: REDIRECT REJECTION & FAIL-CLOSED SSRF DEFENSE (LUC-SEC-041-01)
// ==============================================================================

test("R01: 301 Moved Permanently redirect rejected with fail-closed policy", async () => {
  let targetAccessed = false;
  const targetServer = http.createServer((_req, res) => {
    targetAccessed = true;
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end("console.log('301-target');");
  });
  await new Promise<void>((r) => targetServer.listen(0, "127.0.0.1", () => r()));
  const targetPort = (targetServer.address() as { port: number }).port;

  const redirectServer = http.createServer((_req, res) => {
    res.writeHead(301, { Location: `http://127.0.0.1:${targetPort}/target.js` });
    res.end();
  });
  await new Promise<void>((r) => redirectServer.listen(0, "127.0.0.1", () => r()));
  const redirectPort = (redirectServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      normalizedUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      path: "/script.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const result = await fetcher.fetchAndDigestResource(script);
    assert.equal(targetAccessed, false);
    assert.equal(result.status, "FETCH_ERROR");
  } finally {
    await new Promise<void>((r) => targetServer.close(() => r()));
    await new Promise<void>((r) => redirectServer.close(() => r()));
  }
});

test("R02: 302 Found redirect rejected with fail-closed policy", async () => {
  let targetAccessed = false;
  const targetServer = http.createServer((_req, res) => {
    targetAccessed = true;
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end("console.log('302-target');");
  });
  await new Promise<void>((r) => targetServer.listen(0, "127.0.0.1", () => r()));
  const targetPort = (targetServer.address() as { port: number }).port;

  const redirectServer = http.createServer((_req, res) => {
    res.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/target.js` });
    res.end();
  });
  await new Promise<void>((r) => redirectServer.listen(0, "127.0.0.1", () => r()));
  const redirectPort = (redirectServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      normalizedUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      path: "/script.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const result = await fetcher.fetchAndDigestResource(script);
    assert.equal(targetAccessed, false);
    assert.equal(result.status, "FETCH_ERROR");
  } finally {
    await new Promise<void>((r) => targetServer.close(() => r()));
    await new Promise<void>((r) => redirectServer.close(() => r()));
  }
});

test("R03: 307 Temporary Redirect rejected with fail-closed policy", async () => {
  let targetAccessed = false;
  const targetServer = http.createServer((_req, res) => {
    targetAccessed = true;
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end("console.log('307-target');");
  });
  await new Promise<void>((r) => targetServer.listen(0, "127.0.0.1", () => r()));
  const targetPort = (targetServer.address() as { port: number }).port;

  const redirectServer = http.createServer((_req, res) => {
    res.writeHead(307, { Location: `http://127.0.0.1:${targetPort}/target.js` });
    res.end();
  });
  await new Promise<void>((r) => redirectServer.listen(0, "127.0.0.1", () => r()));
  const redirectPort = (redirectServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      normalizedUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      path: "/script.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const result = await fetcher.fetchAndDigestResource(script);
    assert.equal(targetAccessed, false);
    assert.equal(result.status, "FETCH_ERROR");
  } finally {
    await new Promise<void>((r) => targetServer.close(() => r()));
    await new Promise<void>((r) => redirectServer.close(() => r()));
  }
});

test("R04: 308 Permanent Redirect rejected with fail-closed policy", async () => {
  let targetAccessed = false;
  const targetServer = http.createServer((_req, res) => {
    targetAccessed = true;
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end("console.log('308-target');");
  });
  await new Promise<void>((r) => targetServer.listen(0, "127.0.0.1", () => r()));
  const targetPort = (targetServer.address() as { port: number }).port;

  const redirectServer = http.createServer((_req, res) => {
    res.writeHead(308, { Location: `http://127.0.0.1:${targetPort}/target.js` });
    res.end();
  });
  await new Promise<void>((r) => redirectServer.listen(0, "127.0.0.1", () => r()));
  const redirectPort = (redirectServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      normalizedUrl: `http://127.0.0.1:${redirectPort}/script.js`,
      path: "/script.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const result = await fetcher.fetchAndDigestResource(script);
    assert.equal(targetAccessed, false);
    assert.equal(result.status, "FETCH_ERROR");
  } finally {
    await new Promise<void>((r) => targetServer.close(() => r()));
    await new Promise<void>((r) => redirectServer.close(() => r()));
  }
});

test("R05: Redirect to loopback/private IPv4 blocked and private endpoint never touched", async () => {
  let internalServiceAccessed = false;
  const internalServer = http.createServer((_req, res) => {
    internalServiceAccessed = true;
    res.writeHead(200);
    res.end("internal-data");
  });
  await new Promise<void>((r) => internalServer.listen(0, "127.0.0.1", () => r()));
  const internalPort = (internalServer.address() as { port: number }).port;

  const redirectServer = http.createServer((_req, res) => {
    res.writeHead(302, { Location: `http://127.0.0.1:${internalPort}/api/secret` });
    res.end();
  });
  await new Promise<void>((r) => redirectServer.listen(0, "127.0.0.1", () => r()));
  const redirectPort = (redirectServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${redirectPort}/entry.js`,
      normalizedUrl: `http://127.0.0.1:${redirectPort}/entry.js`,
      path: "/entry.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const res = await fetcher.fetchAndDigestResource(script);
    assert.equal(internalServiceAccessed, false);
    assert.equal(res.status, "FETCH_ERROR");
  } finally {
    await new Promise<void>((r) => internalServer.close(() => r()));
    await new Promise<void>((r) => redirectServer.close(() => r()));
  }
});

test("R06: Redirect to AWS/GCP cloud metadata (169.254.169.254) blocked", async () => {
  const redirectServer = http.createServer((_req, res) => {
    res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
    res.end();
  });
  await new Promise<void>((r) => redirectServer.listen(0, "127.0.0.1", () => r()));
  const redirectPort = (redirectServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${redirectPort}/test.js`,
      normalizedUrl: `http://127.0.0.1:${redirectPort}/test.js`,
      path: "/test.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const res = await fetcher.fetchAndDigestResource(script);
    assert.equal(res.status, "FETCH_ERROR");
  } finally {
    await new Promise<void>((r) => redirectServer.close(() => r()));
  }
});

// ==============================================================================
// R07–R10: IPV4-MAPPED IPV6 FILTERING (LUC-SEC-041-02)
// ==============================================================================

test("R07: IPv4-mapped IPv6 loopback blocked by isPrivateOrBlockedHost", () => {
  const dotted = new URL("http://[::ffff:127.0.0.1]/bundle.js").hostname;
  const hex = new URL("http://[::ffff:7f00:1]/bundle.js").hostname;
  assert.equal(isPrivateOrBlockedHost(dotted, false), true);
  assert.equal(isPrivateOrBlockedHost(hex, false), true);
});

test("R08: IPv4-mapped IPv6 cloud metadata blocked by isPrivateOrBlockedHost", () => {
  const dotted = new URL("http://[::ffff:169.254.169.254]/bundle.js").hostname;
  const hex = new URL("http://[::ffff:a9fe:a9fe]/bundle.js").hostname;
  assert.equal(isPrivateOrBlockedHost(dotted, false), true);
  assert.equal(isPrivateOrBlockedHost(hex, false), true);
  assert.equal(isPrivateOrBlockedHost(dotted, true), true); // Cloud metadata blocked even if localhost allowed!
});

test("R09: IPv4-mapped IPv6 private subnets (10/8, 172.16/12, 192.168/16) blocked", () => {
  const priv10 = new URL("http://[::ffff:10.0.0.1]/bundle.js").hostname;
  const priv172 = new URL("http://[::ffff:172.16.0.1]/bundle.js").hostname;
  const priv192 = new URL("http://[::ffff:192.168.1.1]/bundle.js").hostname;
  assert.equal(isPrivateOrBlockedHost(priv10, false), true);
  assert.equal(isPrivateOrBlockedHost(priv172, false), true);
  assert.equal(isPrivateOrBlockedHost(priv192, false), true);
});

test("R10: IPv4-mapped IPv6 public addresses permitted by isPrivateOrBlockedHost", () => {
  const publicDns1 = new URL("http://[::ffff:8.8.8.8]/bundle.js").hostname;
  const publicDns2 = new URL("http://[::ffff:1.1.1.1]/bundle.js").hostname;
  assert.equal(isPrivateOrBlockedHost(publicDns1, false), false);
  assert.equal(isPrivateOrBlockedHost(publicDns2, false), false);
  assert.equal(hasEmbeddedCredentials("https://user:pass@example.com/"), true);
  assert.equal(hasEmbeddedCredentials("https://example.com/"), false);
});

// ==============================================================================
// R11–R13: TAB NAVIGATION RACE CONDITION DEFENSE (LUC-SEC-041-03)
// ==============================================================================

test("R11: Rapid tab navigation before async verification completes discards stale verification state", async () => {
  const cfg: ExtensionConfig = {
    backendApiUrl: "http://127.0.0.1:8000",
    rpcUrl: "http://127.0.0.1:8545",
    maxResourceByteSize: 1024 * 1024,
    fetchTimeoutMs: 1000,
    observationDebounceMs: 50,
    allowLocalhost: true,
    autoVerify: true,
  };
  const engine = new VerifierEngine(cfg);
  const badgeController = new BadgeController();
  const router = new MessageRouter(engine, badgeController);
  const tabId = 201;

  // Start in-flight verification on Page A
  const verificationPromise = router.executeVerification(
    tabId,
    "https://legitimate-publisher.org/index.html",
    []
  );

  const session1 = router.getTabSession(tabId);
  assert.equal(session1, 1);

  // User rapidly navigates to another page before async verification finishes
  router.invalidateTabSession(tabId);
  const session2 = router.getTabSession(tabId);
  assert.equal(session2, 2);

  await verificationPromise;

  // Stale result was not saved because session was invalidated
  const saved = await getTabVerificationState(tabId);
  assert.equal(saved, undefined);
});

test("R12: Tab closed before async verification completes cleanly cleans up session without corruption", () => {
  const cfg: ExtensionConfig = {
    backendApiUrl: "http://127.0.0.1:8000",
    rpcUrl: "http://127.0.0.1:8545",
    maxResourceByteSize: 1024 * 1024,
    fetchTimeoutMs: 1000,
    observationDebounceMs: 50,
    allowLocalhost: true,
    autoVerify: true,
  };
  const engine = new VerifierEngine(cfg);
  const badgeController = new BadgeController();
  const router = new MessageRouter(engine, badgeController);
  const tabId = 202;

  router.invalidateTabSession(tabId);
  assert.equal(router.getTabSession(tabId), 1);

  // Tab closed
  router.removeTab(tabId);
  assert.equal(router.getTabSession(tabId), 0);
});

test("R13: Same-URL reload or navigation creates new monotonic session ID, rejecting previous session", () => {
  const cfg: ExtensionConfig = {
    backendApiUrl: "http://127.0.0.1:8000",
    rpcUrl: "http://127.0.0.1:8545",
    maxResourceByteSize: 1024 * 1024,
    fetchTimeoutMs: 1000,
    observationDebounceMs: 50,
    allowLocalhost: true,
    autoVerify: true,
  };
  const engine = new VerifierEngine(cfg);
  const badgeController = new BadgeController();
  const router = new MessageRouter(engine, badgeController);
  const tabId = 203;

  assert.equal(router.getTabSession(tabId), 0);
  router.invalidateTabSession(tabId);
  assert.equal(router.getTabSession(tabId), 1);
  router.invalidateTabSession(tabId);
  assert.equal(router.getTabSession(tabId), 2);
  router.invalidateTabSession(tabId);
  assert.equal(router.getTabSession(tabId), 3);
});

// ==============================================================================
// R14–R17: CHUNKED STREAMING SIZE LIMITS (LUC-SEC-041-04)
// ==============================================================================

test("R14: Chunked response exactly at maxByteSize succeeds with FETCHED", async () => {
  const exactSize = 512;
  const chunkedServer = http.createServer((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Transfer-Encoding": "chunked",
    });
    res.write("a".repeat(256));
    res.write("b".repeat(256));
    res.end();
  });
  await new Promise<void>((r) => chunkedServer.listen(0, "127.0.0.1", () => r()));
  const port = (chunkedServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true, maxByteSize: exactSize });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${port}/exact.js`,
      normalizedUrl: `http://127.0.0.1:${port}/exact.js`,
      path: "/exact.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const res = await fetcher.fetchAndDigestResource(script);
    assert.equal(res.status, "FETCHED");
    assert.equal(res.byteLength, exactSize);
  } finally {
    await new Promise<void>((r) => chunkedServer.close(() => r()));
  }
});

test("R15: Chunked response exceeding maxByteSize by 1 byte immediately cancels reader with OVERSIZE", async () => {
  const maxSize = 500;
  const chunkedServer = http.createServer((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Transfer-Encoding": "chunked",
    });
    res.write("a".repeat(501)); // Exceeds by 1 byte
    res.end();
  });
  await new Promise<void>((r) => chunkedServer.listen(0, "127.0.0.1", () => r()));
  const port = (chunkedServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true, maxByteSize: maxSize });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${port}/oversize.js`,
      normalizedUrl: `http://127.0.0.1:${port}/oversize.js`,
      path: "/oversize.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const res = await fetcher.fetchAndDigestResource(script);
    assert.equal(res.status, "OVERSIZE");
  } finally {
    await new Promise<void>((r) => chunkedServer.close(() => r()));
  }
});

test("R16: Chunked response without Content-Length cancels reader early before excessive buffering", async () => {
  let chunksEmitted = 0;
  const chunkCount = 20;
  const chunkSize = 200; // Total 4000 bytes

  const chunkedServer = http.createServer((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Transfer-Encoding": "chunked",
    });

    const pushChunk = (idx: number) => {
      if (res.writableEnded || res.destroyed) return;
      if (idx >= chunkCount) {
        res.end();
        return;
      }
      chunksEmitted++;
      res.write("x".repeat(chunkSize), () => {
        setTimeout(() => pushChunk(idx + 1), 10);
      });
    };
    pushChunk(0);
  });
  await new Promise<void>((r) => chunkedServer.listen(0, "127.0.0.1", () => r()));
  const port = (chunkedServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true, maxByteSize: 600 });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${port}/infinite.js`,
      normalizedUrl: `http://127.0.0.1:${port}/infinite.js`,
      path: "/infinite.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const res = await fetcher.fetchAndDigestResource(script);
    assert.equal(res.status, "OVERSIZE");
    assert.ok(chunksEmitted < chunkCount, `Stream aborted at chunk ${chunksEmitted} of ${chunkCount}`);
  } finally {
    await new Promise<void>((r) => chunkedServer.close(() => r()));
  }
});

test("R17: Slow/hanging chunk stream enforces fetchTimeoutMs aborting with FETCH_ERROR", async () => {
  const hangingServer = http.createServer((_req, _res) => {
    // Hangs forever
  });
  await new Promise<void>((r) => hangingServer.listen(0, "127.0.0.1", () => r()));
  const port = (hangingServer.address() as { port: number }).port;

  try {
    const fetcher = new ResourceFetcher({ allowLocalhost: true, timeoutMs: 150 });
    const script: DiscoveredScript = {
      rawUrl: `http://127.0.0.1:${port}/hang.js`,
      normalizedUrl: `http://127.0.0.1:${port}/hang.js`,
      path: "/hang.js",
      tagName: "SCRIPT",
      isInline: false,
      discoveredAt: Date.now(),
    };
    const start = Date.now();
    const res = await fetcher.fetchAndDigestResource(script);
    const duration = Date.now() - start;

    assert.equal(res.status, "FETCH_ERROR");
    assert.ok(res.errorMessage?.includes("timed out"));
    assert.ok(duration >= 130 && duration < 800);
  } finally {
    await new Promise<void>((r) => hangingServer.close(() => r()));
  }
});

// ==============================================================================
// R18–R20: ANVIL VERIFYING CONTRACT RESOLUTION (LUC-SEC-041-05)
// ==============================================================================

test("R18: Verifying contract resolves to SignatureVerifier (0xDc64...C9) on Anvil 31337 and succeeds", async () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const bundleCode = "console.log('anvil-verified-bundle');\n";
  const bundleHash = hashAndFormatResource(bundleCode);

  const now = Math.floor(Date.now() / 1000);
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "r18-contract.org",
    version: "1.0.0",
    createdAt: now - 30,
    expiresAt: now + 3600,
    resources: [
      {
        path: "/bundle.js",
        size: Buffer.byteLength(bundleCode),
        sha256: bundleHash,
        type: "script",
      },
    ],
  };

  const canonical = canonicalizeManifest(manifest);
  const manifestHash = hashManifest(canonical);

  const { signature } = await signReleaseManifestWithAccount({
    manifest,
    manifestHash,
    privateKey,
    chainId: 31337,
    verifyingContract: ANVIL_LOCAL_SIGNATURE_VERIFIER,
  });

  const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url === "/api/v1/domains/r18-contract.org/verification-status/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          domain: "r18-contract.org",
          registration_status: "REGISTERED_ONCHAIN",
          publisher_wallet: account.address,
          chain_id: 31337,
          contracts: {
            SignatureVerifier: ANVIL_LOCAL_SIGNATURE_VERIFIER,
          },
          latest_release: {
            sequence: 1,
            version: "1.0.0",
            manifestHash,
          },
        })
      );
    } else if (url === "/api/v1/domains/r18-contract.org/releases/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            id: 1,
            domain: "r18-contract.org",
            sequence: 1,
            version: "1.0.0",
            manifest_hash: manifestHash,
            signing_key: account.address,
            signature,
            manifest_json: manifest,
            attestation_uid: "0x0000000000000000000000000000000000000000000000000000000000000001",
          },
        ])
      );
    } else if (url === "/bundle.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(bundleCode);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;

  try {
    const engine = new VerifierEngine({
      backendApiUrl: `http://127.0.0.1:${port}`,
      rpcUrl: "http://127.0.0.1:8545",
      maxResourceByteSize: 1024 * 1024,
      fetchTimeoutMs: 3000,
      observationDebounceMs: 200,
      allowLocalhost: true,
      autoVerify: true,
    });

    const discovered: DiscoveredScript[] = [
      {
        rawUrl: `http://127.0.0.1:${port}/bundle.js`,
        normalizedUrl: `http://127.0.0.1:${port}/bundle.js`,
        path: "/bundle.js",
        tagName: "SCRIPT",
        isInline: false,
        discoveredAt: Date.now(),
      },
    ];

    const result = await engine.verifyTab(1, "http://r18-contract.org/", discovered);
    assert.equal(result.verificationState, "VERIFIED_RELEASE_MATCH");
    assert.equal(result.isRegisteredPublisher, true);
    assert.equal(result.publisherAddress?.toLowerCase(), account.address.toLowerCase());
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("R19: Release signed with wrong verifying contract fails EIP-712 recovery and returns UNREGISTERED_PUBLISHER", async () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const bundleCode = "console.log('wrong-contract-test');\n";
  const bundleHash = hashAndFormatResource(bundleCode);

  const now = Math.floor(Date.now() / 1000);
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "r19-wrong.org",
    version: "1.0.0",
    createdAt: now - 30,
    expiresAt: now + 3600,
    resources: [
      {
        path: "/bundle.js",
        size: Buffer.byteLength(bundleCode),
        sha256: bundleHash,
        type: "script",
      },
    ],
  };

  const canonical = canonicalizeManifest(manifest);
  const manifestHash = hashManifest(canonical);

  // Sign with an arbitrary wrong verifying contract
  const { signature } = await signReleaseManifestWithAccount({
    manifest,
    manifestHash,
    privateKey,
    chainId: 31337,
    verifyingContract: "0x9999999999999999999999999999999999999999",
  });

  const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url === "/api/v1/domains/r19-wrong.org/verification-status/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          domain: "r19-wrong.org",
          registration_status: "REGISTERED_ONCHAIN",
          publisher_wallet: account.address,
          chain_id: 31337,
          contracts: {
            SignatureVerifier: ANVIL_LOCAL_SIGNATURE_VERIFIER,
          },
        })
      );
    } else if (url === "/api/v1/domains/r19-wrong.org/releases/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            id: 1,
            domain: "r19-wrong.org",
            sequence: 1,
            version: "1.0.0",
            manifest_hash: manifestHash,
            signing_key: account.address,
            signature,
            manifest_json: manifest,
            attestation_uid: "0x0000000000000000000000000000000000000000000000000000000000000002",
          },
        ])
      );
    } else if (url === "/bundle.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(bundleCode);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;

  try {
    const engine = new VerifierEngine({
      backendApiUrl: `http://127.0.0.1:${port}`,
      rpcUrl: "http://127.0.0.1:8545",
      maxResourceByteSize: 1024 * 1024,
      fetchTimeoutMs: 3000,
      observationDebounceMs: 200,
      allowLocalhost: true,
      autoVerify: true,
    });

    const discovered: DiscoveredScript[] = [
      {
        rawUrl: `http://127.0.0.1:${port}/bundle.js`,
        normalizedUrl: `http://127.0.0.1:${port}/bundle.js`,
        path: "/bundle.js",
        tagName: "SCRIPT",
        isInline: false,
        discoveredAt: Date.now(),
      },
    ];

    const result = await engine.verifyTab(1, "http://r19-wrong.org/", discovered);
    // Because recovered signer does not match authorized publisher
    assert.equal(result.verificationState, "UNREGISTERED_PUBLISHER");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("R20: Release verification on non-local chain without contract address returns INDETERMINATE", async () => {
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url === "/api/v1/domains/r20-mainnet.org/verification-status/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          domain: "r20-mainnet.org",
          registration_status: "REGISTERED_ONCHAIN",
          publisher_wallet: "0x1111111111111111111111111111111111111111",
          chain_id: 1, // Mainnet without contracts supplied
        })
      );
    } else if (url === "/api/v1/domains/r20-mainnet.org/releases/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            id: 1,
            domain: "r20-mainnet.org",
            sequence: 1,
            version: "1.0.0",
            manifest_hash: "0x1234",
            signature: "0x5678",
            manifest_json: {
              schemaVersion: "LUCENTRA-Manifest-v0.1",
              domain: "r20-mainnet.org",
              version: "1.0.0",
              createdAt: 100,
              expiresAt: 200,
              resources: [],
            },
          },
        ])
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;

  try {
    const engine = new VerifierEngine({
      backendApiUrl: `http://127.0.0.1:${port}`,
      rpcUrl: "http://127.0.0.1:8545",
      maxResourceByteSize: 1024 * 1024,
      fetchTimeoutMs: 3000,
      observationDebounceMs: 200,
      allowLocalhost: false, // Disallow localhost fallback
      autoVerify: true,
    });

    const result = await engine.verifyTab(1, "http://r20-mainnet.org/", []);
    assert.equal(result.verificationState, "INDETERMINATE");
    assert.ok(result.summary.includes("Verifying contract address cannot be resolved"));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

// ==============================================================================
// R21–R22: INLINE SCRIPT CAUTION INDICATOR (LUC-SEC-041-06)
// ==============================================================================

test("R21: Page with inline scripts sets hasInlineScripts: true and records inlineScriptCount", async () => {
  const engine = new VerifierEngine({
    backendApiUrl: "http://127.0.0.1:8000",
    rpcUrl: "http://127.0.0.1:8545",
    maxResourceByteSize: 1024 * 1024,
    fetchTimeoutMs: 1000,
    observationDebounceMs: 200,
    allowLocalhost: true,
    autoVerify: true,
  });

  const discovered: DiscoveredScript[] = [
    {
      rawUrl: "inline",
      normalizedUrl: "inline",
      path: "",
      tagName: "SCRIPT",
      isInline: true,
      discoveredAt: Date.now(),
    },
    {
      rawUrl: "inline",
      normalizedUrl: "inline",
      path: "",
      tagName: "SCRIPT",
      isInline: true,
      discoveredAt: Date.now(),
    },
  ];

  const result = await engine.verifyTab(1, "chrome://settings", discovered);
  assert.equal(result.hasInlineScripts, true);
  assert.equal(result.inlineScriptCount, 2);
});

test("R22: Page without inline scripts sets hasInlineScripts: false and inlineScriptCount: 0", async () => {
  const engine = new VerifierEngine({
    backendApiUrl: "http://127.0.0.1:8000",
    rpcUrl: "http://127.0.0.1:8545",
    maxResourceByteSize: 1024 * 1024,
    fetchTimeoutMs: 1000,
    observationDebounceMs: 200,
    allowLocalhost: true,
    autoVerify: true,
  });

  const result = await engine.verifyTab(1, "chrome://settings", []);
  assert.equal(result.hasInlineScripts, false);
  assert.equal(result.inlineScriptCount, 0);
});

// ==============================================================================
// R23–R24: INCOMPLETE OBSERVATION & MISMATCH DETECTION
// ==============================================================================

test("R23: Partial observation (missing manifest script) strictly yields INDETERMINATE", async () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const bundleCode = "console.log('r23-bundle');\n";
  const bundleHash = hashAndFormatResource(bundleCode);

  const now = Math.floor(Date.now() / 1000);
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "r23-partial.org",
    version: "1.0.0",
    createdAt: now - 30,
    expiresAt: now + 3600,
    resources: [
      {
        path: "/app.js",
        size: Buffer.byteLength(bundleCode),
        sha256: bundleHash,
        type: "script",
      },
      {
        path: "/analytics.js", // Declared in manifest but NOT present in DOM
        size: 50,
        sha256: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        type: "script",
      },
    ],
  };

  const canonical = canonicalizeManifest(manifest);
  const manifestHash = hashManifest(canonical);

  const { signature } = await signReleaseManifestWithAccount({
    manifest,
    manifestHash,
    privateKey,
    chainId: 31337,
    verifyingContract: ANVIL_LOCAL_SIGNATURE_VERIFIER,
  });

  const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url === "/api/v1/domains/r23-partial.org/verification-status/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          domain: "r23-partial.org",
          registration_status: "REGISTERED_ONCHAIN",
          publisher_wallet: account.address,
          chain_id: 31337,
          contracts: {
            SignatureVerifier: ANVIL_LOCAL_SIGNATURE_VERIFIER,
          },
        })
      );
    } else if (url === "/api/v1/domains/r23-partial.org/releases/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            id: 1,
            domain: "r23-partial.org",
            sequence: 1,
            version: "1.0.0",
            manifest_hash: manifestHash,
            signing_key: account.address,
            signature,
            manifest_json: manifest,
            attestation_uid: "0x0000000000000000000000000000000000000000000000000000000000000003",
          },
        ])
      );
    } else if (url === "/app.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(bundleCode);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;

  try {
    const engine = new VerifierEngine({
      backendApiUrl: `http://127.0.0.1:${port}`,
      rpcUrl: "http://127.0.0.1:8545",
      maxResourceByteSize: 1024 * 1024,
      fetchTimeoutMs: 3000,
      observationDebounceMs: 200,
      allowLocalhost: true,
      autoVerify: true,
    });

    // Only /app.js is observed in DOM; /analytics.js is missing
    const discovered: DiscoveredScript[] = [
      {
        rawUrl: `http://127.0.0.1:${port}/app.js`,
        normalizedUrl: `http://127.0.0.1:${port}/app.js`,
        path: "/app.js",
        tagName: "SCRIPT",
        isInline: false,
        discoveredAt: Date.now(),
      },
    ];

    const result = await engine.verifyTab(1, "http://r23-partial.org/", discovered);
    // RELEASE COMPLETENESS INVARIANT: Partial observation must NEVER return VERIFIED_RELEASE_MATCH
    assert.equal(result.verificationState, "INDETERMINATE");
    assert.ok(result.unobservedManifestPaths.includes("/analytics.js"));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("R24: Altered resource byte digest strictly yields UNVERIFIED_RESOURCE_DETECTED", async () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const authenticCode = "console.log('authentic-code');\n";
  const tamperedCode = "console.log('tampered-code-malicious');\n";
  const authenticHash = hashAndFormatResource(authenticCode);

  const now = Math.floor(Date.now() / 1000);
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "r24-tamper.org",
    version: "1.0.0",
    createdAt: now - 30,
    expiresAt: now + 3600,
    resources: [
      {
        path: "/app.js",
        size: Buffer.byteLength(authenticCode),
        sha256: authenticHash,
        type: "script",
      },
    ],
  };

  const canonical = canonicalizeManifest(manifest);
  const manifestHash = hashManifest(canonical);

  const { signature } = await signReleaseManifestWithAccount({
    manifest,
    manifestHash,
    privateKey,
    chainId: 31337,
    verifyingContract: ANVIL_LOCAL_SIGNATURE_VERIFIER,
  });

  const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url === "/api/v1/domains/r24-tamper.org/verification-status/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          domain: "r24-tamper.org",
          registration_status: "REGISTERED_ONCHAIN",
          publisher_wallet: account.address,
          chain_id: 31337,
          contracts: {
            SignatureVerifier: ANVIL_LOCAL_SIGNATURE_VERIFIER,
          },
        })
      );
    } else if (url === "/api/v1/domains/r24-tamper.org/releases/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            id: 1,
            domain: "r24-tamper.org",
            sequence: 1,
            version: "1.0.0",
            manifest_hash: manifestHash,
            signing_key: account.address,
            signature,
            manifest_json: manifest,
            attestation_uid: "0x0000000000000000000000000000000000000000000000000000000000000004",
          },
        ])
      );
    } else if (url === "/app.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      // Serves tampered content!
      res.end(tamperedCode);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;

  try {
    const engine = new VerifierEngine({
      backendApiUrl: `http://127.0.0.1:${port}`,
      rpcUrl: "http://127.0.0.1:8545",
      maxResourceByteSize: 1024 * 1024,
      fetchTimeoutMs: 3000,
      observationDebounceMs: 200,
      allowLocalhost: true,
      autoVerify: true,
    });

    const discovered: DiscoveredScript[] = [
      {
        rawUrl: `http://127.0.0.1:${port}/app.js`,
        normalizedUrl: `http://127.0.0.1:${port}/app.js`,
        path: "/app.js",
        tagName: "SCRIPT",
        isInline: false,
        discoveredAt: Date.now(),
      },
    ];

    const result = await engine.verifyTab(1, "http://r24-tamper.org/", discovered);
    assert.equal(result.verificationState, "UNVERIFIED_RESOURCE_DETECTED");
    assert.ok(result.unverifiedObservedPaths.includes("/app.js"));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

/**
 * @file tests/verifier-engine.test.ts
 * @package @lucentra/extension
 * @description Unit tests for VerifierEngine workflow, state progression, and error recovery.
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
import { VerifierEngine } from "../src/services/verifier-engine.js";
import { type ExtensionConfig, ANVIL_LOCAL_SIGNATURE_VERIFIER } from "../src/types/config.js";
import type { DiscoveredScript } from "../src/types/resources.js";
import type { VerificationStage } from "../src/types/verification.js";

test("VerifierEngine: returns INDETERMINATE for non-web URL schemes", async () => {
  const cfg: ExtensionConfig = {
    backendApiUrl: "http://127.0.0.1:8000",
    rpcUrl: "http://127.0.0.1:8545",
    maxResourceByteSize: 5 * 1024 * 1024,
    fetchTimeoutMs: 5000,
    observationDebounceMs: 500,
    allowLocalhost: true,
    autoVerify: true,
  };

  const engine = new VerifierEngine(cfg);
  const state = await engine.verifyTab(1, "chrome://settings", []);
  assert.equal(state.verificationState, "INDETERMINATE");
  assert.equal(state.isRegisteredPublisher, false);
});

test("VerifierEngine: executes full verification against mock backend and web server", async () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const bundleCode = "console.log('production bundle');\n";
  const bundleHash = hashAndFormatResource(bundleCode);

  const now = Math.floor(Date.now() / 1000);
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "verifiable-service.org",
    version: "1.0.0",
    createdAt: now - 50,
    expiresAt: now + 3600,
    resources: [
      {
        path: "/app.js",
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

  // Mock Backend + Static Server
  const server = http.createServer((req, res) => {
    const url = req.url || "";

    if (url === "/api/v1/domains/verifiable-service.org/verification-status/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          domain: "verifiable-service.org",
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
    } else if (url === "/api/v1/domains/verifiable-service.org/releases/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            id: 1,
            domain: "verifiable-service.org",
            sequence: 1,
            version: "1.0.0",
            manifest_hash: manifestHash,
            signing_key: account.address,
            timestamp: now - 50,
            expires_at: now + 3600,
            signature,
            manifest_json: manifest,
            attestation_uid: "0x1234567890123456789012345678901234567890123456789012345678901234",
            status: "ATTESTED",
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

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;

  try {
    const cfg: ExtensionConfig = {
      backendApiUrl: `http://127.0.0.1:${port}`,
      rpcUrl: "http://127.0.0.1:8545",
      maxResourceByteSize: 5 * 1024 * 1024,
      fetchTimeoutMs: 5000,
      observationDebounceMs: 500,
      allowLocalhost: true,
      autoVerify: true,
    };

    const engine = new VerifierEngine(cfg);

    const stagesObserved: VerificationStage[] = [];
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

    const result = await engine.verifyTab(
      42,
      `http://verifiable-service.org/index.html`,
      discovered,
      (stage) => stagesObserved.push(stage)
    );

    assert.equal(result.verificationState, "VERIFIED_RELEASE_MATCH");
    assert.equal(result.isRegisteredPublisher, true);
    assert.equal(result.publisherAddress?.toLowerCase(), account.address.toLowerCase());
    assert.equal(result.details.length, 1);
    assert.equal(result.details[0].status, "MATCH");

    // Check that stage transitions occurred
    assert.ok(stagesObserved.includes("QUERYING_BACKEND"));
    assert.ok(stagesObserved.includes("FETCHING_AND_HASHING"));
    assert.ok(stagesObserved.includes("VERIFYING_CRYPTO"));
    assert.ok(stagesObserved.includes("COMPLETE"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

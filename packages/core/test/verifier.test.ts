/**
 * @file verifier.test.ts
 * @package @lucentra/core
 * @description Comprehensive test suite for verifyRelease() evaluating the 6 formal protocol states.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { canonicalizeManifest } from "../src/canonical.js";
import { hashAndFormatResource, hashManifest } from "../src/hash.js";
import { signReleaseManifestWithAccount } from "../src/signature.js";
import type { ReleaseManifest } from "../src/types.js";
import { verifyRelease, ZERO_ADDRESS } from "../src/verifier.js";

async function setupReleaseFixture() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const scriptPath = "/static/bundle.js";
  const scriptContent = 'console.log("Release v1.0.0");\n';
  const scriptHash = hashAndFormatResource(scriptContent);
  const scriptSize = Buffer.byteLength(scriptContent, "utf8");

  const now = 1700000000;
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "example.com",
    version: "1.0.0",
    createdAt: now,
    expiresAt: now + 86400, // 24 hours
    resources: [
      {
        path: scriptPath,
        size: scriptSize,
        sha256: scriptHash,
        type: "script",
      },
    ],
  };

  const canonicalJson = canonicalizeManifest(manifest);
  const manifestHash = hashManifest(canonicalJson);

  const { signature } = await signReleaseManifestWithAccount({
    manifest,
    manifestHash,
    privateKey,
  });

  return {
    privateKey,
    account,
    manifest,
    manifestHash,
    signature,
    scriptPath,
    scriptContent,
    scriptHash,
    scriptSize,
    now,
  };
}

test("verifyRelease: Authentic release results in VERIFIED_RELEASE_MATCH", async () => {
  const fixture = await setupReleaseFixture();

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      {
        path: fixture.scriptPath,
        bytes: fixture.scriptContent,
      },
    ],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.isValid, true);
  assert.equal(result.isSignerAuthorized, true);
  assert.equal(result.isSignatureValid, true);
  assert.equal(result.isExpired, false);
  assert.equal(result.isRevoked, false);
  assert.equal(result.resourceDetails[0]?.status, "MATCH");
  assert.equal(result.errors.length, 0);
});

test("verifyRelease: Single-byte resource modification triggers UNVERIFIED_RESOURCE_DETECTED", async () => {
  const fixture = await setupReleaseFixture();

  // Tamper with exactly 1 byte: "v1.0.0" -> "v1.0.1"
  const tamperedContent = fixture.scriptContent.replace("v1.0.0", "v1.0.1");

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      {
        path: fixture.scriptPath,
        bytes: tamperedContent,
      },
    ],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "UNVERIFIED_RESOURCE_DETECTED");
  assert.equal(result.isValid, false);
  assert.equal(result.resourceDetails[0]?.status, "MISMATCH");
  assert.ok(result.errors.some((e) => e.code === "RESOURCE_HASH_MISMATCH"));
});

test("verifyRelease: Unexpected external script triggers UNVERIFIED_RESOURCE_DETECTED", async () => {
  const fixture = await setupReleaseFixture();

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      {
        path: fixture.scriptPath,
        bytes: fixture.scriptContent,
      },
      {
        path: "/injected-malware.js",
        bytes: 'console.log("evil");',
      },
    ],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "UNVERIFIED_RESOURCE_DETECTED");
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === "UNEXPECTED_RESOURCE_DETECTED"));
});

test("verifyRelease: Zero address publisher triggers UNREGISTERED_PUBLISHER", async () => {
  const fixture = await setupReleaseFixture();

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: ZERO_ADDRESS,
    observedResources: [],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "UNREGISTERED_PUBLISHER");
  assert.equal(result.isValid, false);
});

test("verifyRelease: Expiration boundary check (exact vs 1s past)", async () => {
  const fixture = await setupReleaseFixture();

  // Boundary A: Exactly at expiresAt -> Valid
  const resultAtExpiry = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      {
        path: fixture.scriptPath,
        bytes: fixture.scriptContent,
      },
    ],
    evaluationTime: fixture.manifest.expiresAt,
  });
  assert.equal(resultAtExpiry.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(resultAtExpiry.isExpired, false);

  // Boundary B: Exactly 1 second past expiresAt -> Expired
  const resultPastExpiry = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      {
        path: fixture.scriptPath,
        bytes: fixture.scriptContent,
      },
    ],
    evaluationTime: fixture.manifest.expiresAt + 1,
  });
  assert.equal(resultPastExpiry.state, "UNATTESTED_RELEASE");
  assert.equal(resultPastExpiry.isExpired, true);
  assert.ok(resultPastExpiry.errors.some((e) => e.code === "RELEASE_EXPIRED"));
});

test("verifyRelease: Revoked release triggers REVOKED_RELEASE", async () => {
  const fixture = await setupReleaseFixture();

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      {
        path: fixture.scriptPath,
        bytes: fixture.scriptContent,
      },
    ],
    isRevoked: true,
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "REVOKED_RELEASE");
  assert.equal(result.isValid, false);
  assert.equal(result.isRevoked, true);
  assert.ok(result.errors.some((e) => e.code === "RELEASE_REVOKED"));
});

test("verifyRelease: Supports authorized signing key delegation", async () => {
  const primaryPublisherKey = generatePrivateKey();
  const primaryPublisher = privateKeyToAccount(primaryPublisherKey);

  const delegateKey = generatePrivateKey();
  const delegate = privateKeyToAccount(delegateKey);

  const scriptPath = "/app.js";
  const scriptContent = "console.log('hello');";
  const scriptHash = hashAndFormatResource(scriptContent);

  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "example.com",
    version: "1.0.0",
    createdAt: 1700000000,
    expiresAt: 1700086400,
    resources: [
      {
        path: scriptPath,
        size: Buffer.byteLength(scriptContent),
        sha256: scriptHash,
        type: "script",
      },
    ],
  };

  const canonicalJson = canonicalizeManifest(manifest);
  const manifestHash = hashManifest(canonicalJson);

  // Signed by delegate, NOT primary publisher directly
  const { signature } = await signReleaseManifestWithAccount({
    manifest,
    manifestHash,
    privateKey: delegateKey,
  });

  const result = await verifyRelease({
    manifest,
    signature,
    expectedPublisher: primaryPublisher.address,
    authorizedSigningKeys: [delegate.address],
    observedResources: [{ path: scriptPath, bytes: scriptContent }],
    evaluationTime: 1700000100,
  });

  assert.equal(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.isValid, true);
  assert.equal(result.isSignerAuthorized, true);
  assert.equal(result.recoveredSigner.toLowerCase(), delegate.address.toLowerCase());
});

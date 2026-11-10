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

test("verifyRelease: Missing observed resources prevents false verification (returns INDETERMINATE)", async () => {
  const fixture = await setupReleaseFixture();

  // Call verifyRelease without observed resources
  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [], // No resources observed
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "INDETERMINATE");
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === "MISSING_RESOURCE_DETECTED"));
});

test("verifyRelease: Release sequence rollback detection", async () => {
  const fixture = await setupReleaseFixture();

  // Evaluate a release where manifest createdAt (1700000000) is older than previous release (1700050000)
  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [{ path: fixture.scriptPath, bytes: fixture.scriptContent }],
    evaluationTime: fixture.now + 100,
    previousRelease: {
      version: "2.0.0",
      manifestHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      createdAt: fixture.now + 50000, // Newer than fixture.manifest.createdAt
    },
  });

  assert.equal(result.state, "UNATTESTED_RELEASE");
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === "RELEASE_SEQUENCE_ROLLBACK"));
});

test("verifyRelease: Broken previousManifestHash continuity detection", async () => {
  const fixture = await setupReleaseFixture();

  // Create manifest with declared previousManifestHash
  const manifestWithPrev: ReleaseManifest = {
    ...fixture.manifest,
    previousManifestHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
  };
  const canonical = canonicalizeManifest(manifestWithPrev);
  const hash = hashManifest(canonical);
  const { signature } = await signReleaseManifestWithAccount({
    manifest: manifestWithPrev,
    manifestHash: hash,
    privateKey: fixture.privateKey,
  });

  // Evaluate against different previousRelease manifestHash
  const result = await verifyRelease({
    manifest: manifestWithPrev,
    signature,
    expectedPublisher: fixture.account.address,
    observedResources: [{ path: fixture.scriptPath, bytes: fixture.scriptContent }],
    evaluationTime: fixture.now + 100,
    previousRelease: {
      version: "0.9.0",
      manifestHash: "0x9999999999999999999999999999999999999999999999999999999999999999", // Mismatch
      createdAt: fixture.now - 1000,
    },
  });

  assert.equal(result.state, "UNATTESTED_RELEASE");
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === "INVALID_PREVIOUS_MANIFEST_HASH"));
});

test("verifyRelease: Manifest tampering detection (altered version after signature)", async () => {
  const fixture = await setupReleaseFixture();

  // Tamper with manifest version after signature was made
  const tamperedManifest = {
    ...fixture.manifest,
    version: "1.0.1-tampered",
  };

  const result = await verifyRelease({
    manifest: tamperedManifest,
    signature: fixture.signature, // Signature signed original version
    expectedPublisher: fixture.account.address,
    observedResources: [{ path: fixture.scriptPath, bytes: fixture.scriptContent }],
    evaluationTime: fixture.now + 100,
  });

  // Signer recovered from tampered typed data will not match publisher
  assert.notEqual(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.isValid, false);
});

test("verifyRelease: Cross-chain replay rejection (chainId mismatch)", async () => {
  const fixture = await setupReleaseFixture();

  // Verify signature intended for Sepolia against Mainnet (chainId 1)
  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [{ path: fixture.scriptPath, bytes: fixture.scriptContent }],
    chainId: 1, // Mainnet
    evaluationTime: fixture.now + 100,
  });

  assert.notEqual(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.isValid, false);
  assert.equal(result.isSignerAuthorized, false);
});

test("verifyRelease: Cross-contract replay rejection (verifyingContract mismatch)", async () => {
  const fixture = await setupReleaseFixture();

  // Verify signature against a different contract deployment address
  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [{ path: fixture.scriptPath, bytes: fixture.scriptContent }],
    verifyingContract: "0x2222222222222222222222222222222222222222",
    evaluationTime: fixture.now + 100,
  });

  assert.notEqual(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.isValid, false);
  assert.equal(result.isSignerAuthorized, false);
});

test("verifyRelease: Unauthorized signing key rejection", async () => {
  const fixture = await setupReleaseFixture();
  const unapprovedKey = generatePrivateKey();

  // Sign with an unapproved private key
  const { signature: unauthorizedSig } = await signReleaseManifestWithAccount({
    manifest: fixture.manifest,
    manifestHash: fixture.manifestHash,
    privateKey: unapprovedKey,
  });

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: unauthorizedSig,
    expectedPublisher: fixture.account.address, // Expected publisher is fixture account
    observedResources: [{ path: fixture.scriptPath, bytes: fixture.scriptContent }],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "UNREGISTERED_PUBLISHER");
  assert.equal(result.isValid, false);
  assert.equal(result.isSignerAuthorized, false);
  assert.ok(result.errors.some((e) => e.code === "SIGNER_NOT_AUTHORIZED"));
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

// ============================================================================
// Complete Resource Verification Invariant Tests (5-Resource Test Suite)
// ============================================================================

async function setupFiveResourceFixture() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const scripts = [
    { path: "/static/js/main.js", content: "console.log('script 1: main');" },
    { path: "/static/js/vendor.js", content: "console.log('script 2: vendor');" },
    { path: "/static/js/runtime.js", content: "console.log('script 3: runtime');" },
    { path: "/static/js/chunk-a.js", content: "console.log('script 4: chunk-a');" },
    { path: "/static/js/chunk-b.js", content: "console.log('script 5: chunk-b');" },
  ];

  const resources = scripts.map((s) => ({
    path: s.path,
    size: Buffer.byteLength(s.content),
    sha256: hashAndFormatResource(s.content),
    type: "script" as const,
  }));

  const now = 1700000000;
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "example.com",
    version: "1.0.0",
    createdAt: now,
    expiresAt: now + 86400,
    resources,
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
    scripts,
    now,
  };
}

test("verifyRelease: 1 of 5 resources observed yields INDETERMINATE (incomplete observation)", async () => {
  const fixture = await setupFiveResourceFixture();

  // Only observe 1 of the 5 declared resources
  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      { path: fixture.scripts[0]!.path, bytes: fixture.scripts[0]!.content },
    ],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "INDETERMINATE");
  assert.equal(result.isValid, false);
  const missingCount = result.resourceDetails.filter((r) => r.status === "MISSING").length;
  assert.equal(missingCount, 4);
  assert.ok(result.errors.some((e) => e.code === "MISSING_RESOURCE_DETECTED"));
});

test("verifyRelease: 4 of 5 resources observed yields INDETERMINATE (missing 1 observation)", async () => {
  const fixture = await setupFiveResourceFixture();

  // Observe 4 of 5 resources
  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: fixture.scripts.slice(0, 4).map((s) => ({
      path: s.path,
      bytes: s.content,
    })),
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "INDETERMINATE");
  assert.equal(result.isValid, false);
  const missing = result.resourceDetails.find((r) => r.path === fixture.scripts[4]!.path);
  assert.equal(missing?.status, "MISSING");
  assert.ok(result.errors.some((e) => e.code === "MISSING_RESOURCE_DETECTED"));
});

test("verifyRelease: All 5 of 5 resources observed and matching yields VERIFIED_RELEASE_MATCH", async () => {
  const fixture = await setupFiveResourceFixture();

  // Observe all 5 matching resources
  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: fixture.scripts.map((s) => ({
      path: s.path,
      bytes: s.content,
    })),
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.isValid, true);
  assert.equal(result.resourceDetails.length, 5);
  assert.ok(result.resourceDetails.every((r) => r.status === "MATCH"));
  assert.equal(result.errors.length, 0);
});

test("verifyRelease: 1 of 5 resources mismatching yields UNVERIFIED_RESOURCE_DETECTED", async () => {
  const fixture = await setupFiveResourceFixture();

  // 4 matching, 1 tampered
  const observed = fixture.scripts.map((s, idx) => ({
    path: s.path,
    bytes: idx === 2 ? s.content + "\n// modified byte" : s.content,
  }));

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: observed,
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "UNVERIFIED_RESOURCE_DETECTED");
  assert.equal(result.isValid, false);
  const mismatch = result.resourceDetails.find((r) => r.path === fixture.scripts[2]!.path);
  assert.equal(mismatch?.status, "MISMATCH");
  assert.ok(result.errors.some((e) => e.code === "RESOURCE_HASH_MISMATCH"));
});

test("verifyRelease: 1 resource retrieval failure yields INDETERMINATE", async () => {
  const fixture = await setupFiveResourceFixture();

  // 4 successful observations, 1 failed retrieval
  const observed = [
    ...fixture.scripts.slice(0, 4).map((s) => ({
      path: s.path,
      bytes: s.content,
    })),
    {
      path: fixture.scripts[4]!.path,
      retrievalFailed: true,
      retrievalError: "HTTP 503 Service Unavailable",
    },
  ];

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: observed,
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "INDETERMINATE");
  assert.equal(result.isValid, false);
  const failed = result.resourceDetails.find((r) => r.path === fixture.scripts[4]!.path);
  assert.equal(failed?.status, "FAILED");
  assert.ok(result.errors.some((e) => e.code === "RESOURCE_RETRIEVAL_FAILED"));
});

test("verifyRelease: Unexpected additional external resource yields UNVERIFIED_RESOURCE_DETECTED", async () => {
  const fixture = await setupFiveResourceFixture();

  // 5 matching + 1 unexpected injected script
  const observed = [
    ...fixture.scripts.map((s) => ({ path: s.path, bytes: s.content })),
    { path: "/injected/unauthorized.js", bytes: "alert('injected');" },
  ];

  const result = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: observed,
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "UNVERIFIED_RESOURCE_DETECTED");
  assert.equal(result.isValid, false);
  const unexpected = result.resourceDetails.find((r) => r.path === "/injected/unauthorized.js");
  assert.equal(unexpected?.status, "UNEXPECTED");
  assert.ok(result.errors.some((e) => e.code === "UNEXPECTED_RESOURCE_DETECTED"));
});

test("verifyRelease: Duplicate observations handled safely (identical vs conflicting)", async () => {
  const fixture = await setupReleaseFixture();

  // Case A: Duplicate observation with identical digest -> deduplicated, VERIFIED_RELEASE_MATCH
  const resultA = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      { path: fixture.scriptPath, bytes: fixture.scriptContent },
      { path: fixture.scriptPath, bytes: fixture.scriptContent }, // Duplicate identical
    ],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(resultA.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(resultA.isValid, true);
  assert.ok(resultA.warnings.some((w) => w.includes("Duplicate observation")));

  // Case B: Duplicate observation with CONFLICTING digest -> UNVERIFIED_RESOURCE_DETECTED
  const resultB = await verifyRelease({
    manifest: fixture.manifest,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [
      { path: fixture.scriptPath, bytes: fixture.scriptContent },
      { path: fixture.scriptPath, bytes: fixture.scriptContent + "\n// conflicting" }, // Conflicting
    ],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(resultB.state, "UNVERIFIED_RESOURCE_DETECTED");
  assert.equal(resultB.isValid, false);
  assert.ok(resultB.errors.some((e) => e.code === "RESOURCE_HASH_MISMATCH"));
});

test("verifyRelease: Duplicate manifest entries rejected in schema check (INDETERMINATE)", async () => {
  const fixture = await setupReleaseFixture();

  const manifestWithDuplicatePaths = {
    ...fixture.manifest,
    resources: [
      fixture.manifest.resources[0]!,
      fixture.manifest.resources[0]!, // Duplicate path entry in manifest
    ],
  };

  const result = await verifyRelease({
    manifest: manifestWithDuplicatePaths,
    signature: fixture.signature,
    expectedPublisher: fixture.account.address,
    observedResources: [{ path: fixture.scriptPath, bytes: fixture.scriptContent }],
    evaluationTime: fixture.now + 100,
  });

  assert.equal(result.state, "INDETERMINATE");
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === "INVALID_MANIFEST_SCHEMA"));
});


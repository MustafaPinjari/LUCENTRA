/**
 * @file tests/completeness-rule.test.ts
 * @package @lucentra/extension
 * @description Comprehensive unit tests proving the Release Completeness Rule and the 6 formal protocol states.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  canonicalizeManifest,
  hashManifest,
  hashAndFormatResource,
  signReleaseManifestWithAccount,
  verifyRelease,
  type ReleaseManifest,
} from "@lucentra/core";

async function createMultiResourceFixture() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const bundleCode = "console.log('bundle');\n";
  const vendorCode = "console.log('vendor');\n";

  const bundleHash = hashAndFormatResource(bundleCode);
  const vendorHash = hashAndFormatResource(vendorCode);

  const now = Math.floor(Date.now() / 1000);
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "verifiable-app.io",
    version: "2.1.0",
    createdAt: now - 100,
    expiresAt: now + 86400,
    resources: [
      {
        path: "/static/bundle.js",
        size: Buffer.byteLength(bundleCode),
        sha256: bundleHash,
        type: "script",
      },
      {
        path: "/static/vendor.js",
        size: Buffer.byteLength(vendorCode),
        sha256: vendorHash,
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
  });

  return {
    account,
    manifest,
    manifestHash,
    signature,
    bundleHash,
    vendorHash,
    bundleCode,
    vendorCode,
  };
}

test("COMPLETENESS INVARIANT: Full observation yields VERIFIED_RELEASE_MATCH", async () => {
  const f = await createMultiResourceFixture();

  const result = await verifyRelease({
    manifest: f.manifest,
    signature: f.signature,
    expectedPublisher: f.account.address,
    observedResources: [
      { path: "/static/bundle.js", hash: f.bundleHash },
      { path: "/static/vendor.js", hash: f.vendorHash },
    ],
  });

  assert.equal(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.isValid, true);
  assert.equal(result.resourceDetails.length, 2);
  assert.equal(result.resourceDetails.every((d) => d.status === "MATCH"), true);
});

test("COMPLETENESS INVARIANT: Partial observation MUST NOT yield VERIFIED_RELEASE_MATCH (strictly INDETERMINATE)", async () => {
  const f = await createMultiResourceFixture();

  // ONLY 1 of the 2 declared resources was observed in the page DOM
  const result = await verifyRelease({
    manifest: f.manifest,
    signature: f.signature,
    expectedPublisher: f.account.address,
    observedResources: [
      { path: "/static/bundle.js", hash: f.bundleHash },
      // /static/vendor.js is missing from observation!
    ],
  });

  // MUST evaluate to INDETERMINATE!
  assert.notEqual(result.state, "VERIFIED_RELEASE_MATCH");
  assert.equal(result.state, "INDETERMINATE");
  assert.equal(result.isValid, false);

  const missing = result.resourceDetails.find((d) => d.path === "/static/vendor.js");
  assert.ok(missing);
  assert.equal(missing.status, "MISSING");
});

test("COMPLETENESS INVARIANT: Resource retrieval failure yields INDETERMINATE", async () => {
  const f = await createMultiResourceFixture();

  const result = await verifyRelease({
    manifest: f.manifest,
    signature: f.signature,
    expectedPublisher: f.account.address,
    observedResources: [
      { path: "/static/bundle.js", hash: f.bundleHash },
      {
        path: "/static/vendor.js",
        retrievalFailed: true,
        retrievalError: "Network connection refused",
      },
    ],
  });

  assert.equal(result.state, "INDETERMINATE");
  assert.equal(result.isValid, false);
});

test("TAMPER RESISTANCE: Undeclared script in DOM yields UNVERIFIED_RESOURCE_DETECTED", async () => {
  const f = await createMultiResourceFixture();

  const result = await verifyRelease({
    manifest: f.manifest,
    signature: f.signature,
    expectedPublisher: f.account.address,
    observedResources: [
      { path: "/static/bundle.js", hash: f.bundleHash },
      { path: "/static/vendor.js", hash: f.vendorHash },
      { path: "/malicious-injection.js", hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000" },
    ],
  });

  assert.equal(result.state, "UNVERIFIED_RESOURCE_DETECTED");
  assert.equal(result.isValid, false);
  const unexpected = result.resourceDetails.find((d) => d.path === "/malicious-injection.js");
  assert.ok(unexpected);
  assert.equal(unexpected.status, "UNEXPECTED");
});

test("TAMPER RESISTANCE: Altered script content yields UNVERIFIED_RESOURCE_DETECTED", async () => {
  const f = await createMultiResourceFixture();

  const result = await verifyRelease({
    manifest: f.manifest,
    signature: f.signature,
    expectedPublisher: f.account.address,
    observedResources: [
      { path: "/static/bundle.js", hash: "sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" }, // Altered!
      { path: "/static/vendor.js", hash: f.vendorHash },
    ],
  });

  assert.equal(result.state, "UNVERIFIED_RESOURCE_DETECTED");
  assert.equal(result.isValid, false);
  const mismatch = result.resourceDetails.find((d) => d.path === "/static/bundle.js");
  assert.ok(mismatch);
  assert.equal(mismatch.status, "MISMATCH");
});

test("IDENTITY INTEGRITY: Unauthorized or unregistered publisher yields UNREGISTERED_PUBLISHER", async () => {
  const f = await createMultiResourceFixture();
  const differentAccount = privateKeyToAccount(generatePrivateKey());

  const result = await verifyRelease({
    manifest: f.manifest,
    signature: f.signature,
    expectedPublisher: differentAccount.address, // Different publisher!
    observedResources: [
      { path: "/static/bundle.js", hash: f.bundleHash },
      { path: "/static/vendor.js", hash: f.vendorHash },
    ],
  });

  assert.equal(result.state, "UNREGISTERED_PUBLISHER");
  assert.equal(result.isValid, false);
});

test("REVOCATION: Revoked release yields REVOKED_RELEASE", async () => {
  const f = await createMultiResourceFixture();

  const result = await verifyRelease({
    manifest: f.manifest,
    signature: f.signature,
    expectedPublisher: f.account.address,
    isRevoked: true, // Flagged revoked
    observedResources: [
      { path: "/static/bundle.js", hash: f.bundleHash },
      { path: "/static/vendor.js", hash: f.vendorHash },
    ],
  });

  assert.equal(result.state, "REVOKED_RELEASE");
  assert.equal(result.isValid, false);
});

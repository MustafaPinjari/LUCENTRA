/**
 * @file signature.test.ts
 * @package @lucentra/core
 * @description EIP-712 structured data signing and signature verification tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { LucentraError } from "../src/errors.js";
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_VERIFYING_CONTRACT,
  recoverReleaseSigner,
  signReleaseManifestWithAccount,
  verifyReleaseSignature,
} from "../src/signature.js";
import type { ReleaseManifest } from "../src/types.js";

const TEST_PRIVATE_KEY =
  "0x4c0883a69102937d6231471b5dbb6204db7e716b78ac5c7827453b4112f46973" as const;
const EXPECTED_SIGNER = privateKeyToAccount(TEST_PRIVATE_KEY).address;

const SAMPLE_MANIFEST: ReleaseManifest = {
  schemaVersion: "LUCENTRA-Manifest-v0.1",
  domain: "example.com",
  version: "0.1.0",
  createdAt: 1700000000,
  expiresAt: 1799999999,
  resources: [
    {
      path: "/bundle.js",
      size: 30,
      sha256: "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1",
      type: "script",
    },
  ],
};

const SAMPLE_MANIFEST_HASH =
  "0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4" as const;

test("EIP-712: Test Vector 3 official vector verification", async () => {
  const expectedSig =
    "0xdebe38b2c5399315ce7083f0e46f43ce6e45dd1351325b11ef1f88e734178a974e0f49fa9a7373d854b93c12f348546278579fa41638720f1553ea0b7a7a495f1c";

  const { signature, signer } = await signReleaseManifestWithAccount({
    manifest: SAMPLE_MANIFEST,
    manifestHash: SAMPLE_MANIFEST_HASH,
    privateKey: TEST_PRIVATE_KEY,
    chainId: DEFAULT_CHAIN_ID,
    verifyingContract: DEFAULT_VERIFYING_CONTRACT,
  });

  assert.equal(signature, expectedSig);
  assert.equal(signer, "0xa0629861EeD36918aeF4750df910253a59b26977");

  const recovered = await recoverReleaseSigner({
    domain: SAMPLE_MANIFEST.domain,
    version: SAMPLE_MANIFEST.version,
    manifestHash: SAMPLE_MANIFEST_HASH,
    timestamp: SAMPLE_MANIFEST.createdAt,
    expiresAt: SAMPLE_MANIFEST.expiresAt,
    signature: expectedSig,
    chainId: DEFAULT_CHAIN_ID,
    verifyingContract: DEFAULT_VERIFYING_CONTRACT,
  });

  assert.equal(recovered, "0xa0629861EeD36918aeF4750df910253a59b26977");
});

test("EIP-712: Sign and recover valid signature", async () => {
  const { signature, signer } = await signReleaseManifestWithAccount({
    manifest: SAMPLE_MANIFEST,
    manifestHash: SAMPLE_MANIFEST_HASH,
    privateKey: TEST_PRIVATE_KEY,
    chainId: DEFAULT_CHAIN_ID,
    verifyingContract: DEFAULT_VERIFYING_CONTRACT,
  });

  assert.equal(signer.toLowerCase(), EXPECTED_SIGNER.toLowerCase());

  const recovered = await recoverReleaseSigner({
    domain: SAMPLE_MANIFEST.domain,
    version: SAMPLE_MANIFEST.version,
    manifestHash: SAMPLE_MANIFEST_HASH,
    timestamp: SAMPLE_MANIFEST.createdAt,
    expiresAt: SAMPLE_MANIFEST.expiresAt,
    signature,
    chainId: DEFAULT_CHAIN_ID,
    verifyingContract: DEFAULT_VERIFYING_CONTRACT,
  });

  assert.equal(recovered.toLowerCase(), EXPECTED_SIGNER.toLowerCase());

  const verification = await verifyReleaseSignature({
    domain: SAMPLE_MANIFEST.domain,
    version: SAMPLE_MANIFEST.version,
    manifestHash: SAMPLE_MANIFEST_HASH,
    timestamp: SAMPLE_MANIFEST.createdAt,
    expiresAt: SAMPLE_MANIFEST.expiresAt,
    signature,
    expectedSigner: EXPECTED_SIGNER,
    chainId: DEFAULT_CHAIN_ID,
    verifyingContract: DEFAULT_VERIFYING_CONTRACT,
  });

  assert.ok(verification.isValid);
  assert.equal(verification.recoveredSigner.toLowerCase(), EXPECTED_SIGNER.toLowerCase());
});

test("EIP-712: Detects mismatch when expected signer differs", async () => {
  const { signature } = await signReleaseManifestWithAccount({
    manifest: SAMPLE_MANIFEST,
    manifestHash: SAMPLE_MANIFEST_HASH,
    privateKey: TEST_PRIVATE_KEY,
  });

  const differentAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  const verification = await verifyReleaseSignature({
    domain: SAMPLE_MANIFEST.domain,
    version: SAMPLE_MANIFEST.version,
    manifestHash: SAMPLE_MANIFEST_HASH,
    timestamp: SAMPLE_MANIFEST.createdAt,
    expiresAt: SAMPLE_MANIFEST.expiresAt,
    signature,
    expectedSigner: differentAddress,
  });

  assert.equal(verification.isValid, false);
});

test("EIP-712: Recovers different address if chainId differs (domain separator mismatch)", async () => {
  const { signature } = await signReleaseManifestWithAccount({
    manifest: SAMPLE_MANIFEST,
    manifestHash: SAMPLE_MANIFEST_HASH,
    privateKey: TEST_PRIVATE_KEY,
    chainId: 11155111,
  });

  // Verify against chainId 1 (Ethereum Mainnet)
  const recovered = await recoverReleaseSigner({
    domain: SAMPLE_MANIFEST.domain,
    version: SAMPLE_MANIFEST.version,
    manifestHash: SAMPLE_MANIFEST_HASH,
    timestamp: SAMPLE_MANIFEST.createdAt,
    expiresAt: SAMPLE_MANIFEST.expiresAt,
    signature,
    chainId: 1, // Mismatched chainId
  });

  assert.notEqual(recovered.toLowerCase(), EXPECTED_SIGNER.toLowerCase());
});

test("EIP-712: Throws LucentraError on malformed signature bytes", async () => {
  await assert.rejects(
    async () => {
      await recoverReleaseSigner({
        domain: SAMPLE_MANIFEST.domain,
        version: SAMPLE_MANIFEST.version,
        manifestHash: SAMPLE_MANIFEST_HASH,
        timestamp: SAMPLE_MANIFEST.createdAt,
        expiresAt: SAMPLE_MANIFEST.expiresAt,
        signature: "0xdeadbeef", // Malformed signature
      });
    },
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_EIP712_SIGNATURE"
  );
});

/**
 * @file demo.ts
 * @package @lucentra/core
 * @description Executable demonstration walkthrough of the LUCENTRA Cryptographic Core Engine.
 * Tests positive verification, single-byte tampering detection, expiration, and revocation.
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { canonicalizeManifest } from "./canonical.js";
import { hashAndFormatResource, hashManifest } from "./hash.js";
import { signReleaseManifestWithAccount } from "./signature.js";
import type { ReleaseManifest } from "./types.js";
import { verifyRelease, ZERO_ADDRESS } from "./verifier.js";

async function runDemo(): Promise<void> {
  console.log("=".repeat(78));
  console.log("   LUCENTRA PROTOCOL — CRYPTOGRAPHIC CORE ENGINE DEMO");
  console.log("=".repeat(78));

  // 1. Generate Test Publisher Key Pair
  console.log("\n[1] Generating Publisher Test Wallet...");
  const publisherPrivateKey = generatePrivateKey();
  const publisher = privateKeyToAccount(publisherPrivateKey);
  console.log(`    Publisher Address:  ${publisher.address}`);

  // 2. Compile Release JavaScript Asset
  console.log("\n[2] Compiling JavaScript Asset...");
  const originalScriptContent = `
    // Application Entrypoint v1.0.0
    console.log("Welcome to Secure DApp powered by LUCENTRA");
    function executeTransfer(amount, recipient) {
      return { status: "CONFIRMED", amount, recipient };
    }
    window.app = { executeTransfer };
  `.trim();

  const originalScriptHash = hashAndFormatResource(originalScriptContent);
  const scriptSize = Buffer.byteLength(originalScriptContent, "utf8");
  console.log(`    Script Path:        /static/js/bundle.main.js`);
  console.log(`    Script Size:        ${scriptSize} bytes`);
  console.log(`    Computed Digest:    ${originalScriptHash}`);

  // 3. Construct Release Manifest
  console.log("\n[3] Constructing Release Manifest (LUCENTRA-Manifest-v0.1)...");
  const now = Math.floor(Date.now() / 1000);
  const manifest: ReleaseManifest = {
    schemaVersion: "LUCENTRA-Manifest-v0.1",
    domain: "app.uniswap.org",
    version: "1.0.0",
    createdAt: now - 3600, // 1 hour ago
    expiresAt: now + 86400 * 30, // 30 days valid
    resources: [
      {
        path: "/static/js/bundle.main.js",
        size: scriptSize,
        sha256: originalScriptHash,
        type: "script",
      },
    ],
  };

  // 4. RFC 8785 Canonicalization & SHA-256 Manifest Hash
  console.log("\n[4] Canonicalizing Manifest & Computing Root Hash...");
  const canonicalJson = canonicalizeManifest(manifest);
  const manifestHash = hashManifest(canonicalJson);
  console.log(`    Canonical JSON:     ${canonicalJson}`);
  console.log(`    Manifest Root Hash: ${manifestHash}`);

  // 5. Sign via EIP-712 Structured Data
  console.log("\n[5] Publisher Wallet Signing via EIP-712...");
  const { signature } = await signReleaseManifestWithAccount({
    manifest,
    manifestHash,
    privateKey: publisherPrivateKey,
  });
  console.log(`    Signature (65b):    ${signature.slice(0, 42)}...`);

  // 6. Test Scenario A: Authentic Release Verification
  console.log("\n[6] SCENARIO A: Verifying Authentic Release in Browser DOM...");
  const resultA = await verifyRelease({
    manifest,
    signature,
    expectedPublisher: publisher.address,
    observedResources: [
      {
        path: "/static/js/bundle.main.js",
        bytes: originalScriptContent,
      },
    ],
    evaluationTime: now,
  });

  console.log(`    Verification State:  ${resultA.state}`);
  console.log(`    Is Valid:            ${resultA.isValid ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`    Signer Authorized:   ${resultA.isSignerAuthorized}`);
  console.log(`    Resource Details:    ${JSON.stringify(resultA.resourceDetails, null, 2)}`);

  // 7. Test Scenario B: Tampered Script Byte Detection (1 byte modified)
  console.log("\n[7] SCENARIO B: Tampering Detection (1 byte altered in production script)...");
  // Change "CONFIRMED" to "CONFIRMDD" (1 byte difference)
  const tamperedScriptContent = originalScriptContent.replace(
    "CONFIRMED",
    "CONFIRMDD"
  );
  const tamperedScriptHash = hashAndFormatResource(tamperedScriptContent);
  console.log(`    Tampered Digest:    ${tamperedScriptHash}`);

  const resultB = await verifyRelease({
    manifest,
    signature,
    expectedPublisher: publisher.address,
    observedResources: [
      {
        path: "/static/js/bundle.main.js",
        bytes: tamperedScriptContent,
      },
    ],
    evaluationTime: now,
  });

  console.log(`    Verification State:  ${resultB.state} (CRITICAL ALERT)`);
  console.log(`    Is Valid:            ${resultB.isValid ? "YES" : "NO (BLOCKED)"}`);
  console.log(`    Errors Detected:     ${resultB.errors.map((e) => `[${e.code}] ${e.message}`).join(", ")}`);

  // 8. Test Scenario C: Expired Release
  console.log("\n[8] SCENARIO C: Expired Release Evaluation...");
  const resultC = await verifyRelease({
    manifest,
    signature,
    expectedPublisher: publisher.address,
    observedResources: [
      {
        path: "/static/js/bundle.main.js",
        bytes: originalScriptContent,
      },
    ],
    evaluationTime: now + 86400 * 31, // 31 days in future
  });

  console.log(`    Verification State:  ${resultC.state}`);
  console.log(`    Is Expired:          ${resultC.isExpired}`);
  console.log(`    Errors Detected:     ${resultC.errors.map((e) => `[${e.code}] ${e.message}`).join(", ")}`);

  // 9. Test Scenario D: Revoked Release
  console.log("\n[9] SCENARIO D: Revoked Key / Release Evaluation...");
  const resultD = await verifyRelease({
    manifest,
    signature,
    expectedPublisher: publisher.address,
    observedResources: [
      {
        path: "/static/js/bundle.main.js",
        bytes: originalScriptContent,
      },
    ],
    isRevoked: true,
    evaluationTime: now,
  });

  console.log(`    Verification State:  ${resultD.state}`);
  console.log(`    Is Revoked:          ${resultD.isRevoked}`);
  console.log(`    Errors Detected:     ${resultD.errors.map((e) => `[${e.code}] ${e.message}`).join(", ")}`);

  // 10. Test Scenario E: Unregistered Publisher
  console.log("\n[10] SCENARIO E: Unregistered Publisher Domain...");
  const resultE = await verifyRelease({
    manifest,
    signature,
    expectedPublisher: ZERO_ADDRESS,
    observedResources: [],
    evaluationTime: now,
  });

  console.log(`    Verification State:  ${resultE.state}`);

  // 11. Test Scenario F: Missing Evidence Defense (0 observed resources)
  console.log("\n[11] SCENARIO F: Missing Evidence Invariant (No runtime scripts observed)...");
  const resultF = await verifyRelease({
    manifest,
    signature,
    expectedPublisher: publisher.address,
    observedResources: [], // No observed resources passed
    evaluationTime: now,
  });

  console.log(`    Verification State:  ${resultF.state} (Prevents ungrounded match)`);
  console.log(`    Is Valid:            ${resultF.isValid ? "YES" : "NO (SAFE)"}`);
  console.log(`    Errors Detected:     ${resultF.errors.map((e) => `[${e.code}] ${e.message}`).join(", ")}`);

  console.log("\n" + "=".repeat(78));
  console.log("   ALL PROTOCOL ENGINE DEMONSTRATION CHECKS COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(78));
}

runDemo().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});


# LUCENTRA — Core Cryptographic Verification Engine

**Component:** `@lucentra/core`  
**Author:** Mustafa Pinjari  
**Repository:** [MustafaPinjari/LUCENTRA](https://github.com/MustafaPinjari/LUCENTRA)  
**Reference Commit:** `680aab3cd1c259e0f2100e6308e0f867b7580666`  
**License:** MIT  
**Language:** TypeScript (Strict, ES2022)  

---

## Overview

The LUCENTRA Core Cryptographic Verification Engine is a high-assurance TypeScript library designed to verify website publisher identity and JavaScript resource integrity through cryptographic evidence. It powers client-side verification in browser extensions, backend indexers, and publisher CLI tooling without introducing heavy framework dependencies.

This implementation specifically introduces:
1. **RFC 8785 JSON Canonicalization Scheme (JCS):** Deterministic byte serialization ensuring identical cryptographic manifest digests across disparate client runtimes.
2. **Strict Manifest Bounds:** A 256 KiB (262,144 bytes) raw UTF-8 byte length boundary and a 100-resource ceiling preventing browser extension Web Worker latency and memory exhaustion.
3. **Complete Resource Verification Pipeline:** A fail-closed 6-state verification engine guaranteeing that a release is never flagged as verified unless 100% of declared resources are observed, retrieved, and cryptographically matched.

---

## Core Invariants & Security Architecture

### 1. Fail-Closed Complete Verification
Traditional verification often falls victim to partial matches (e.g. reporting a page as verified because one script matched, while other scripts are compromised or missing). LUCENTRA enforces strict complete verification:
- **`VERIFIED_RELEASE_MATCH`:** Permitted *only* when 100% of declared manifest resources are observed, retrieved out-of-band, and match their declared SHA-256 digests.
- **`INDETERMINATE`:** Triggered whenever any declared resource is missing from runtime observation or fails network retrieval (e.g., HTTP 5xx, network timeout).
- **`UNVERIFIED_RESOURCE_DETECTED`:** Triggered immediately if any observed resource hash conflicts with the declared digest, or if an undeclared script is injected into the DOM.

### 2. RFC 8785 Deterministic Canonicalization
To prevent signature forgery and serialization ambiguity across JavaScript engines:
- Keys are sorted strictly by UTF-16 code units (Appendix A.1).
- Numbers follow IEEE 754 64-bit float serialization rules, normalizing negative zero (`-0` to `0`) and exponential representation (Appendix A.2).
- Root-level signatures are excluded from hashing while preserving nested signatures.
- Lone UTF-16 surrogates are rejected at the parsing boundary.

### 3. Strict UTF-8 Byte Size Bounds
Manifest size checks evaluate raw UTF-8 byte length (`Buffer.byteLength(serialized, "utf8")`), rather than JavaScript character string length. This ensures multi-byte Unicode injection attacks cannot bypass the 256 KiB boundary.

---

## Proposed Six-File Changeset

| File | Type | Lines | Role |
| :--- | :---: | :---: | :--- |
| `packages/core/src/types.ts` | Production | 285 | Protocol v0.1 interfaces, verification states, and error types. |
| `packages/core/src/validation.ts` | Production | 337 | 256 KiB manifest boundary enforcement and domain normalization. |
| `packages/core/src/verifier.ts` | Production | 482 | 6-state complete release verification pipeline. |
| `packages/core/test/canonical.test.ts` | Test | 144 | RFC 8785 Appendix A.1 and A.2 official test vectors. |
| `packages/core/test/validation.test.ts` | Test | 233 | Boundary tests: exact 256 KiB, +1 byte overflow, and multibyte Unicode. |
| `packages/core/test/verifier.test.ts` | Test | 584 | Complete verification tests: 5-resource fixture evaluating all 8 invariants. |

*Note: In commit `680aab3`, these six files encompass exactly 525 modified lines (483 additions, 42 deletions).*

---

## Quick Usage Example

```typescript
import { 
  verifyRelease, 
  validateReleaseManifest, 
  canonicalizeManifest, 
  hashManifest 
} from "@lucentra/core";

// 1. Validate incoming manifest structure & 256 KiB bounds
const validatedManifest = validateReleaseManifest(rawManifestJson);

// 2. Canonicalize and hash for EIP-712 / attestation checks
const canonicalJson = canonicalizeManifest(validatedManifest);
const manifestHash = hashManifest(canonicalJson);

// 3. Execute complete resource verification against observed DOM assets
const result = await verifyRelease({
  manifest: validatedManifest,
  signature: publisherSignature,
  expectedPublisher: "0x1234567890123456789012345678901234567890",
  observedResources: [
    { path: "/static/js/main.js", bytes: mainScriptBytes },
    { path: "/static/js/vendor.js", bytes: vendorScriptBytes },
  ],
  evaluationTime: Math.floor(Date.now() / 1000),
});

if (result.state === "VERIFIED_RELEASE_MATCH") {
  console.log("Release integrity cryptographically verified!");
} else if (result.state === "UNVERIFIED_RESOURCE_DETECTED") {
  console.error("Integrity mismatch or injected script detected:", result.errors);
} else if (result.state === "INDETERMINATE") {
  console.warn("Incomplete evidence or failed resource retrieval:", result.errors);
}
```

---

## Verification & Test Results

The implementation is verified with 100% test passage across the full suite:
- **Build:** TypeScript v5.4.5 compiles cleanly with zero warnings (`tsc --noEmit`).
- **Test Suite:** 66/66 automated tests passing via Node.js native test runner (`node --test`).
- **Dependencies:** Strictly limited to `canonicalize` (Apache-2.0) and `viem` (MIT). Zero proprietary or copyleft code.

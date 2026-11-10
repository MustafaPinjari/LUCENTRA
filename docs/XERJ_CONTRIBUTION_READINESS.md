# LUCENTRA — XERJ Contribution Readiness Audit Report

**Document ID:** LUC-AUD-004  
**Version:** 1.0.0  
**Status:** PROPOSED (Awaiting Human Sign-off & Ivan Confirmation)  
**Target Repository:** `MustafaPinjari/LUCENTRA`  
**Target Subsystem:** `packages/core`  
**Target Commit:** `680aab3cd1c259e0f2100e6308e0f867b7580666`  
**Date:** 2026-11-10  

---

## 1. Executive Summary & Project Overview

LUCENTRA is an open-source, independent verification layer for the internet that enables users and applications to verify website publisher identity and JavaScript resource integrity through cryptographic evidence (RFC 8785 JSON Canonicalization, SHA-256 resource digests, EIP-712 structured data signing, and Ethereum Attestation Service on-chain attestations).

The founder of XERJ contacted the project author regarding indexing a specific TypeScript implementation from `MustafaPinjari/LUCENTRA` in XERJ's public Corpus Hub with formal attribution. The implementation is described as:
- Six files.
- Approximately 520 lines of code.
- Located in `packages/core`.
- Written in TypeScript.
- Focused on complete resource verification, RFC 8785 canonicalization, and the 256 KiB manifest size boundary.

This audit establishes:
1. The exact commit and file list matching XERJ's description.
2. Full open-source licensing compliance under the MIT License.
3. Complete security and privacy audit clearing the files of any credentials or private data.
4. Reproducible test execution with 100% passing automated tests.
5. Governance guidelines ensuring no unapproved external sharing or modifications occur.

---

## 2. Implementation Identification & Candidate Selection

### 2.1 Commit Identification

An inspection of the Git history of `packages/core` isolated the exact commit introducing this focused changeset:

- **Commit SHA:** `680aab3cd1c259e0f2100e6308e0f867b7580666` (short: `680aab3`)
- **Author:** `MustafaPinjari <unlessuser99@gmail.com>`
- **Date:** `Tue Nov 10 09:27:22 2026 +0530`
- **Commit Message:** `fix(core): complete resource verification, 256kb manifest size boundary, and rfc8785 test vectors`
- **Files Touched in `packages/core`:** Exactly 6 files.
- **Diff Metrics in `packages/core`:** 483 insertions, 42 deletions across 6 files (total 525 modified lines, aligning with the reported "~520 lines").

### 2.2 Candidate Comparison Matrix

To avoid assuming Ivan's exact indexing structure, we define two candidate models:

* **Candidate Set A (Changeset / Diff Candidate):** The exact 6 files modified in commit `680aab3`, representing the 525 lines of specialized logic for complete resource verification, RFC 8785 test vectors, and the 256 KiB boundary.
* **Candidate Set B (Full Source Files Candidate):** The full standalone source files in `packages/core/src/` implementing these capabilities (1,369 total lines across 6 files).

| Candidate Set | Scope | File Count | Line Count | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Set A (Primary)** | Commit `680aab3` diff | 6 files | 525 lines diff | **PROPOSED** | Exact match for "~520 lines, 6 files, packages/core". |
| **Set B (Alternative)** | Full source files | 6 files | 1,369 lines | **PROPOSED** | Standalone production modules (`types`, `validation`, `verifier`, `canonical`, `hash`, `errors`). |

---

## 3. Primary Proposed Six-File List (Candidate Set A)

> [!IMPORTANT]
> **GOVERNANCE STATUS: PROPOSED.** This six-file list is identified as the exact match for XERJ's inquiry based on commit `680aab3`. It is formally labeled as *Proposed* until Ivan confirms whether XERJ indexes the commit diff or full standalone source files.

| # | File Path | Code Type | File Lines | Commit Diff (+/-) | Purpose | Relevance to XERJ Inquiry |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- |
| 1 | `packages/core/src/types.ts` | Production | 285 | +4 / -1 | Protocol v0.1 type definitions and error taxonomy | Introduces `RESOURCE_RETRIEVAL_FAILED` error code, `FAILED` observation state, and retrieval error tracking. |
| 2 | `packages/core/src/validation.ts` | Production | 337 | +11 / -3 | Manifest schema validation and bounds | Enforces the strict UTF-8 256 KiB (`MAX_MANIFEST_BYTE_SIZE = 256 * 1024`) size boundary and 100-resource cap. |
| 3 | `packages/core/src/verifier.ts` | Production | 482 | +128 / -35 | Release verification pipeline | Enforces complete resource verification invariants; missing/failed observations produce `INDETERMINATE`; mismatches produce `UNVERIFIED_RESOURCE_DETECTED`. |
| 4 | `packages/core/test/canonical.test.ts` | Test Suite | 144 | +28 / -0 | RFC 8785 JCS test vectors | Validates official RFC 8785 Appendix A.1 (UTF-16 key sorting) and Appendix A.2 (number serialization) test vectors. |
| 5 | `packages/core/test/validation.test.ts` | Test Suite | 233 | +59 / -0 | Boundary condition tests | Tests exact 256 KiB (262,144 bytes) boundary, 1 byte over (262,145 bytes), and multibyte Unicode boundary overflow. |
| 6 | `packages/core/test/verifier.test.ts` | Test Suite | 584 | +256 / -0 | Complete verification tests | 5-resource fixture test suite validating all 8 complete verification invariants (partial observations, mismatches, failed fetch). |
| **Total** | **6 Files** | **3 Prod / 3 Test** | **2,065** | **+483 / -42 (525 lines)** | **Cryptographic Core Engine** | **Exact match for XERJ criteria** |

---

## 4. Detailed Technical Description of Proposed Files

### 4.1 `packages/core/src/types.ts`
Formalizes the core protocol data models:
- Defines `ReleaseManifest`, `ReleaseResource`, and `VerificationResult`.
- Expands `VerificationErrorCode` with `RESOURCE_RETRIEVAL_FAILED`.
- Enhances `ResourceVerificationDetail` with the `FAILED` state to distinguish network retrieval failures from missing DOM observations.
- Expands `ObservedResource` with `retrievalFailed: boolean` and `retrievalError?: string`.

### 4.2 `packages/core/src/validation.ts`
Provides zero-dependency runtime schema validation:
- Exports `MAX_MANIFEST_BYTE_SIZE = 256 * 1024` (262,144 bytes).
- Enforces strict UTF-8 byte length verification (`Buffer.byteLength(serialized, "utf8")`), preventing Unicode character-counting bypasses.
- Enforces `MAX_MANIFEST_RESOURCE_COUNT = 100` to prevent Web Worker memory exhaustion.
- Enforces domain UTS #46 canonicalization and resource path traversal rejection (`../`, `.\`).

### 4.3 `packages/core/src/verifier.ts`
Implements the 6-state release verification engine:
- Evaluates the 6 formal protocol states: `VERIFIED_RELEASE_MATCH`, `UNVERIFIED_RESOURCE_DETECTED`, `UNREGISTERED_PUBLISHER`, `UNATTESTED_RELEASE`, `REVOKED_RELEASE`, and `INDETERMINATE`.
- Enforces the **Complete Verification Invariant**: A release cannot be verified merely because a subset of scripts match. 100% of declared manifest resources must be observed and matched.
- Any missing resource or failed retrieval immediately transitions evaluation to `INDETERMINATE`.
- Any observed hash mismatch or unexpected runtime injection transitions evaluation to `UNVERIFIED_RESOURCE_DETECTED`.

### 4.4 `packages/core/test/canonical.test.ts`
Tests the RFC 8785 JSON Canonicalization Scheme:
- Implements official RFC 8785 Appendix A.1 test vector (sorting UTF-16 code units: `"01"` < `"1"` < `"10"`).
- Implements official RFC 8785 Appendix A.2 test vector (number serialization, IEEE 754 exponents, negative zero `-0` normalized to `0`).
- Validates exclusion of root-level `signature` while preserving nested signatures.

### 4.5 `packages/core/test/validation.test.ts`
Tests manifest validation boundary constraints:
- Tests manifest size exactly at 262,144 bytes (passes).
- Tests manifest size at 262,145 bytes (throws `MANIFEST_SIZE_EXCEEDED`).
- Tests multibyte Unicode characters (e.g. 4-byte emojis) where character length does not equal byte length.
- Tests resource count limit (100 passes, 101 throws `RESOURCE_COUNT_EXCEEDED`).

### 4.6 `packages/core/test/verifier.test.ts`
Validates end-to-end verification logic with a synthetic 5-resource fixture:
- 1 of 5 resources observed: yields `INDETERMINATE`.
- 4 of 5 resources observed: yields `INDETERMINATE`.
- 5 of 5 resources observed and matching: yields `VERIFIED_RELEASE_MATCH`.
- 1 of 5 resources mismatching: yields `UNVERIFIED_RESOURCE_DETECTED`.
- 1 resource retrieval failed: yields `INDETERMINATE`.
- Unexpected additional resource: yields `UNVERIFIED_RESOURCE_DETECTED`.
- Duplicate observations (identical vs conflicting digests) handled deterministically.

---

## 5. Open-Source Licensing Audit

| Level | License | Copyright Notice | Distribution Permissions |
| :--- | :--- | :--- | :--- |
| **Repository Root** | MIT License | `Copyright (c) 2026 LUCENTRA Contributors` | Fully permissive for commercial and non-commercial redistribution with attribution. |
| **Package (`packages/core`)** | Inherits MIT | `Copyright (c) 2026 LUCENTRA Contributors` | Same. |
| **Dependency: `canonicalize`** | Apache-2.0 | Anders Rundgren | Permissive; compatible with outbound MIT redistribution. |
| **Dependency: `viem`** | MIT | weth, awkweb | Permissive; fully compatible with outbound MIT redistribution. |
| **DevDependency: `typescript`** | Apache-2.0 | Microsoft Corporation | Build-time tool only; not bundled into distribution. |

### Licensing Findings:
1. All six files were authored directly for the LUCENTRA project under the root MIT License.
2. No third-party code with copyleft restrictions (GPL, AGPL, LGPL, or CC-BY-NC) is used in `packages/core`.
3. The proposed files **can be freely distributed and indexed** under the MIT License with proper attribution to `MustafaPinjari/LUCENTRA`.

---

## 6. Security and Privacy Audit

An automated static analysis and manual audit of the proposed files was executed:

| Security Check | Method | Findings | Risk Level |
| :--- | :--- | :--- | :--- |
| **API Keys & Secrets** | Regex pattern match `(API_KEY\|SECRET\|TOKEN\|BEARER)` | No production secrets found. Only documentation comments and unit test path checks (`/static/../secret.js`) matched. | **CLEARED (None)** |
| **Private Keys & Wallets** | Regex search for 64-character hex strings & private key headers | No production private keys found. Only deterministic, well-known test keys from RFC 6979 / Hardhat test vectors used in unit tests. | **CLEARED (None)** |
| **Personally Identifiable Info (PII)** | Regex search for email addresses, names, and phone numbers | No author email or PII present in source or test files. | **CLEARED (None)** |
| **Internal URLs & IPs** | Regex search for `https?://`, `localhost`, `127.0.0.1` | No internal infrastructure URLs. Only standard test domain strings (`example.com`, `app.uniswap.org`) and domain validator rules. | **CLEARED (None)** |
| **File System Paths** | Regex search for local paths (`C:\`, `/home/`, `/Users/`) | No local file system paths hardcoded in source or test files. | **CLEARED (None)** |
| **Proprietary Dependencies** | `package.json` inspection | Only public open-source libraries (`canonicalize`, `viem`) utilized. | **CLEARED (None)** |

---

## 7. Reproducibility & Test Execution

All build and test suites were executed natively on the actual codebase.

### 7.1 TypeScript Build & Typecheck
- **Command:** `npm.cmd --prefix packages/core run build`
- **Exit Code:** `0`
- **Output:** Clean compilation via `tsc` to `dist/`.
- **Command:** `npm.cmd --prefix packages/core run typecheck`
- **Exit Code:** `0`
- **Output:** Clean static analysis via `tsc --noEmit`.

### 7.2 Core Test Execution Results

Executed with Node.js v20 native test runner (`node --test`):

```
✔ RFC 8785: Official Appendix A.1 key sorting test vector (3.0392ms)
✔ RFC 8785: Official Appendix A.2 number serialization test vectors (0.3227ms)
✔ RFC 8785: Object key sorting by UTF-16 code units (0.6128ms)
✔ RFC 8785: Nested objects key sorting (0.3294ms)
✔ RFC 8785: Array preservation and ordering (0.8204ms)
✔ RFC 8785: Exclusion of signature field (0.7576ms)
✔ RFC 8785: Handling of negative zero (-0) per ES6 (0.3426ms)
✔ RFC 8785: Rejection of non-finite numbers (NaN, Infinity) (1.353ms)
✔ RFC 8785: Rejection of lone surrogates (ill-formed UTF-16) (0.6808ms)
✔ RFC 8785: Root-level signature exclusion vs nested signature preservation (0.5784ms)
✔ RFC 8785: Standard escape sequences and whitespace elimination (0.3048ms)
✔ RFC 8785: Unicode string handling and whitespace elimination (0.4443ms)
✔ RFC 8785: Deterministic repeated serialization (0.3923ms)
✔ hashResourceBytes: Official FIPS 180-4 standard test vectors (3.8715ms)
✔ hashResourceBytes: Handles large 2 MiB binary input correctly (33.8234ms)
✔ hashResourceBytes: Computes correct SHA-256 for string (0.2747ms)
✔ hashResourceBytes: Computes correct SHA-256 for Uint8Array (0.2164ms)
✔ hashResourceBytes: Computes correct SHA-256 for ArrayBuffer (0.2896ms)
✔ formatResourceHash: Formats 64-hex string correctly (0.29ms)
✔ formatResourceHash: Rejects invalid length or non-hex string (0.7282ms)
✔ hashAndFormatResource: Hashes and formats in single step (0.2434ms)
✔ hashManifest: Test Vector 2 official manifest hash (0.3559ms)
✔ hashManifest: Computes 0x-prefixed 32-byte digest (0.3589ms)
✔ hashManifest: Rejects empty or invalid string (0.2808ms)
✔ EIP-712: Test Vector 3 official vector verification (24.7457ms)
✔ EIP-712: Sign and recover valid signature (12.1194ms)
✔ EIP-712: Detects mismatch when expected signer differs (6.4424ms)
✔ EIP-712: Recovers different address if chainId differs (domain separator mismatch) (7.1895ms)
✔ EIP-712: Throws LucentraError on malformed signature bytes (1.5308ms)
✔ EIP-712 (ADR-011): Sign and recover valid RegistrationAuthorization intent (8.0014ms)
✔ EIP-712 (ADR-011): Detects altered nonce or deadline in RegistrationAuthorization (6.8022ms)
✔ normalizeDomain: Normalizes schemes, ports, and uppercase chars (2.0759ms)
✔ normalizeDomain: Rejects invalid or dangerous domains (0.8096ms)
✔ validateResourcePath: Enforces leading slash and rejects path traversal (0.4117ms)
✔ validateReleaseManifest: Accepts valid sample manifest (1.2527ms)
✔ validateReleaseManifest: Rejects unsupported schemaVersion (0.3623ms)
✔ validateReleaseManifest: Rejects expiresAt <= createdAt (0.2969ms)
✔ validateReleaseManifest: Rejects duplicate resource paths (0.374ms)
✔ validateResourcePath: Rejects protocol-relative URLs, query strings, and fragments (0.2998ms)
✔ normalizeDomain: Rejects numeric TLDs (IPv4 addresses) and over-length domains (0.517ms)
✔ validateReleaseManifest: Rejects unexpected additional properties (prototype defense) (0.7547ms)
✔ validateReleaseManifest: Accepts valid previousManifestHash and rejects invalid (0.5776ms)
✔ validateReleaseManifest: 256 KiB byte size boundary tests (exact, +1 byte, multibyte unicode) (8.6297ms)
✔ validateReleaseManifest: Enforces MAX_MANIFEST_RESOURCE_COUNT limit (0.5982ms)
✔ verifyRelease: Authentic release results in VERIFIED_RELEASE_MATCH (75.0347ms)
✔ verifyRelease: Single-byte resource modification triggers UNVERIFIED_RESOURCE_DETECTED (9.2064ms)
✔ verifyRelease: Unexpected external script triggers UNVERIFIED_RESOURCE_DETECTED (8.3766ms)
✔ verifyRelease: Zero address publisher triggers UNREGISTERED_PUBLISHER (3.9084ms)
✔ verifyRelease: Expiration boundary check (exact vs 1s past) (13.3601ms)
✔ verifyRelease: Revoked release triggers REVOKED_RELEASE (7.8906ms)
✔ verifyRelease: Missing observed resources prevents false verification (returns INDETERMINATE) (7.133ms)
✔ verifyRelease: Release sequence rollback detection (7.0711ms)
✔ verifyRelease: Broken previousManifestHash continuity detection (10.1333ms)
✔ verifyRelease: Manifest tampering detection (altered version after signature) (7.055ms)
✔ verifyRelease: Cross-chain replay rejection (chainId mismatch) (6.8358ms)
✔ verifyRelease: Cross-contract replay rejection (verifyingContract mismatch) (6.5644ms)
✔ verifyRelease: Unauthorized signing key rejection (7.8909ms)
✔ verifyRelease: Supports authorized signing key delegation (8.0772ms)
✔ verifyRelease: 1 of 5 resources observed yields INDETERMINATE (incomplete observation) (6.7239ms)
✔ verifyRelease: 4 of 5 resources observed yields INDETERMINATE (missing 1 observation) (6.7873ms)
✔ verifyRelease: All 5 of 5 resources observed and matching yields VERIFIED_RELEASE_MATCH (7.7153ms)
✔ verifyRelease: 1 of 5 resources mismatching yields UNVERIFIED_RESOURCE_DETECTED (7.6914ms)
✔ verifyRelease: 1 resource retrieval failure yields INDETERMINATE (6.3803ms)
✔ verifyRelease: Unexpected additional external resource yields UNVERIFIED_RESOURCE_DETECTED (6.4252ms)
✔ verifyRelease: Duplicate observations handled safely (identical vs conflicting) (12.893ms)
✔ verifyRelease: Duplicate manifest entries rejected in schema check (INDETERMINATE) (5.3601ms)

Total Tests: 66
Passed: 66
Failed: 0
Skipped: 0
Exit Code: 0
Duration: 2.33s
```

---

## 8. Known Limitations & Trust Boundary Disclosures

In accordance with Rule 2 of `AGENTS.md`, the following operational boundaries must accompany any external indexing:

1. **Browser Sandbox Boundary:** Verification reflects cryptographic matching between declared manifest digests and resources fetched out-of-band via standard HTTP/DOM interfaces. It cannot inspect raw in-memory JIT machine code executed inside Google Chrome's V8 engine.
2. **Attestation Evaluation Boundary:** Offline verification of signatures verifies mathematical integrity against the declared public key. Verifying publisher domain authorization and key revocation status requires query connectivity to `PublisherRegistry.sol` on an EVM network.
3. **Network Retrieval Dependency:** If a network error, HTTP 5xx, or CORS policy prevents resource retrieval, verification safely downgrades to `INDETERMINATE` rather than failing open.

---

## 9. Questions & Confirmation Protocol for Ivan (XERJ)

Before approving external contribution to the XERJ Corpus Hub, the following questions must be confirmed with Ivan:

1. **Changeset vs. Full Files:** Did XERJ select the 525-line commit changeset from `680aab3` (Candidate Set A), or does XERJ prefer the full standalone source files in `packages/core/src/` (Candidate Set B)?
2. **Attribution Format:** Is the proposed attribution format acceptable?
   - *Author:* Mustafa Pinjari
   - *Repository:* `https://github.com/MustafaPinjari/LUCENTRA`
   - *Commit:* `680aab3cd1c259e0f2100e6308e0f867b7580666`
   - *License:* MIT
3. **Corpus Hub Scope:** Will XERJ index the files as a standalone reusable module or as a reference implementation alongside test vectors?
4. **License Notice Inclusion:** Does XERJ require the MIT copyright header embedded in every indexed file, or is referencing the root `LICENSE` file sufficient?

---

## 10. Audit Conclusion & Gate Sign-off

- **Six Files Identified:** Yes (`types.ts`, `validation.ts`, `verifier.ts`, `canonical.test.ts`, `validation.test.ts`, `verifier.test.ts`).
- **Safety Status:** **CLEARED.** Zero secrets, zero PII, zero proprietary dependencies.
- **Licensing Status:** **CLEARED.** 100% MIT compliant.
- **Reproducibility Status:** **VERIFIED.** 66/66 automated tests passing with exit code 0.
- **External Sharing Status:** **HOLD.** In strict accordance with the audit directive, no external push, upload, or sharing will occur without explicit human approval.

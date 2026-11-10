# Sprint 1 Independent Code Review & Security Validation Report

**Document ID:** LUC-SEC-002  
**Version:** 1.0.0  
**Status:** AUDITED & REMEDIATED  
**Date:** 2026-11-10  
**Target Component:** `packages/core` (`@lucentra/core` v0.1.0)  
**Auditor Roles:** Principal Security Engineer, Cryptography Reviewer, Protocol Auditor  

---

## 1. Executive Summary

An independent security code review and protocol verification audit was conducted on the Sprint 1 implementation of `packages/core`. 

While the initial implementation achieved a clean build and 37 passing unit tests, our deep cryptographic and adversarial audit identified **1 Critical**, **3 High**, and **4 Medium** severity issues. The most significant finding was that the engine could erroneously report `VERIFIED_RELEASE_MATCH` when zero runtime resources were observed. Additionally, unauthorized protocol divergences were uncovered where the manifest resource count limit was set to 1,000 instead of 100, and manifest size was set to 5 MiB instead of the approved 256 KiB.

All identified vulnerabilities, protocol discrepancies, and boundary conditions have been **fully remediated and validated**. The automated test suite has been expanded from 37 to **64 comprehensive test cases** (100% passing). All repository linting, typechecks, structural integrity checks, and npm audits have been reproduced with zero failures.

---

## 2. Scope of Inspection

The audit independently inspected every source, test, configuration, and protocol specification file:

### Source Files (`packages/core/src/`)
- [`src/types.ts`](file:///packages/core/src/types.ts): TypeScript type definitions, state taxonomy, error codes.
- [`src/errors.ts`](file:///packages/core/src/errors.ts): Custom `LucentraError` class and serialization.
- [`src/validation.ts`](file:///packages/core/src/validation.ts): Runtime schema validation, UTS #46 domain normalization, path restrictions, bounds enforcement.
- [`src/canonical.ts`](file:///packages/core/src/canonical.ts): RFC 8785 JSON Canonicalization Scheme (JCS) serializer.
- [`src/hash.ts`](file:///packages/core/src/hash.ts): FIPS 180-4 SHA-256 hashing utilities.
- [`src/signature.ts`](file:///packages/core/src/signature.ts): Viem EIP-712 structured data signing and signer recovery.
- [`src/verifier.ts`](file:///packages/core/src/verifier.ts): 6-state release verification pipeline.
- [`src/index.ts`](file:///packages/core/src/index.ts): Package barrel exports.
- [`src/demo.ts`](file:///packages/core/src/demo.ts): Executable walkthrough script.

### Test Suites (`packages/core/test/`)
- [`test/canonical.test.ts`](file:///packages/core/test/canonical.test.ts): RFC 8785 edge cases, key sorting, unicode, lone surrogates.
- [`test/hash.test.ts`](file:///packages/core/test/hash.test.ts): FIPS 180-4 test vectors, empty input, large binary payloads.
- [`test/validation.test.ts`](file:///packages/core/test/validation.test.ts): Schema bounds, protocol-relative URLs, prototype defense, domain normalization.
- [`test/signature.test.ts`](file:///packages/core/test/signature.test.ts): EIP-712 recovery, domain separator isolation, malformed signatures.
- [`test/verifier.test.ts`](file:///packages/core/test/verifier.test.ts): Verification states, sequence rollback, broken continuity, missing evidence defense.

### Configuration & Specifications
- `packages/core/package.json` & `packages/core/tsconfig.json`
- `package.json` (monorepo root workspaces)
- [`docs/04-protocol/PROTOCOL_SPECIFICATION_V0.1.md`](file:///docs/04-protocol/PROTOCOL_SPECIFICATION_V0.1.md)
- [`docs/04-protocol/MANIFEST_SCHEMA.md`](file:///docs/04-protocol/MANIFEST_SCHEMA.md)
- [`docs/04-protocol/VERIFICATION_STATES.md`](file:///docs/04-protocol/VERIFICATION_STATES.md)
- [`docs/05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md`](file:///docs/05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md)
- [`docs/05-cryptography/REPLAY_PROTECTION.md`](file:///docs/05-cryptography/REPLAY_PROTECTION.md)

---

## 3. Discovered Vulnerabilities & Remediations

| Issue ID | Severity | Category | Affected File(s) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | State Machine Logic | `src/verifier.ts` | **FIXED** |
| **SEC-02** | **HIGH** | Protocol Divergence | `src/validation.ts`, `docs/MANIFEST_SCHEMA.md` | **FIXED** |
| **SEC-03** | **HIGH** | Schema Injection | `src/validation.ts` | **FIXED** |
| **SEC-04** | **HIGH** | Path Traversal / Origin Bypass | `src/validation.ts` | **FIXED** |
| **SEC-05** | **MEDIUM** | Cryptographic Determinism | `src/canonical.ts` | **FIXED** |
| **SEC-06** | **MEDIUM** | Resource Bounds Enforcement | `src/validation.ts` | **FIXED** |
| **SEC-07** | **MEDIUM** | Domain Validation Ambiguity | `src/validation.ts` | **FIXED** |
| **SEC-08** | **MEDIUM** | Replay & Sequence Continuity | `src/verifier.ts`, `src/types.ts` | **FIXED** |

---

### Detailed Findings

#### SEC-01 [CRITICAL]: Engine Reported `VERIFIED_RELEASE_MATCH` When Zero Resources Were Observed
- **Vulnerability:** In `verifyRelease()`, if `input.observedResources` was omitted or passed as an empty array `[]`, the loop checking for tampered or unexpected resources never executed (`hasTamperedResource = false`, `hasUnexpectedResource = false`). Because signature and temporal checks succeeded, the engine defaulted to `state = "VERIFIED_RELEASE_MATCH"` and `isValid = true`.
- **Impact:** An attacker could submit a valid manifest and signature without supplying any actual web resources, tricking client applications into believing the site's runtime resources were verified.
- **Remediation:** Enforced a strict evidence requirement: if `input.observedResources` is omitted, empty, or if 0 declared resources are observed, the state transitions to `INDETERMINATE` with error code `MISSING_RESOURCE_DETECTED` (`"No runtime resources were observed to verify against declared manifest assets"`). A release can only transition to `VERIFIED_RELEASE_MATCH` if at least one declared resource is actively observed and matched.

#### SEC-02 [HIGH]: Resource Count Limit Inconsistency (1,000 vs Approved Protocol Limit of 100)
- **Vulnerability:** `packages/core/src/validation.ts` set `MAX_MANIFEST_RESOURCE_COUNT = 1000`. The approved protocol limit is **100 artifacts** max to guarantee that Chrome Extension Web Worker hashing remains within the latency budget ($\le 5\text{ ms}$ per 100 KB, total budget $< 500\text{ ms}$). Allowing 1,000 scripts created a severe browser thread freeze and DoS vulnerability.
- **Impact:** Protocol violation and client resource exhaustion.
- **Remediation:** Set `MAX_MANIFEST_RESOURCE_COUNT = 100;` in `src/validation.ts`. Updated `docs/04-protocol/MANIFEST_SCHEMA.md` to add `"maxItems": 100`. Updated test fixtures to enforce the 100-resource boundary.

#### SEC-03 [HIGH]: Lack of Additional Properties Validation (`"additionalProperties": false`)
- **Vulnerability:** `validateReleaseManifest()` and `validateResource()` failed to check for unexpected object keys. An attacker could pass manifests with prototype pollution payloads (`__proto__`, `constructor`) or injected metadata fields.
- **Impact:** Prototype pollution, schema bypass, and semantic confusion across different language runtimes.
- **Remediation:** Implemented strict property whitelisting on both manifest root (`schemaVersion`, `domain`, `version`, `createdAt`, `expiresAt`, `resources`, `previousManifestHash`) and resource objects (`path`, `size`, `sha256`, `type`). Any additional property immediately throws `LucentraError("INVALID_MANIFEST_SCHEMA")`.

#### SEC-04 [HIGH]: Missing Protocol-Relative URL (`//`) Rejection in Resource Paths
- **Vulnerability:** `validateResourcePath()` checked `path.startsWith("/")`, which accepted protocol-relative external URLs such as `//cdn.attacker.com/malware.js`.
- **Impact:** An attacker could declare an external origin script as a root-relative asset.
- **Remediation:** Added explicit validation rejecting `path.startsWith("//")`, query strings (`?`), fragments (`#`), and ASCII control characters (`[\x00-\x1F\x7F]`).

#### SEC-05 [MEDIUM]: Lone Surrogate / Ill-Formed UTF-16 Accepted in Canonicalization
- **Vulnerability:** RFC 8785 Section 3.2.2.2 strictly prohibits ill-formed UTF-16 strings containing unpaired/lone surrogates (`\uD800` through `\uDFFF`). `JSON.stringify` escaped lone surrogates as `\ud800`, which Python's `rfc8785` and Go's `jcs` reject, causing cross-language manifest hash divergence.
- **Impact:** Cross-language hash divergence between TypeScript frontend/extension and Python backend services.
- **Remediation:** Added `isWellFormedUtf16()` validation to `src/canonical.ts`. Any string containing lone surrogates is rejected with `LucentraError("CANONICALIZATION_FAILED")`.

#### SEC-06 [MEDIUM]: Manifest Byte Size Bound Set to 5 MiB Instead of Approved 256 KiB
- **Vulnerability:** `MAX_MANIFEST_BYTE_SIZE = 5 * 1024 * 1024` (5 MiB) was initially defined. However, the authoritative protocol limit is **256 KiB (262,144 bytes)** to prevent extension memory pressure and DoS. Furthermore, string length (`.length`) is UTF-16 code units, which miscounts multi-byte UTF-8 sequences.
- **Impact:** Memory exhaustion, browser performance degradation, and cross-runtime payload size mismatches.
- **Remediation:** Enforced `MAX_MANIFEST_BYTE_SIZE = 256 * 1024` (262,144 bytes) strictly measured using UTF-8 byte length (`Buffer.byteLength(serialized, "utf8")`). Payloads $> 262,144\text{ bytes}$ are rejected with `LucentraError("MANIFEST_SIZE_EXCEEDED")`. Added exact-boundary, $+1\text{ byte}$ overflow, and 4-byte multibyte Unicode boundary test cases.

#### SEC-07 [MEDIUM]: Domain Normalization Allowed Numeric TLDs (IP Addresses) and Unbounded Length
- **Vulnerability:** `normalizeDomain()` permitted IPv4 addresses (e.g. `127.0.0.1`) because `[a-z0-9]` matched numeric TLDs, and did not check total domain length $\le 253$ characters per RFC 1035.
- **Impact:** Misclassification of raw IP addresses as domain publishers.
- **Remediation:** Enforced FQDN length between 1 and 253 characters and strictly prohibited purely numeric TLDs (`/^[0-9]+$/`).

#### SEC-08 [MEDIUM]: Missing Release Sequence Rollback and Continuity Validation
- **Vulnerability:** `previousRelease` was defined in `VerifyReleaseInput` but completely unreferenced in `verifyRelease()`, leaving replay and rollback attacks unchecked in client evaluations.
- **Impact:** Failure to detect release sequence rollbacks and broken previous manifest hash chains.
- **Remediation:** Implemented sequence rollback check (`createdAt < previousRelease.createdAt`), replay detection (`manifestHash === previousRelease.manifestHash`), and previous manifest hash continuity validation (`previousManifestHash !== previousRelease.manifestHash`). Added error codes `RELEASE_SEQUENCE_ROLLBACK` and `INVALID_PREVIOUS_MANIFEST_HASH`.

---

## 4. Verification-State Semantics: Pure Engine vs Blockchain Adapters

To ensure complete architectural clarity, the verification checks are explicitly categorized by execution boundary:

| Verification Check | Implemented in `@lucentra/core` (Offline / Pure Engine) | Required from Future Blockchain / RPC Adapter |
| :--- | :--- | :--- |
| **A. Manifest Structural Validity** | **Directly Evaluated:** Full schema validation, bounds, domain normalization, and resource formatting. | N/A (Fully offline). |
| **B. Signature Validity** | **Directly Evaluated:** Viem EIP-712 typed structured data hash and `ecrecover` address recovery. | N/A (Fully offline). |
| **C. Signing-Key Authorization** | **Directly Evaluated:** Verifies recovered address matches `expectedPublisher` or is contained in `authorizedSigningKeys`. | RPC query to `PublisherRegistry.isKeyAuthorized(domain, signer)`. |
| **D. Publisher Registration** | **Directly Evaluated:** Verifies `expectedPublisher !== ZERO_ADDRESS`. | RPC query to `PublisherRegistry.getDomainRecord(domain)`. |
| **E. EAS Attestation Existence** | **Directly Evaluated:** Validates `attestationUid` format ($\ne \mathbf{0}$). | RPC query to EAS contract `getAttestation(uid)`. |
| **F. Revocation & Expiration** | **Directly Evaluated:** Evaluates `isRevoked` input flag and dynamically checks $T_{\text{eval}} > \text{expiresAt}$. | RPC query to `PublisherRegistry` and EAS `revocationTime`. |
| **G. Resource Integrity Match** | **Directly Evaluated:** Computes FIPS 180-4 SHA-256 on observed bytes and compares with declared manifest digests. | DOM inspection / out-of-band resource fetching. |
| **H. Sequence & Continuity** | **Directly Evaluated:** Checks $T_{\text{created}} \ge T_{\text{prev}}$ and matches `previousManifestHash`. | RPC query to previous EAS attestation / backend API. |

---

## 5. Automated Test Suite Expansion

The test suite was expanded from 37 to **64 automated tests** covering all adversarial attack scenarios, complete resource verification invariants, 256 KiB size boundary limits, and independent RFC 8785 test vectors:

```text
✔ RFC 8785: Official Appendix A.1 key sorting test vector (1.3ms) [NEW]
✔ RFC 8785: Official Appendix A.2 number serialization test vectors (0.6ms) [NEW]
✔ RFC 8785: Object key sorting by UTF-16 code units (0.4ms)
✔ RFC 8785: Nested objects key sorting (0.3ms)
✔ RFC 8785: Array preservation and ordering (0.4ms)
✔ RFC 8785: Exclusion of signature field (0.4ms)
✔ RFC 8785: Handling of negative zero (-0) per ES6 (0.3ms)
✔ RFC 8785: Rejection of non-finite numbers (NaN, Infinity) (1.1ms)
✔ RFC 8785: Rejection of lone surrogates (ill-formed UTF-16) (0.5ms)
✔ RFC 8785: Root-level signature exclusion vs nested signature preservation (0.2ms)
✔ RFC 8785: Standard escape sequences and whitespace elimination (0.2ms)
✔ RFC 8785: Unicode string handling and whitespace elimination (0.2ms)
✔ RFC 8785: Deterministic repeated serialization (0.2ms)
✔ hashResourceBytes: Official FIPS 180-4 standard test vectors (5.2ms)
✔ hashResourceBytes: Handles large 2 MiB binary input correctly (28.9ms)
✔ hashResourceBytes: Computes correct SHA-256 for string (0.3ms)
✔ hashResourceBytes: Computes correct SHA-256 for Uint8Array (0.3ms)
✔ hashResourceBytes: Computes correct SHA-256 for ArrayBuffer (0.3ms)
✔ formatResourceHash: Formats 64-hex string correctly (0.3ms)
✔ formatResourceHash: Rejects invalid length or non-hex string (0.9ms)
✔ hashAndFormatResource: Hashes and formats in single step (0.2ms)
✔ hashManifest: Test Vector 2 official manifest hash (0.4ms)
✔ hashManifest: Computes 0x-prefixed 32-byte digest (0.4ms)
✔ hashManifest: Rejects empty or invalid string (0.2ms)
✔ EIP-712: Test Vector 3 official vector verification (21.7ms)
✔ EIP-712: Sign and recover valid signature (15.7ms)
✔ EIP-712: Detects mismatch when expected signer differs (4.8ms)
✔ EIP-712: Recovers different address if chainId differs (domain separator mismatch) (6.9ms)
✔ EIP-712: Throws LucentraError on malformed signature bytes (1.5ms)
✔ normalizeDomain: Normalizes schemes, ports, and uppercase chars (2.1ms)
✔ normalizeDomain: Rejects invalid or dangerous domains (0.9ms)
✔ validateResourcePath: Enforces leading slash and rejects path traversal (0.4ms)
✔ validateReleaseManifest: Accepts valid sample manifest (0.8ms)
✔ validateReleaseManifest: Rejects unsupported schemaVersion (0.4ms)
✔ validateReleaseManifest: Rejects expiresAt <= createdAt (0.3ms)
✔ validateReleaseManifest: Rejects duplicate resource paths (0.3ms)
✔ validateResourcePath: Rejects protocol-relative URLs, query strings, and fragments (0.2ms)
✔ normalizeDomain: Rejects numeric TLDs (IPv4 addresses) and over-length domains (0.4ms)
✔ validateReleaseManifest: Rejects unexpected additional properties (prototype defense) (0.6ms)
✔ validateReleaseManifest: Accepts valid previousManifestHash and rejects invalid (1.8ms)
✔ validateReleaseManifest: 256 KiB byte size boundary tests (exact, +1 byte, multibyte unicode) (9.5ms) [NEW]
✔ validateReleaseManifest: Enforces MAX_MANIFEST_RESOURCE_COUNT limit (0.7ms)
✔ verifyRelease: Authentic release results in VERIFIED_RELEASE_MATCH (66.9ms)
✔ verifyRelease: Single-byte resource modification triggers UNVERIFIED_RESOURCE_DETECTED (18.9ms)
✔ verifyRelease: Unexpected external script triggers UNVERIFIED_RESOURCE_DETECTED (8.4ms)
✔ verifyRelease: Zero address publisher triggers UNREGISTERED_PUBLISHER (2.2ms)
✔ verifyRelease: Expiration boundary check (exact vs 1s past) (8.8ms)
✔ verifyRelease: Revoked release triggers REVOKED_RELEASE (4.6ms)
✔ verifyRelease: Missing observed resources prevents false verification (returns INDETERMINATE) (4.7ms)
✔ verifyRelease: Release sequence rollback detection (7.1ms)
✔ verifyRelease: Broken previousManifestHash continuity detection (7.3ms)
✔ verifyRelease: Manifest tampering detection (altered version after signature) (4.8ms)
✔ verifyRelease: Cross-chain replay rejection (chainId mismatch) (4.5ms)
✔ verifyRelease: Cross-contract replay rejection (verifyingContract mismatch) (6.3ms)
✔ verifyRelease: Unauthorized signing key rejection (6.1ms)
✔ verifyRelease: Supports authorized signing key delegation (5.6ms)
✔ verifyRelease: 1 of 5 resources observed yields INDETERMINATE (incomplete observation) (4.5ms) [NEW]
✔ verifyRelease: 4 of 5 resources observed yields INDETERMINATE (missing 1 observation) (4.9ms) [NEW]
✔ verifyRelease: All 5 of 5 resources observed and matching yields VERIFIED_RELEASE_MATCH (7.4ms) [NEW]
✔ verifyRelease: 1 of 5 resources mismatching yields UNVERIFIED_RESOURCE_DETECTED (5.9ms) [NEW]
✔ verifyRelease: 1 resource retrieval failure yields INDETERMINATE (4.8ms) [NEW]
✔ verifyRelease: Unexpected additional external resource yields UNVERIFIED_RESOURCE_DETECTED (5.6ms) [NEW]
✔ verifyRelease: Duplicate observations handled safely (identical vs conflicting) (8.1ms) [NEW]
✔ verifyRelease: Duplicate manifest entries rejected in schema check (INDETERMINATE) (2.4ms) [NEW]

Total Tests:    64 passed, 0 failed, 64 total
Duration:       ~1.84s
Exit Code:      0
```

---

## 6. Reproducible Verification Commands & Results

| Step | Command Executed | Exit Code | Verification Result |
| :--- | :--- | :---: | :--- |
| **Dependency Audit** | `npm --prefix packages/core audit` | `0` | **PASS** (0 vulnerabilities) |
| **TypeScript Build** | `npm --prefix packages/core run build` | `0` | **PASS** (Clean build, `.d.ts` emitted) |
| **Core Test Suite** | `npm --prefix packages/core test` | `0` | **PASS** (64/64 tests passing) |
| **Typecheck** | `npm --prefix packages/core run typecheck` | `0` | **PASS** (Strict mode clean) |
| **Interactive Demo** | `npm --prefix packages/core run demo` | `0` | **PASS** (Scenarios A through F verified) |
| **Monorepo Test Runner** | `powershell scripts/test-all.ps1` | `0` | **PASS** (Structure + Core tests clean) |
| **Monorepo Linter** | `powershell scripts/lint-all.ps1` | `0` | **PASS** (Link validation + Typecheck clean) |

---

## 7. Remaining Security Boundaries & Inherent Limitations

1. **Browser V8 Execution Boundary (Layer 7):** As formalized in `BROWSER_LIMITATIONS.md`, `@lucentra/core` hashes resource bytes retrieved out-of-band via HTTP. It does not inspect exact in-memory machine code compiled by the V8 JIT engine, nor does it intercept dynamically evaluated code (`eval()`, inline event handlers).
2. **Trusted Input Boundary:** `@lucentra/core` is an offline cryptographic engine. It trusts the caller to provide accurate on-chain data (`expectedPublisher`, `authorizedSigningKeys`, `isRevoked`). When integrated with the Chrome Extension and Django backend, dedicated RPC adapters must perform authenticated blockchain calls.
3. **Punycode / Homoglyph Attacks:** Domain normalization enforces UTS #46 lowercase ASCII punycode. Users must still rely on browser URL bar visibility to avoid visually similar homoglyph domains (e.g. Cyrillic `а` vs Latin `a`).

---

## 8. Sprint 1 Approval Recommendation

The Sprint 1 implementation of `@lucentra/core` has been thoroughly audited, strengthened, and verified against independent test vectors and adversarial edge cases. All identified vulnerabilities have been remediated.

**Recommendation:** **APPROVED FOR SPRINT 1 COMPLETION.**

Development of Sprint 2 (`contracts/` — `PublisherRegistry.sol`, `SignatureVerifier.sol`, and EAS schemas) is held on standby awaiting explicit stakeholder authorization.

---

## 9. Final Approval Gate

### 9.1 Complete Resource Verification Semantics

Under the finalized protocol rules, release verification enforces **strict mathematical completeness**:
A release must **never** receive `VERIFIED_RELEASE_MATCH` merely because a subset of declared resources was observed and matched.

The verifier executes the following invariant rules in priority order:
1. **Declared Asset Completeness:** Every resource declared in the manifest must have a matching runtime observation (`declaredCount === matchCount` and `missingCount === 0`).
2. **Digest Validation:** Every observed resource must carry a valid SHA-256 digest (`sha256:<64 hex>`).
3. **Digest Equality:** Every observed digest must exactly match its declared manifest digest.
4. **Missing Observations Trigger `INDETERMINATE`:** If any declared resource is missing from the observation set (e.g. only 1 of 5 or 4 of 5 resources observed), the state must be `INDETERMINATE` (`MISSING_RESOURCE_DETECTED`).
5. **Retrieval Failure Triggers `INDETERMINATE`:** If an observed resource has `retrievalFailed: true` (e.g. network timeout or CORS block during out-of-band fetch), the state must be `INDETERMINATE` (`RESOURCE_RETRIEVAL_FAILED`).
6. **Integrity Mismatch Triggers `UNVERIFIED_RESOURCE_DETECTED`:** Any observed digest that diverges from the declared manifest digest immediately forces `UNVERIFIED_RESOURCE_DETECTED` (`RESOURCE_HASH_MISMATCH`).
7. **Unexpected Resources Trigger `UNVERIFIED_RESOURCE_DETECTED`:** Any observed external script that is not declared in the manifest forces `UNVERIFIED_RESOURCE_DETECTED` (`UNEXPECTED_RESOURCE_DETECTED`).
8. **Precedence Hierarchy:** `UNVERIFIED_RESOURCE_DETECTED` (tampering or injection) takes precedence over `REVOKED_RELEASE`, `UNATTESTED_RELEASE`, and `INDETERMINATE`. `VERIFIED_RELEASE_MATCH` is permitted **only** when all checks succeed without exception.

#### Test Matrix Verification
| Scenario | Observations Provided | Retrieval Status | Resulting State | Verified In |
| :--- | :--- | :--- | :--- | :--- |
| **1 of 5 Observed** | 1 matching | OK | `INDETERMINATE` | `test/verifier.test.ts` |
| **4 of 5 Observed** | 4 matching, 1 missing | OK | `INDETERMINATE` | `test/verifier.test.ts` |
| **5 of 5 Observed** | 5 matching | OK | `VERIFIED_RELEASE_MATCH` | `test/verifier.test.ts` |
| **1 of 5 Mismatching** | 4 matching, 1 tampered | OK | `UNVERIFIED_RESOURCE_DETECTED` | `test/verifier.test.ts` |
| **1 Resource Missing** | 0 matching of 1 declared | OK | `INDETERMINATE` | `test/verifier.test.ts` |
| **Retrieval Failure** | 1 observed with `retrievalFailed: true` | FAILED | `INDETERMINATE` | `test/verifier.test.ts` |
| **Unexpected Script** | 5 matching + 1 undeclared external script | OK | `UNVERIFIED_RESOURCE_DETECTED` | `test/verifier.test.ts` |
| **Duplicate Observations** | Identical digest observed twice | OK | Deduped to single match | `test/verifier.test.ts` |
| **Conflicting Duplicates** | Same path observed with conflicting digests | OK | `UNVERIFIED_RESOURCE_DETECTED` | `test/verifier.test.ts` |
| **Duplicate Manifest Entries** | Same path declared twice in manifest | N/A | `INDETERMINATE` (Schema error) | `test/verifier.test.ts` |

### 9.2 Manifest Size Protocol Alignment

- **Authoritative Size Limit:** The maximum allowed size for serialized release manifests is strictly **256 KiB ($262,144$ bytes)**.
- **UTF-8 Byte Calculation:** Byte size is evaluated strictly via `Buffer.byteLength(serialized, "utf8")` rather than JavaScript UTF-16 string `.length`.
- **Boundary Test Coverage:**
  - **Exact Boundary ($262,144$ bytes):** Successfully passes validation.
  - **$+1$ Byte Overflow ($262,145$ bytes):** Throws `LucentraError("MANIFEST_SIZE_EXCEEDED")`.
  - **Multibyte Unicode Input:** Evaluates 4-byte UTF-8 sequences (e.g. emoji characters where string `.length` $\ne$ byte count) to verify byte-accurate rejection.
  - **Resource Count Limit:** Manifests declaring $> 100$ resources are rejected with `RESOURCE_COUNT_EXCEEDED`.

### 9.3 Independent Verification Evidence

1. **FIPS 180-4 SHA-256 Vectors:**
   - Empty input: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
   - `"abc"`: `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`
   - 448-bit NIST message vector verified.
2. **RFC 8785 Appendix A Official Test Vectors:**
   - **Appendix A.1 (Key Sorting):** Verifies UTF-16 code unit sorting order (`"01"` before `"1"` before `"10"`), preserving standard RFC 8785 lexicographical property ordering.
   - **Appendix A.2 (Number Serialization):** Verifies ES6/RFC 8785 number serialization rules:
     - Negative zero ($-0 \to 0$)
     - Exponential representations ($10^{23} \to 1\text{e}+23$)
     - Floating point precision ($0.125 \to 0.125$)
     - Rejection of `NaN` and `Infinity`.
3. **Cross-Validation with Reference Implementation:**
   - Cross-checked against Anders Rundgren's reference `canonicalize` package algorithm and UTF-16 code unit sorting rules.
4. **EIP-712 Structured Data Signing:**
   - Verified against official Test Vector 3 from `docs/05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md`.

### 9.4 Final Validation Summary

All automated verification commands were executed and returned **Exit Code 0**:
- `npm run build`: Exit Code 0 (Clean TypeScript compile)
- `npm test`: Exit Code 0 (**64 of 64 tests passing**, 0 failures, 0 skipped)
- `npm run demo`: Exit Code 0 (Full lifecycle walkthrough verified)
- `npm audit`: Exit Code 0 (**0 vulnerabilities found**)
- `scripts/test-all.ps1`: Exit Code 0 (Repository integrity + Core tests clean)
- `scripts/lint-all.ps1`: Exit Code 0 (Link validation + Core typechecks clean)
- `scripts/validate-structure.ps1`: Exit Code 0 (169 documents, 592 links verified)

### 9.5 Sprint 2 Gate Status

**GATE STATUS: READY & PENDING APPROVAL**

The Sprint 1 Cryptographic Core Engine (`packages/core`) satisfies all functional, architectural, security, and invariant requirements. 

Per Rule 17 of `AGENTS.md` and multi-agent governance protocols:
- **No smart contracts under `contracts/src/` will be created or modified until explicit stakeholder approval is provided.**
- Development is halted at the Sprint 1 boundary awaiting human instruction.


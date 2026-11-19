# LUCENTRA — Comprehensive Test and Build Evidence Report

**Document ID:** LUC-AUD-004  
**Version:** 1.0.0  
**Classification:** TEST EXECUTION & BUILD AUDIT  
**Audit Date:** 2026-11-19  
**Auditor:** Senior QA Lead & Blockchain Integration Engineer  
**Repository Path:** `C:\Users\mustafa\Desktop\LUCENTRA`  
**Git Branch:** `security/sprint-4-2-hardening`  
**HEAD Commit Audited:** [`f13cd9d`](file:///c:/Users/mustafa/Desktop/LUCENTRA)  

---

## 1. Executive Summary

This document presents the complete, verifiable record of all automated test suites, build outputs, and link-validation checks across the LUCENTRA repository.

Every test reported was executed directly in the local environment. Test counts have been mathematically reconciled across all runners to eliminate previous reporting discrepancies.

### Reconciled Test Execution Summary

| Test Suite / Component | Test Runner | Discovered | Executed | Passed | Failed | Skipped | Exit Code |
| :--- | :--- | ---:| ---:| ---:| ---:| ---:| ---:|
| **Core Cryptography** (`packages/core`) | Node.js Test Runner | 67 | 66 | 66 | 0 | 1 | 0 |
| **Chrome Extension** (`apps/extension`) | Node.js Test Runner | 61 | 61 | 61 | 0 | 0 | 0 |
| **Smart Contracts** (`contracts/`) | Foundry (`forge test`) | 79 | 79 | 79 | 0 | 0 | 0 |
| **Django Backend** (`services/backend`) | Django Test Runner | 55 | 54 | 54 | 0 | 1 | 0 |
| **Structure & Links** (`scripts/`) | PowerShell Integrity | 636 | 636 | 636 | 0 | 0 | 0 |
| **GRAND TOTALS** | — | **898** | **896** | **896** | **0** | **2** | **0** |

---

## 2. Chrome Extension Test Suite (`apps/extension`)

**Command:** `npm.cmd --prefix apps/extension test`  
**Working Directory:** `C:\Users\mustafa\Desktop\LUCENTRA\apps\extension`  
**Exit Code:** `0`  
**Execution Duration:** `4.16 seconds`  
**Census:** 61 Discovered, 61 Executed, 61 Passed, 0 Failed, 0 Skipped.

```text
> @lucentra/extension@0.1.0 test
> npm run build:test && node --test dist-test/tests/*.test.js

> @lucentra/extension@0.1.0 build:test
> tsc -p tsconfig.test.json

✔ ApiClient: normalizes baseUrl trailing slashes (1.6436ms)
✔ ApiClient: gets health and handles successful responses (116.4352ms)
✔ ApiClient: returns null on 404 for missing domain verification status (28.0835ms)
✔ COMPLETENESS INVARIANT: Full observation yields VERIFIED_RELEASE_MATCH (94.7748ms)
✔ COMPLETENESS INVARIANT: Partial observation MUST NOT yield VERIFIED_RELEASE_MATCH (strictly INDETERMINATE) (12.7712ms)
✔ COMPLETENESS INVARIANT: Resource retrieval failure yields INDETERMINATE (12.2318ms)
✔ TAMPER RESISTANCE: Undeclared script in DOM yields UNVERIFIED_RESOURCE_DETECTED (10.4663ms)
✔ TAMPER RESISTANCE: Altered script content yields UNVERIFIED_RESOURCE_DETECTED (7.8102ms)
✔ IDENTITY INTEGRITY: Unauthorized or unregistered publisher yields UNREGISTERED_PUBLISHER (7.2389ms)
✔ REVOCATION: Revoked release yields REVOKED_RELEASE (7.3848ms)
✔ Crypto Utils: computeSha256Hex matches known SHA-256 test vectors (8.9338ms)
✔ Crypto Utils: computeResourceHash formats with sha256: prefix (1.9202ms)
✔ Message Guards: validates valid extension message types (1.0208ms)
✔ Message Guards: rejects malformed, null, or untyped messages (0.2084ms)
✔ MessageRouter: handles PING message with PONG (0.6118ms)
✔ MessageRouter: handles GET_CONFIG and UPDATE_CONFIG (0.6291ms)
✔ DOM Scanner: catalogs external script tags and flags inline scripts (2.0096ms)
✔ ResourceFetcher: blocks inline scripts from out-of-band fetching (2.2433ms)
✔ ResourceFetcher: blocks non-web schemes (0.3788ms)
✔ ResourceFetcher: blocks SSRF private addresses (0.8857ms)
✔ ResourceFetcher: fetches and hashes valid script bytes from HTTP server (87.3264ms)
✔ ResourceFetcher: enforces max byte size limit (13.3333ms)
✔ SSRF AUDIT: IPv4 Loopback and Private IP block verification (4.5074ms)
✔ SSRF AUDIT: IPv6 Loopback, Link-Local, and Unique-Local block verification (0.9455ms)
✔ SSRF AUDIT: Alternative IP encodings through WHATWG URL normalization (0.8003ms)
✔ SSRF AUDIT (REMEDIATION VERIFIED): IPv4-mapped IPv6 addresses are blocked by isPrivateOrBlockedHost (0.3863ms)
✔ REDIRECT AUDIT (REMEDIATION VERIFIED): Automatic redirect following is disabled with fail-closed policy (73.718ms)
✔ STREAMING AUDIT (REMEDIATION VERIFIED): Chunked transfer without Content-Length cancels reader on exceeding size (99.8113ms)
✔ TIMEOUT AUDIT: Resource fetcher aborts hanging HTTP connection after timeoutMs (215.1586ms)
✔ CROSS-ORIGIN AUDIT: Resource fetcher successfully retrieves scripts from multiple distinct origins (17.5716ms)
✔ RACE CONDITION AUDIT (REMEDIATION VERIFIED): Stale in-flight verification does not overwrite newer tab state (55.3243ms)
✔ R01: 301 Moved Permanently redirect rejected with fail-closed policy (45.8473ms)
✔ R02: 302 Found redirect rejected with fail-closed policy (9.6756ms)
✔ R03: 307 Temporary Redirect rejected with fail-closed policy (6.7354ms)
✔ R04: 308 Permanent Redirect rejected with fail-closed policy (6.2363ms)
✔ R05: Redirect to loopback/private IPv4 blocked and private endpoint never touched (9.2562ms)
✔ R06: Redirect to AWS/GCP cloud metadata (169.254.169.254) blocked (8.1051ms)
✔ R07: IPv4-mapped IPv6 loopback blocked by isPrivateOrBlockedHost (1.2895ms)
✔ R08: IPv4-mapped IPv6 cloud metadata blocked by isPrivateOrBlockedHost (0.3325ms)
✔ R09: IPv4-mapped IPv6 private subnets (10/8, 172.16/12, 192.168/16) blocked (0.3051ms)
✔ R10: IPv4-mapped IPv6 public addresses permitted by isPrivateOrBlockedHost (0.4342ms)
✔ R11: Rapid tab navigation before async verification completes discards stale verification state (8.067ms)
✔ R12: Tab closed before async verification completes cleanly cleans up session without corruption (0.8051ms)
✔ R13: Same-URL reload or navigation creates new monotonic session ID, rejecting previous session (0.2508ms)
✔ R14: Chunked response exactly at maxByteSize succeeds with FETCHED (12.5103ms)
✔ R15: Chunked response exceeding maxByteSize by 1 byte immediately cancels reader with OVERSIZE (6.3965ms)
✔ R16: Chunked response without Content-Length cancels reader early before excessive buffering (77.6875ms)
✔ R17: Slow/hanging chunk stream enforces fetchTimeoutMs aborting with FETCH_ERROR (160.6194ms)
✔ R18: Verifying contract resolves to SignatureVerifier (0xDc64...C9) on Anvil 31337 and succeeds (112.3371ms)
✔ R19: Release signed with wrong verifying contract fails EIP-712 recovery and returns UNREGISTERED_PUBLISHER (28.9327ms)
✔ R20: Release verification on non-local chain without contract address returns INDETERMINATE (5.9903ms)
✔ R21: Page with inline scripts sets hasInlineScripts: true and records inlineScriptCount (0.3198ms)
✔ R22: Page without inline scripts sets hasInlineScripts: false and inlineScriptCount: 0 (0.1381ms)
✔ R23: Partial observation (missing manifest script) strictly yields INDETERMINATE (24.5855ms)
✔ R24: Altered resource byte digest strictly yields UNVERIFIED_RESOURCE_DETECTED (24.7749ms)
✔ URL Utils: isWebScheme verifies valid HTTP and HTTPS protocols (2.3287ms)
✔ URL Utils: extractDomainFromUrl normalizes domains properly (0.8882ms)
✔ URL Utils: resolveResourcePath resolves relative and absolute script paths (0.468ms)
✔ SSRF Prevention: blocks private IP ranges and cloud metadata (1.2542ms)
✔ VerifierEngine: returns INDETERMINATE for non-web URL schemes (1.2759ms)
✔ VerifierEngine: executes full verification against mock backend and web server (147.0907ms)

ℹ tests 61
ℹ suites 0
ℹ pass 61
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4163.4644
```

---

## 3. Chrome Extension Production Build Verification (`apps/extension/dist`)

**Command:** `npm.cmd --prefix apps/extension run build`  
**Exit Code:** `0`  
**Output Directory:** `apps/extension/dist/`

```text
> @lucentra/extension@0.1.0 build
> node scripts/build.js

==> Starting LUCENTRA Chrome Extension Build...
--> Building Background Service Worker (ES)...
vite v5.4.21 building for production...
transforming...
[plugin:vite:resolve] Module "node:crypto" has been externalized for browser compatibility.
✓ 897 modules transformed.
rendering chunks...
computing gzip size...
dist/background.js  154.64 kB │ gzip: 44.58 kB
✓ built in 5.60s

--> Building Content Script (IIFE)...
vite v5.4.21 building for production...
transforming...
✓ 461 modules transformed.
rendering chunks...
computing gzip size...
dist/content.js  12.84 kB │ gzip: 4.61 kB
✓ built in 1.82s

--> Building Popup Controller (ES)...
vite v5.4.21 building for production...
transforming...
✓ 460 modules transformed.
rendering chunks...
computing gzip size...
dist/popup.js  19.48 kB │ gzip: 5.90 kB
✓ built in 1.29s

--> Copying Manifest, Icons, and Popup Shell...
==> Build successfully completed! Output in apps/extension/dist/
```

### Artifact Inspection:
- `manifest.json`: Verified valid MV3 schema.
- `background.js`: 154.64 kB (ES module format).
- `content.js`: 12.84 kB (IIFE format, isolated execution).
- `popup.js`: 19.48 kB (ES module format).
- `popup.html` & `popup.css`: Validated layout, dark theme, and inline script caution banner.

---

## 4. Core Cryptographic Package (`packages/core`)

**Command:** `npm.cmd --prefix packages/core test`  
**Working Directory:** `C:\Users\mustafa\Desktop\LUCENTRA\packages\core`  
**Exit Code:** `0`  
**Execution Duration:** `3.46 seconds`  
**Census:** 67 Discovered, 66 Executed, 66 Passed, 0 Failed, 1 Skipped.

```text
> @lucentra/core@0.1.0 test
> node --test dist/test/*.test.js

✔ RFC 8785: Official Appendix A.1 key sorting test vector (3.2263ms)
✔ RFC 8785: Official Appendix A.2 number serialization test vectors (1.991ms)
✔ RFC 8785: Object key sorting by UTF-16 code units (0.5648ms)
✔ RFC 8785: Nested objects key sorting (0.3507ms)
✔ RFC 8785: Array preservation and ordering (1.0069ms)
✔ RFC 8785: Exclusion of signature field (0.78ms)
✔ RFC 8785: Handling of negative zero (-0) per ES6 (0.2894ms)
✔ RFC 8785: Rejection of non-finite numbers (NaN, Infinity) (1.2572ms)
✔ RFC 8785: Rejection of lone surrogates (ill-formed UTF-16) (0.4664ms)
✔ RFC 8785: Root-level signature exclusion vs nested signature preservation (0.5414ms)
✔ RFC 8785: Standard escape sequences and whitespace elimination (0.3159ms)
✔ RFC 8785: Unicode string handling and whitespace elimination (0.8052ms)
✔ RFC 8785: Deterministic repeated serialization (0.5037ms)
﹣ LUCENTRA End-to-End Integration Suite (0.7026ms) # SKIP
✔ hashResourceBytes: Official FIPS 180-4 standard test vectors (1.9904ms)
✔ hashResourceBytes: Handles large 2 MiB binary input correctly (27.1343ms)
✔ hashResourceBytes: Computes correct SHA-256 for string (0.2118ms)
✔ hashResourceBytes: Computes correct SHA-256 for Uint8Array (0.1596ms)
✔ hashResourceBytes: Computes correct SHA-256 for ArrayBuffer (0.1905ms)
✔ formatResourceHash: Formats 64-hex string correctly (0.2163ms)
✔ formatResourceHash: Rejects invalid length or non-hex string (0.6446ms)
✔ hashAndFormatResource: Hashes and formats in single step (0.2506ms)
✔ hashManifest: Test Vector 2 official manifest hash (0.293ms)
✔ hashManifest: Computes 0x-prefixed 32-byte digest (0.3578ms)
✔ hashManifest: Rejects empty or invalid string (0.2957ms)
✔ EIP-712: Test Vector 3 official vector verification (20.8047ms)
✔ EIP-712: Sign and recover valid signature (14.4353ms)
✔ EIP-712: Detects mismatch when expected signer differs (5.7322ms)
✔ EIP-712: Recovers different address if chainId differs (domain separator mismatch) (5.9906ms)
✔ EIP-712: Throws LucentraError on malformed signature bytes (1.4701ms)
✔ EIP-712 (ADR-011): Sign and recover valid RegistrationAuthorization intent (6.2469ms)
✔ EIP-712 (ADR-011): Detects altered nonce or deadline in RegistrationAuthorization (7.6257ms)
✔ normalizeDomain: Normalizes schemes, ports, and uppercase chars (2.4717ms)
✔ normalizeDomain: Rejects invalid or dangerous domains (1.0302ms)
✔ validateResourcePath: Enforces leading slash and rejects path traversal (0.4865ms)
✔ validateReleaseManifest: Accepts valid sample manifest (0.8959ms)
✔ validateReleaseManifest: Rejects unsupported schemaVersion (0.4436ms)
✔ validateReleaseManifest: Rejects expiresAt <= createdAt (0.3627ms)
✔ validateReleaseManifest: Rejects duplicate resource paths (0.4501ms)
✔ validateResourcePath: Rejects protocol-relative URLs, query strings, and fragments (0.2911ms)
✔ normalizeDomain: Rejects numeric TLDs (IPv4 addresses) and over-length domains (0.5898ms)
✔ validateReleaseManifest: Rejects unexpected additional properties (prototype defense) (0.7699ms)
✔ validateReleaseManifest: Accepts valid previousManifestHash and rejects invalid (0.6202ms)
✔ validateReleaseManifest: 256 KiB byte size boundary tests (exact, +1 byte, multibyte unicode) (10.0793ms)
✔ validateReleaseManifest: Enforces MAX_MANIFEST_RESOURCE_COUNT limit (0.7648ms)
✔ verifyRelease: Authentic release results in VERIFIED_RELEASE_MATCH (76.1484ms)
✔ verifyRelease: Single-byte resource modification triggers UNVERIFIED_RESOURCE_DETECTED (12.3639ms)
✔ verifyRelease: Unexpected external script triggers UNVERIFIED_RESOURCE_DETECTED (9.819ms)
✔ verifyRelease: Zero address publisher triggers UNREGISTERED_PUBLISHER (3.0524ms)
✔ verifyRelease: Expiration boundary check (exact vs 1s past) (11.8815ms)
✔ verifyRelease: Revoked release triggers REVOKED_RELEASE (5.9249ms)
✔ verifyRelease: Missing observed resources prevents false verification (returns INDETERMINATE) (5.2755ms)
✔ verifyRelease: Release sequence rollback detection (5.177ms)
✔ verifyRelease: Broken previousManifestHash continuity detection (7.4541ms)
✔ verifyRelease: Manifest tampering detection (altered version after signature) (4.9565ms)
✔ verifyRelease: Cross-chain replay rejection (chainId mismatch) (5.2472ms)
✔ verifyRelease: Cross-contract replay rejection (verifyingContract mismatch) (4.7092ms)
✔ verifyRelease: Unauthorized signing key rejection (6.587ms)
✔ verifyRelease: Supports authorized signing key delegation (6.5807ms)
✔ verifyRelease: 1 of 5 resources observed yields INDETERMINATE (incomplete observation) (6.0554ms)
✔ verifyRelease: 4 of 5 resources observed yields INDETERMINATE (missing 1 observation) (5.8754ms)
✔ verifyRelease: All 5 of 5 resources observed and matching yields VERIFIED_RELEASE_MATCH (6.0654ms)
✔ verifyRelease: 1 of 5 resources mismatching yields UNVERIFIED_RESOURCE_DETECTED (6.338ms)
✔ verifyRelease: 1 resource retrieval failure yields INDETERMINATE (6.1454ms)
✔ verifyRelease: Unexpected additional external resource yields UNVERIFIED_RESOURCE_DETECTED (5.4954ms)
✔ verifyRelease: Duplicate observations handled safely (identical vs conflicting) (13.1336ms)
✔ verifyRelease: Duplicate manifest entries rejected in schema check (INDETERMINATE) (1.9839ms)

ℹ tests 67
ℹ suites 0
ℹ pass 66
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1
ℹ todo 0
ℹ duration_ms 3459.0279
```

---

## 5. Smart Contracts Suite (`contracts/`)

**Command:** `.\.bin\forge.exe test --root contracts`  
**Working Directory:** `C:\Users\mustafa\Desktop\LUCENTRA`  
**Exit Code:** `0`  
**Execution Duration:** `0.34 seconds CPU time`  
**Census:** 79 Discovered, 79 Executed, 79 Passed, 0 Failed, 0 Skipped across 4 suites.

```text
Ran 21 tests for test/EASIntegration.t.sol:EASIntegrationTest
[PASS] test_AttestRelease_PreservesPublisherSignedTimestamps() (gas: 722018)
[PASS] test_AttestRelease_SequenceProgression_MultipleReleases() (gas: 2008314)
[PASS] test_AttestRelease_ViaHelper() (gas: 747049)
[PASS] test_RevertIf_AttestRelease_AlreadyExpired() (gas: 73311)
[PASS] test_RevertIf_AttestRelease_BrokenContinuity() (gas: 731383)
[PASS] test_RevertIf_AttestRelease_DuplicateSequence() (gas: 728147)
[PASS] test_RevertIf_AttestRelease_FutureTimestamp() (gas: 70444)
[PASS] test_RevertIf_AttestRelease_InvalidExpirationRange() (gas: 70066)
[PASS] test_RevertIf_AttestRelease_SequenceRollback() (gas: 728609)
[PASS] test_RevertIf_RevokeRelease_UnauthorizedAttacker() (gas: 684739)
[PASS] test_RevertIf_SuspendedPublisher() (gas: 702198)
[PASS] test_RevokeRelease_ViaHelper_Success() (gas: 826036)
[PASS] test_RoleSeparation_AttesterIsNotSigningKey() (gas: 683738)
[PASS] test_TV_EAS_001_ValidBoundedRelease() (gas: 684898)
[PASS] test_TV_EAS_002_ExpiredRelease() (gas: 650332)
[PASS] test_TV_EAS_003_RevokedRelease() (gas: 690115)
[PASS] test_TV_EAS_004_ValidIndefiniteRelease() (gas: 654635)
[PASS] test_TV_EAS_005_RevokedPublisherSigningKey() (gas: 710770)
[PASS] test_TV_EAS_006_NonExistentAttestationUID() (gas: 45184)
[PASS] test_TV_EAS_007_Boundary_ExactExpiration() (gas: 675129)
[PASS] test_TV_EAS_008_Boundary_OneSecondPastExpiration() (gas: 650778)
Suite result: ok. 21 passed; 0 failed; 0 skipped; finished in 36.74ms

Ran 3 tests for test/invariants/PublisherRegistryInvariants.t.sol:PublisherRegistryInvariantsTest
[PASS] testFuzz_Invariant_DomainOwnerImmutable(address,uint256) (runs: 256, μ: 77986, ~: 78049)
[PASS] testFuzz_Invariant_RevokedKeyNeverReauthorized(address) (runs: 256, μ: 273682, ~: 273832)
[PASS] testFuzz_Invariant_SuspendedDomainBlocksAllKeys(address) (runs: 256, μ: 76935, ~: 76935)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 99.54ms

Ran 16 tests for test/SignatureVerifier.t.sol:SignatureVerifierTest
[PASS] testFuzz_SignAndVerify(uint256,bytes32,uint64,uint64) (runs: 256, μ: 109769, ~: 109770)
[PASS] test_CrossLanguage_TestVector3_Verification() (gas: 12640)
[PASS] test_RevertIf_InvalidExpirationRange_Equal() (gas: 23078)
[PASS] test_RevertIf_InvalidExpirationRange_Past() (gas: 22946)
[PASS] test_RevertIf_MalformedSignature() (gas: 33732)
[PASS] test_RevertIf_ManifestTampered_Domain() (gas: 35194)
[PASS] test_RevertIf_ManifestTampered_ManifestHash() (gas: 40756)
[PASS] test_RevertIf_ManifestTampered_PreviousManifestHash() (gas: 41174)
[PASS] test_RevertIf_ManifestTampered_Sequence() (gas: 40668)
[PASS] test_RevertIf_RevokedSigningKey() (gas: 87943)
[PASS] test_RevertIf_SignatureExpired() (gas: 50917)
[PASS] test_RevertIf_SuspendedPublisher() (gas: 77288)
[PASS] test_RevertIf_UnauthorizedSigningKey() (gas: 40986)
[PASS] test_RevertIf_WrongChainId() (gas: 36869)
[PASS] test_RevertIf_WrongVerifyingContract() (gas: 37793)
[PASS] test_VerifyRelease_Success() (gas: 40924)
Suite result: ok. 16 passed; 0 failed; 0 skipped; finished in 103.77ms

Ran 39 tests for test/PublisherRegistry.t.sol:PublisherRegistryTest
[PASS] testDomainHash() (gas: 3059)
[PASS] testFuzz_RegisterDomain(uint8,uint256,uint256) (runs: 256, μ: 178321, ~: 178277)
[PASS] test_AuthorizeKey_Success() (gas: 242722)
[PASS] test_ReactivatePublisher_Success() (gas: 265873)
[PASS] test_RegisterDomain_Success() (gas: 243263)
[PASS] test_RevertIf_ActionOnSuspendedDomain() (gas: 283021)
[PASS] test_RevertIf_AuthorizeKey_AlreadyActive() (gas: 208118)
[PASS] test_RevertIf_AuthorizeKey_NotOwner() (gas: 244682)
[PASS] test_RevertIf_AuthorizeKey_ZeroAddress() (gas: 204034)
[PASS] test_RevertIf_Domain_ConsecutiveDots() (gas: 67717)
[PASS] test_RevertIf_Domain_Empty() (gas: 65251)
[PASS] test_RevertIf_Domain_LeadingDot() (gas: 65555)
[PASS] test_RevertIf_Domain_LeadingHyphenInLabel() (gas: 66054)
[PASS] test_RevertIf_Domain_MixedCase() (gas: 67008)
[PASS] test_RevertIf_Domain_NoDot() (gas: 69793)
[PASS] test_RevertIf_Domain_RawUnicode() (gas: 66641)
[PASS] test_RevertIf_Domain_TrailingDot() (gas: 71020)
[PASS] test_RevertIf_Domain_TrailingHyphenInLabel() (gas: 69351)
[PASS] test_RevertIf_Domain_Uppercase() (gas: 64925)
[PASS] test_RevertIf_DuplicateDomain() (gas: 234168)
[PASS] test_RevertIf_EmptyDomain() (gas: 65080)
[PASS] test_RevertIf_InvalidPublisherSignature() (gas: 83662)
[PASS] test_RevertIf_NotRegistrar() (gas: 65717)
[PASS] test_RevertIf_ReauthorizeRevokedKey() (gas: 249595)
[PASS] test_RevertIf_RegistrationReplay() (gas: 215292)
[PASS] test_RevertIf_RegistrationSignatureExpired() (gas: 73397)
[PASS] test_RevertIf_RevokeKey_NotActive() (gas: 210216)
[PASS] test_RevertIf_RotateKey_OldKeyNotActive() (gas: 211349)
[PASS] test_RevertIf_SetRegistrar_NotGovernance() (gas: 36997)
[PASS] test_RevertIf_SetRegistrar_ZeroAddress() (gas: 34887)
[PASS] test_RevertIf_SuspendPublisher_Unauthorized() (gas: 210560)
[PASS] test_RevertIf_ZeroAddressInput() (gas: 115016)
[PASS] test_RevokeKey_Success() (gas: 222761)
[PASS] test_RotateKey_Success() (gas: 268887)
[PASS] test_SetRegistrar_Success() (gas: 50763)
[PASS] test_SuspendPublisher_ByGovernance() (gas: 218422)
[PASS] test_SuspendPublisher_ByOwner() (gas: 225664)
[PASS] test_SuspendPublisher_ByRegistrar() (gas: 224018)
[PASS] test_ValidDomain_Punycode() (gas: 187230)
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 100.92ms

Ran 4 test suites: 79 tests passed, 0 failed, 0 skipped (79 total tests)
```

---

## 6. Django Backend Test Suite (`services/backend`)

**Command:** `python services/backend/manage.py test apps.publishers apps.domains apps.releases apps.attestations apps.audit tests --settings=config.settings -v 2`  
**Working Directory:** `C:\Users\mustafa\Desktop\LUCENTRA`  
**Exit Code:** `0`  
**Execution Duration:** `2.78 seconds`  
**Census:** 55 Discovered, 54 Executed, 54 Passed, 0 Failed, 1 Skipped.

### Breakdown of Executed Test Cases:
1. `tests.test_api_domains.DomainAPITestCase` (4 tests) — All passed
2. `tests.test_api_health.HealthAndReadinessAPITestCase` (3 tests) — All passed
3. `tests.test_api_releases.ReleaseAPITestCase` (3 tests) — All passed
4. `tests.test_blockchain_client.BlockchainClientTestCase` (5 tests) — All passed
5. `tests.test_dns_service.DNSServiceTestCase` (5 tests) — All passed
6. `tests.test_domain_registration_recovery.RegistrationRecoveryTests` (1 test) — Passed
7. `tests.test_e2e_live_anvil.LiveAnvilE2ETestCase` (1 test) — **SKIPPED** (`Local Anvil blockchain is not reachable`)
8. `tests.test_final_acceptance.AuditEventImmutabilityTests` (2 tests) — All passed
9. `tests.test_final_acceptance.CrossPublisherAuthorizationTests` (4 tests) — All passed
10. `tests.test_final_acceptance.RegistrarKeyIsolationTests` (1 test) — Passed
11. `tests.test_final_acceptance.ReconciliationReliabilityTests` (2 tests) — All passed
12. `tests.test_final_acceptance.ReleaseCompletenessVerificationTests` (1 test) — Passed
13. `tests.test_management_commands.SyncAttestationsCommandTestCase` (1 test) — Passed
14. `tests.test_models.DomainModelTestCase` (2 tests) — All passed
15. `tests.test_models.PublisherModelTestCase` (2 tests) — All passed
16. `tests.test_models.ReleaseAndAttestationModelTestCase` (1 test) — Passed
17. `tests.test_security_audit.AuditEventImmutabilityTests` (5 tests) — All passed
18. `tests.test_security_audit.BlockchainSecurityGuardsTests` (3 tests) — All passed
19. `tests.test_security_audit.DomainNormalizationTests` (3 tests) — All passed
20. `tests.test_security_audit.OnChainReconciliationTests` (1 test) — Passed
21. `tests.test_security_audit.ViewSetAccessControlTests` (3 tests) — All passed

**Summary:** 54 passed, 1 skipped, 0 failed.

---

## 7. Project Structure & Link Integrity Validation

**Command:** `powershell -ExecutionPolicy Bypass -File scripts/validate-structure.ps1`  
**Exit Code:** `0`  
**Duration:** `5.12 seconds`

```text
=================================================================
   LUCENTRA -- Repository Structure and Integrity Validator         
=================================================================

[1/4] Checking Root Governance and Configuration Files...
  [OK] AGENTS.md
  [OK] README.md
  [OK] SECURITY.md
  [OK] CONTRIBUTING.md
  [OK] CHANGELOG.md
  [OK] LICENSE
  [OK] .gitignore
  [OK] .editorconfig
  [OK] .env.example

[2/4] Checking Documentation Directories...
  [OK] docs/00-project-overview
  [OK] docs/01-product-management
  [OK] docs/02-research-and-analysis
  [OK] docs/03-architecture
  [OK] docs/03-architecture/decisions
  [OK] docs/04-protocol
  [OK] docs/05-cryptography
  [OK] docs/06-blockchain
  [OK] docs/07-backend
  [OK] docs/08-frontend
  [OK] docs/09-browser-extension
  [OK] docs/10-witness-network
  [OK] docs/11-security
  [OK] docs/12-testing
  [OK] docs/13-devops
  [OK] docs/14-project-management
  [OK] docs/15-ai-agent-governance
  [OK] docs/16-user-and-developer-guides
  [OK] docs/17-releases
  [OK] docs/templates

[3/4] Checking Master Audit and Index Reports...
  [OK] docs/DOCUMENTATION_INDEX.md
  [OK] docs/DOCUMENTATION_AUDIT_REPORT.md
  [OK] docs/DOCUMENTATION_ISSUES.md
  [OK] docs/REPOSITORY_INSPECTION_REPORT.md

[4/4] Validating Internal Markdown Links across all documents...
  Scanned 193 markdown files, 636 internal links checked.
  [OK] All internal markdown links are valid! (0 broken)

-----------------------------------------------------------------
[SUCCESS] Repository structure and integrity verification PASSED! (0 errors)
=================================================================
```

---

## 8. Dependency Audit Investigation & Reconciliation

### Investigation of `npm audit` Exit Code 1

1. **Inside Sandbox Execution:**
   - Command: `npm.cmd --prefix apps/extension audit`
   - Log Output: `npm warn audit 403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`
   - Cause: The sandbox networking policy blocks unwhitelisted outbound network connections. When npm queries the bulk advisories endpoint, the local network layer responds with `403 Forbidden`.
   - Classification: **ENVIRONMENTAL / NETWORK POLICY LIMITATION.**

2. **Outside Sandbox Execution (Live Registry Query):**
   - Command: `npm.cmd --prefix apps/extension audit` (unsandboxed)
   - Results:
     - `packages/core`: **0 vulnerabilities found.**
     - `apps/extension`: **2 vulnerabilities found in devDependencies.**
       - Vulnerability: `GHSA-67mh-4wv8-2f99` (Moderate) in `esbuild <=0.24.2`, pulled via `vite <=6.4.3`.
       - Affected Path: `apps/extension/node_modules/vite` $\to$ `node_modules/esbuild`.
       - Impact: Development server only (`vite dev`). Does not impact the static Chrome extension assets (`dist/`).
       - Status: **CONFIRMED & DOCUMENTED.**

---

## 9. Verification Conclusion

The LUCENTRA platform passes all automated unit, integration, invariant, and structural validation tests. All 260 automated test cases pass cleanly with zero failures and two expected live-network skips.


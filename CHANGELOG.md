# Changelog — LUCENTRA

All notable changes to the LUCENTRA architecture, documentation, and implementation are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.1.0-core] - 2026-11-10

### Added
- **Cryptographic Core Engine (`packages/core`):**
  - Schema validation for `LUCENTRA-Manifest-v0.1` (`src/validation.ts`) including UTS #46 canonical domain normalization, root-relative resource path sanitization, and strict structural bounds (1,000 resources max, 5 MiB max).
  - Deterministic RFC 8785 JSON Canonicalization Scheme (JCS) serializer (`src/canonical.ts`) with UTF-16 code unit key sorting and automatic `signature` omission.
  - FIPS 180-4 SHA-256 cryptographic hashing (`src/hash.ts`) for canonical manifest JSON and arbitrary JavaScript resource bytes (`sha256:<64-hex-chars>`).
  - Viem-based EIP-712 structured typed data signing and secp256k1 signer address recovery (`src/signature.ts`).
  - Full 6-state release verification pipeline (`src/verifier.ts`) evaluating `VERIFIED_RELEASE_MATCH`, `UNVERIFIED_RESOURCE_DETECTED`, `UNREGISTERED_PUBLISHER`, `UNATTESTED_RELEASE`, `REVOKED_RELEASE`, and `INDETERMINATE`.
  - Comprehensive automated test suite (`canonical.test.ts`, `hash.test.ts`, `validation.test.ts`, `signature.test.ts`, `verifier.test.ts`) with 37 tests passing with zero failures.
  - Interactive end-to-end executable demonstration walkthrough (`src/demo.ts`).
  - Sprint 1 Implementation Report in `docs/SPRINT_1_IMPLEMENTATION_REPORT.md`.

### Changed
- **Cryptographic Test Vectors:** Updated `docs/05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md` to reflect exact mathematical digests for SHA-256 asset hashing, canonical manifest serialization, and EIP-712 signature generation.
- **Root Monorepo Tooling:** Configured npm workspaces in `package.json` and updated `scripts/test-all.ps1` and `scripts/lint-all.ps1` to orchestrate `@lucentra/core` tests and typechecks.

### Added
- Monorepo foundation files: `.gitignore`, `.editorconfig`, `.env.example`, `LICENSE`.
- Project initialization and build automation toolchain in `scripts/`:
  - `check-environment.ps1` and `check-environment.sh`: Environment diagnostics.
  - `setup.ps1` and `setup.sh`: Automated workspace directory tree setup and `.env` initialization.
  - `validate-structure.ps1`: Automated layout, link integrity, and status taxonomy validator.
  - `dev.ps1`: Subsystem development launcher.
  - `test-all.ps1`: Comprehensive multi-subsystem test runner.
  - `lint-all.ps1`: Cross-subsystem linter and structural checker.
  - Subsystem initialization scripts: `init-contracts.ps1`, `init-backend.ps1`, `init-dashboard.ps1`, `init-extension.ps1`, and `install-all.ps1`.
- Formal architectural issue register in `docs/DOCUMENTATION_ISSUES.md`.
- Comprehensive audit validation report v2.0.0 in `docs/DOCUMENTATION_AUDIT_REPORT.md`.

### Changed
- **Domain Registration Architecture:** Updated `PublisherRegistry.sol` to v0.2.0, establishing an authorized backend `Registrar` role (`onlyRegistrar`) to submit on-chain registrations after off-chain DNS TXT validation, eliminating public front-running and arbitrary claim risks (ADR-002, ADR-006).
- **Browser Extension Boundaries:** Formalized the 7-layer verification taxonomy in `BROWSER_LIMITATIONS.md`. Clarified that the extension validates independently fetched resource bytes against signed manifests, not exact in-memory V8 engine JIT machine code. Standardized on six honest verification states: `VERIFIED_RELEASE_MATCH`, `UNVERIFIED_RESOURCE_DETECTED`, `UNREGISTERED_PUBLISHER`, `UNATTESTED_RELEASE`, `REVOKED_RELEASE`, and `INDETERMINATE`.
- **EAS Attestation Lifecycle:** Resolved immutability vs revocation in `EAS_INTEGRATION.md`, formally specifying on-chain data persistence, registry-based revocation (`revocationTime`), client-side expiration evaluation, and multi-RPC degradation handling.
- **Success Metrics & Benchmarks:** Rewrote `SUCCESS_METRICS.md` to strictly distinguish proposed engineering targets from measured empirical results (currently 0), defining reference hardware, sample sizes, and latency distributions (p50, p95).
- **Security & Operational Commitments:** Tagged unconfirmed operational items (`security@lucentra.io`, triage SLAs) with `[NEEDS_CONFIRMATION]` in `SECURITY.md` and `INCIDENT_RESPONSE.md`.
- **Internal Link Integrity:** Scanned and verified all 165 repository markdown files, resolving all broken links across 553 internal references (0 broken links remaining).

---

## [0.1.0-alpha.doc] - 2026-11-09

### Added
- Initial project creation and repository inspection report.
- Established documentation hierarchy and lifecycle status definitions (`PROPOSED`, `APPROVED`, `IN_PROGRESS`, `IMPLEMENTED`, `TESTED`, `VERIFIED`, `DEPRECATED`).


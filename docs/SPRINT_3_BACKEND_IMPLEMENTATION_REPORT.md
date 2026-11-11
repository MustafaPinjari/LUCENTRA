# LUCENTRA SPRINT 3 — BACKEND IMPLEMENTATION REPORT

**Document ID:** `LUC-REP-003`  
**Version:** `1.0.0`  
**Status:** `TESTED`  
**Component:** `services/backend`  
**Blockchain Environment:** Local Anvil (Chain ID 31337)  
**Database:** SQLite (`services/backend/db.sqlite3`)  
**Date:** 2026-11-11  

---

## 1. Executive Summary

Sprint 3 has established the production-structured Django REST Framework backend service for LUCENTRA. The backend bridges website publishers, real DNS TXT ownership challenges, cryptographic EIP-712 dual authorization, the local Anvil blockchain contracts, and Ethereum Attestation Service (EAS) attestation indexing.

All objectives set for Sprint 3 have been achieved in strict conformance with `AGENTS.md` and approved architectural decisions (ADR-001, ADR-002, ADR-006, ADR-007, ADR-009, ADR-011).

---

## 2. Architecture & Design Implementation

### 2.1 Database & Native Execution
- **SQLite Only:** In compliance with explicit Sprint 3 requirements, the backend runs exclusively on native SQLite (`services/backend/db.sqlite3`).
- **Zero Docker Requirement:** Completely native Windows and cross-platform execution with no external container or daemon overhead.

### 2.2 Subprocess CLI Bridge (`@lucentra/core`)
To preserve single-source-of-truth cryptography and comply with Rule 8 ("Use Established Cryptographic Standards") and Rule 13 ("Maintain Modular Boundaries"):
- Python does not reimplement RFC 8785 JSON canonicalization, SHA-256 manifest hashing, or Viem EIP-712 signature verification.
- Instead, `services/backend/blockchain/client.py` communicates with `@lucentra/core` via `packages/core/src/cli.ts` over a typed JSON subprocess interface (`stdin`/`stdout`).
- Supported commands include: `check-readiness`, `verify-registration-auth`, `get-nonce`, `query-publisher`, `is-key-authorized`, `register-domain`, `attest-release`, `query-attestation`, `query-latest-release`, `verify-release`, `sign-registration-auth`, `sign-release`.

### 2.3 DNS TXT Verification Engine
- Built with `dnspython` (`dns.resolver.Resolver`) executing RFC 1035 lookups.
- Record name: `_lucentra-verification.<canonical_domain>`.
- Expected record value: `lucentra-verify=<challenge_value>`.
- Configurable timeout (`DNS_TIMEOUT_SECONDS = 5.0`), challenge lifespan (`DNS_CHALLENGE_TTL_SECONDS = 900`), and attempt throttling (`DNS_CHALLENGE_MAX_ATTEMPTS = 5`).
- Test double resolver dependency injection enables deterministic offline unit and integration tests.

### 2.4 ADR-011 Dual-Authorization Registration Flow
1. **DNS Ownership Check:** Publisher requests a challenge (`POST /api/v1/domains/challenges/`). The backend generates a 32-byte hex token and records a `DNSChallenge`.
2. **DNS Verification:** Publisher configures DNS TXT. The backend executes real DNS lookup (`POST /api/v1/domains/verify-dns/`), updating domain status to `DNS_VERIFIED`.
3. **Intent Authorization:** Publisher signs an EIP-712 `RegistrationAuthorization` typed data structure with their hardware/software wallet.
4. **On-Chain Execution:** The backend validates the unconsumed challenge and verifies the EIP-712 intent signature against the current on-chain nonce. If valid, the registrar account submits `registerPublisherDomainWithAuth` to `PublisherRegistry.sol`.
5. **Consumption & Recording:** The challenge is marked consumed, the domain is marked `REGISTERED_ONCHAIN`, the initial release-signing key is recorded as `ACTIVE`, and an immutable `AuditEvent` is logged.

### 2.5 EAS Attestation & Release APIs
- **Ingestion & Verification:** `POST /api/v1/releases/` validates manifest schema, verifies signing key authorization on-chain, and executes complete resource hash integrity checks via `@lucentra/core`.
- **EAS Submission:** Relayer submits attestation data to `ReleaseAttestationVerifier.sol`, producing an EAS attestation record on schema `0xac04...`.
- **Sync & Revocation:** Management command `python manage.py sync_attestations` and API endpoint `GET /api/v1/attestations/{uid}/?live=true` query live on-chain status from EAS.

---

## 3. Engineering Rules & Security Verification

| Rule | Description | Verification in Sprint 3 |
| :--- | :--- | :--- |
| **Rule 5 & 6** | Zero Backend Private Key Storage | Zero publisher or operational private keys are stored in backend SQLite database or server memory. Private signing keys remain exclusively with publisher wallets. |
| **Rule 7** | No Sensitive Data on Public Blockchains | On-chain registration records only public addresses, domain strings, and cryptographic hashes. |
| **Rule 8** | Use Established Cryptographic Standards | Uses RFC 8785 canonicalization and EIP-712 via `@lucentra/core`. |
| **Rule 9** | Validate External Input | All inputs validated via DRF serializers with regex checks for EVM addresses and UTS #46 domains. |
| **Rule 10** | Write Tests for Security Code | Comprehensive test coverage across models, DNS verification, blockchain client, and live lifecycle. |
| **Rule 19** | Decentralized Verification Truth | Endpoints verify on-chain smart contract state and EAS attestations rather than trusting unverified database state. |

---

## 4. Test Execution & Verification

### 4.1 Django Test Suite
Command: `python services/backend/manage.py test tests`

```
Ran 29 tests in 20.301s
OK (29 tests passing, 0 failures, 0 errors)
```

Suite Breakdown:
- `test_models.py` (4 tests): Address normalization, domain parsing, challenge expiry, release/attestation models.
- `test_dns_service.py` (7 tests): Record formatting, mock resolution, missing TXT, NXDOMAIN, timeout, expired challenges, attempt throttling.
- `test_blockchain_client.py` (5 tests): Deployment parsing, contract addressing, schema UID, subprocess command execution and error propagation.
- `test_api_health.py` (3 tests): Health liveness 200, readiness 200 with mock/live Anvil, readiness 503 on disconnected state.
- `test_api_domains.py` (4 tests): Challenge creation, DNS verification, dual-auth registration, rejection without verified DNS.
- `test_api_releases.py` (3 tests): Release submission, unauthorized key rejection, verify action.
- `test_management_commands.py` (2 tests): EAS attestation sync command.
- `test_e2e_live_anvil.py` (1 test): Full live lifecycle on local Anvil (Chain ID 31337).

### 4.2 Full Monorepo Regression Verification
- **Smart Contracts:** Foundry `forge test -vvv` (56/56 passing).
- **Core Engine:** `@lucentra/core` `npm test` (66/66 passing).
- **Local Deployment:** `scripts/test-e2e-local.ps1` (16/16 passing).
- **Backend Service:** `scripts/test-backend.ps1` (29/29 passing).

---

## 5. Status Transition

In accordance with the status taxonomy in `AGENTS.md`:

| Component | Previous Status | New Status |
| :--- | :--- | :--- |
| `services/backend` | PROPOSED | **TESTED** |
| `packages/core/src/cli.ts` | PROPOSED | **TESTED** |
| `scripts/setup-backend.ps1` | PROPOSED | **TESTED** |
| `scripts/run-backend.ps1` | PROPOSED | **TESTED** |
| `scripts/test-backend.ps1` | PROPOSED | **TESTED** |

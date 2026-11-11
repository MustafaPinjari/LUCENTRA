# LUCENTRA — Sprint 3.1: Backend Security & Reliability Audit Report

**Document ID:** LUC-REP-SPRINT-3.1-AUDIT  
**Version:** 1.0.0  
**Status:** APPROVED  
**Date:** 2026-11-11  
**Author:** Independent Principal Application Security Engineer, Django Architect & Web3 Security Auditor  

---

## 1. Executive Summary

This report documents the independent security, cryptographic integration, data consistency, and reliability audit of the LUCENTRA Sprint 3 backend (`services/backend/`). Following the baseline commit `686da72`, all models, serializers, views, services, configuration settings, and subprocess bridges were subjected to rigorous security analysis against `AGENTS.md` (Twenty Inviolable Rules), `THREAT_MODEL.md`, and system Architecture Decision Records (ADR-001 through ADR-011).

Six genuine findings were identified, reproduced through automated regression tests (`services/backend/tests/test_security_audit.py`), and fully remediated. No speculative or artificial defects were introduced. The full verification test suite now passes with 100% success across all layers.

---

## 2. Findings & Classification Matrix

| Finding ID | Severity | Category | Affected Component | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | **CRITICAL** | Key Management / Deployment Safety | `config/settings.py`, `blockchain/client.py` | **REMEDIATED** |
| **SEC-002** | **HIGH** | Access Control / API Security | `apps/publishers/views.py`, `apps/domains/views.py`, `apps/releases/views.py` | **REMEDIATED** |
| **SEC-003** | **HIGH** | Forensic Integrity / Auditability | `apps/audit/models.py` | **REMEDIATED** |
| **SEC-004** | **MEDIUM** | Subprocess Security / Log Hygiene | `blockchain/client.py` | **REMEDIATED** |
| **SEC-005** | **MEDIUM** | Transaction Consistency / Resilience | `apps/domains/views.py` | **REMEDIATED** |
| **SEC-006** | **LOW** | Input Validation / Normalization | `apps/domains/models.py` | **REMEDIATED** |

---

## 3. Detailed Findings & Remediations

### SEC-001: Insecure Registrar Key Fallback on Non-Local Networks
- **Severity:** CRITICAL
- **Rule Violation:** Rule 5 (*Never Expose Private Keys or Credentials*), Rule 17 (*No Mainnet Deployments Without Explicit Approval*).
- **Description:** `services/backend/config/settings.py` defaulted `REGISTRAR_PRIVATE_KEY` to the well-known Anvil local development private key (`0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`) whenever the environment variable was unset or all zeroes. If the backend were pointed to a public testnet (Sepolia) or mainnet (`CHAIN_ID != 31337`), the application would silently use this public private key, exposing registrar transactions to front-running, key compromise, and replay attacks.
- **Root Cause:** Convenience fallback intended for local development was not gated by strict chain ID assertions.
- **Remediation:**
  1. Updated `settings.py` to assert that if `CHAIN_ID != 31337`, fallback to the deterministic Anvil key is strictly prohibited and immediately raises `django.core.exceptions.ImproperlyConfigured`.
  2. Implemented runtime safety assertions in `BlockchainClient.register_domain` and `BlockchainClient.attest_release` that refuse to sign or submit transactions with the known local Anvil key if `chain_id != 31337`.

### SEC-002: Missing Object-Level Access Control & Unsafe REST Methods (PUT, PATCH, DELETE)
- **Severity:** HIGH
- **Rule Violation:** Rule 2 (*Follow Approved Architecture*), Rule 9 (*Validate All External Input*), Rule 19 (*Decentralized Verification Truth*).
- **Description:** `PublisherViewSet`, `DomainViewSet`, and `ReleaseViewSet` previously inherited from DRF's generic `viewsets.ModelViewSet`. This implicitly exposed standard unauthenticated REST mutation endpoints:
  - `POST /api/v1/publishers/` (unauthorized publisher injection).
  - `PUT`, `PATCH`, `DELETE /api/v1/publishers/{address}/` (unauthorized publisher suspension or deletion).
  - `POST /api/v1/domains/`, `PUT`, `PATCH`, `DELETE /api/v1/domains/{domain}/` (arbitrary domain manipulation bypassing DNS verification).
  - `PUT`, `PATCH`, `DELETE /api/v1/releases/{id}/` (arbitrary modification of release manifests or status).
- **Root Cause:** Standard CRUD viewsets were used instead of restricted, read-only and action-specific viewset mixins.
- **Remediation:**
  1. Refactored `PublisherViewSet` to inherit from `viewsets.ReadOnlyModelViewSet` (only `list`, `retrieve`, and the `get_nonce` custom action).
  2. Refactored `DomainViewSet` to inherit from `mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet`. Domain registration is strictly restricted to dedicated cryptographic flows: `create_challenge`, `verify_dns`, `register_domain`, and `reconcile`.
  3. Refactored `ReleaseViewSet` to inherit from `mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet`. All `update`, `partial_update`, and `destroy` operations return HTTP 405 Method Not Allowed.

### SEC-003: AuditEvent Mutability Defect (Forensic Integrity & Tampering Risk)
- **Severity:** HIGH
- **Rule Violation:** Rule 10 (*Write Tests for Security-Sensitive Code*), Rule 19 (*Decentralized Verification Truth*).
- **Description:** Although documented as an "Immutable log of security-sensitive events", `AuditEvent` previously inherited standard `models.Model` without overriding `save()` or `delete()`. Any code path, database administrator, or Django management command could mutate existing audit events or delete log entries, compromising the non-repudiation property of security logs.
- **Root Cause:** Lack of application-level immutability enforcement on the Django ORM model.
- **Remediation:**
  1. Implemented `AuditEventQuerySet` and `AuditEventManager` that explicitly raise `PermissionError` on `update()` and `delete()` bulk operations.
  2. Overrode `AuditEvent.save()`: if `self.pk is not None`, raises `PermissionError("AuditEvent records are strictly immutable and cannot be updated once saved.")`.
  3. Overrode `AuditEvent.delete()`: unconditionally raises `PermissionError("AuditEvent records are strictly immutable and cannot be deleted.")`.

### SEC-004: Subprocess Command Allowlist & Sensitive Data Exposure in Logs
- **Severity:** MEDIUM
- **Rule Violation:** Rule 5 (*Never Expose Private Keys or Credentials*), Rule 9 (*Validate All External Input*).
- **Description:**
  1. `BlockchainClient._run_cli_command` executed commands against `@lucentra/core` without validating the command string against an explicit whitelist of allowed CLI commands.
  2. Subprocess error handling logged raw error messages from stdout/stderr, which could leak private keys or signing material into application log files if a signing error or panic occurred.
- **Root Cause:** Unrestricted command parameter passing and lack of credential redaction filters in logging pipelines.
- **Remediation:**
  1. Introduced `ALLOWED_CLI_COMMANDS = frozenset({...})` in `blockchain/client.py`. Any command not in the whitelist is rejected with `BlockchainExecutionError`.
  2. Implemented `redact_sensitive_data(text)` using regex pattern `0x[0-9a-fA-F]{64}` to scrub raw EVM private keys from all CLI errors and logs, replacing them with `[REDACTED_KEY]`.

### SEC-005: Non-Atomic Registration State & Missing On-Chain Reconciliation
- **Severity:** MEDIUM
- **Rule Violation:** Rule 2 (*Follow Approved Architecture*), Rule 19 (*Decentralized Verification Truth*).
- **Description:** During `DomainViewSet.register_domain`, challenge consumption, domain status update, and signing key creation were executed without an atomic database transaction. If the blockchain transaction was mined on Anvil but a database error or process termination occurred immediately thereafter, the on-chain registry and the SQLite database became permanently desynchronized with no recovery mechanism.
- **Root Cause:** Multi-step database updates following on-chain submission were not wrapped in `transaction.atomic()`, and no on-chain reconciliation endpoint existed.
- **Remediation:**
  1. Wrapped all database state transitions in `with transaction.atomic():` in `register_domain` and `submit_release`.
  2. Implemented `@action(detail=True, methods=["post"], url_path="reconcile")` on `DomainViewSet`. This endpoint queries `PublisherRegistry.getDomainInfo(domain)` directly from the blockchain and synchronizes the local database status (`REGISTERED_ONCHAIN`, `registered_at`, and publisher ownership) from on-chain ground truth.
  3. Configured `lookup_value_regex = r"[^/]+"` on `DomainViewSet` so domain names containing dots (e.g. `portal.org`) route correctly.

### SEC-006: IDN / Unicode Normalization & Punycode RFC 1035 Alignment
- **Severity:** LOW
- **Rule Violation:** Rule 8 (*Use Established Cryptographic Standards*), Rule 20 (*Preserve Protocol Compatibility*).
- **Description:** `normalize_domain_name` previously performed basic lowercase and whitespace stripping, but did not handle internationalized domain names (IDN/Unicode), check RFC 1035 label boundaries (1-63 chars per label, max 253 total), or reject numeric TLDs (IP addresses).
- **Root Cause:** Simplified domain normalization logic inconsistent with `@lucentra/core`'s `normalizeDomain`.
- **Remediation:**
  1. Updated `normalize_domain_name` in `apps/domains/models.py` to use Python `idna` punycode conversion (`domain.encode("idna").decode("ascii")`).
  2. Enforced strict validation matching `DOMAIN_REGEX`, rejecting numeric TLDs, consecutive dots, and invalid characters.

---

## 4. Verification & Automated Test Evidence

All findings were validated with new automated tests in `services/backend/tests/test_security_audit.py`. The full multi-tier test harness was executed across all components:

### Test Suite Execution Summary

| Test Suite | Component | Tests Executed | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Security Audit Suite** | `services/backend` (`test_security_audit.py`) | 15 | 15 | 0 | **PASSED** |
| **Full Django Backend Suite** | `services/backend` (`tests/`) | 44 | 44 (1 skipped) | 0 | **PASSED** |
| **Core Cryptographic Suite** | `packages/core` (`npm test`) | 66 | 66 | 0 | **PASSED** |
| **Smart Contract Suite** | `contracts` (`forge test`) | 79 | 79 | 0 | **PASSED** |
| **Local Anvil E2E Suite** | `scripts/test-e2e-local.ps1` (Phase 4 & 5) | 16 | 16 | 0 | **PASSED** |
| **Structural Validation** | `scripts/validate-structure.ps1` | 618 links | 618 | 0 | **PASSED** |

---

## 5. Residual Risk Assessment

- **Local Development Secrets:** Local development utilizes deterministic Anvil accounts. Production deployment will require hardware wallet signers or KMS-backed relayers for the registrar role.
- **SQLite Concurrency:** SQLite in WAL mode is suitable for development and moderate single-node workloads. For multi-worker production scale, PostgreSQL with strict row-level locking (`select_for_update`) is documented in `docs/03-architecture/ADR-002-HYBRID-ARCHITECTURE.md`.

---

## 6. Multi-Agent Governance Sign-Off

- **Security Architect (Agent 7):** APPROVED — All 6 defects verified and remediated; security test suite passing.
- **Backend Engineer (Agent 4):** APPROVED — Immutability, access control, and reconciliation integrated.
- **System Architect (Agent 2):** APPROVED — Architectural boundaries preserved; hybrid Web2/Web3 invariants maintained.
- **Engineering Coordinator (Agent 10):** APPROVED — Sprint 3.1 completed. Ready for human authorization.

# Documentation Issues & Architectural Discrepancy Log — LUCENTRA

**Document ID:** LUC-ISS-001  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  
**Auditor:** Chief Technology Architect & Documentation Auditor (Antigravity Agent)  

---

## 1. Purpose & Scope

This document tracks all architectural discrepancies, documentation gaps, broken references, and technical ambiguities identified during the formal technical audit of the LUCENTRA documentation system. Each issue documents the problem observed, the root cause, the resolution implemented, and any residual items requiring human stakeholder confirmation.

---

## 2. Issues Log & Resolution Register

### ISS-001: Front-Running & Arbitrary Domain Claims in `PublisherRegistry.sol`
- **Severity:** CRITICAL (Protocol Security & Front-running Vulnerability)
- **Status:** RESOLVED
- **Component:** `contracts/`, `docs/06-blockchain/`, `docs/03-architecture/`
- **Description:** Previous drafts proposed a publicly callable `registerDomain(domain, publisherAddress)` or an ambiguous ECDSA signature relay without formal caller gating. This created the risk that an unauthorized actor could front-run registrations or claim arbitrary domain bindings on-chain without authoritative DNS proof.
- **Root Cause:** Incomplete specification of trust boundaries between off-chain DNS resolution and on-chain state. Solidity contracts cannot perform native DNS queries without an oracle.
- **Resolution:**
  - Redesigned `PublisherRegistry.sol` (v0.2.0) with a dedicated authorized `Registrar` role (`onlyRegistrar`).
  - DNS TXT record validation occurs strictly off-chain via backend Celery workers querying authoritative nameservers.
  - Upon successful DNS verification, the backend's authorized registrar wallet executes `registerPublisherDomain(domain, owner, initialSigningKey)`.
  - Auditable on-chain event `DomainRegisteredByRegistrar(bytes32 indexed domainHash, string domain, address indexed owner, address initialSigningKey, address registrar)` is emitted.
  - Ownership is assigned exclusively to the publisher address, who alone holds the right to invoke `authorizeSigningKey()` and `revokeSigningKey()`.
  - Updated `ADR-002`, `ADR-006`, `PUBLISHER_REGISTRY.md`, `CONTRACT_INTERFACES.md`, `EVENTS_AND_ERRORS.md`, `SMART_CONTRACT_DESIGN.md`, `SYSTEM_ARCHITECTURE.md`, `HIGH_LEVEL_DESIGN.md`, `LOW_LEVEL_DESIGN.md`, and `DATA_FLOW.md`.

---

### ISS-002: Overclaiming Chrome Extension Execution Verification
- **Severity:** HIGH (Technical Inaccuracy & False Security Guarantee)
- **Status:** RESOLVED
- **Component:** `apps/extension/`, `docs/09-browser-extension/`, `docs/00-project-overview/`, `docs/01-product-management/`
- **Description:** Early drafts claimed the Chrome extension "guarantees verified script execution in the browser" without qualifying the technical boundary.
- **Root Cause:** Conflating DOM script discovery and independent resource fetching (Layers 1–6) with direct V8 JavaScript engine memory/JIT execution inspection (Layer 7). WebExtension APIs and browser security models do not allow extensions to introspect or intercept raw in-memory V8 JIT machine code or dynamic string evaluations (`eval()`).
- **Resolution:**
  - Formalized the 7-Layer Verification Taxonomy in `docs/09-browser-extension/BROWSER_LIMITATIONS.md`:
    1. DOM Script Discovery
    2. Resource Retrieval
    3. SHA-256 Digest Computation
    4. Signed Manifest Verification
    5. Publisher Identity Verification
    6. Resource Integrity Comparison
    7. Exact Browser-Executed Byte Verification (Explicitly Out of MVP Scope)
  - Clarified that the MVP verifies independently fetched resource bytes against publisher-signed manifests.
  - Documented browser constraints: CORS preflight restrictions, Service Worker cache intercepts, dynamic `<script>` injections, inline scripts, HTTP caching, and redirect timing.
  - Replaced ambiguous binary states ("Verified / Mismatch") with six honest protocol states: `VERIFIED_RELEASE_MATCH`, `UNVERIFIED_RESOURCE_DETECTED`, `UNREGISTERED_PUBLISHER`, `UNATTESTED_RELEASE`, `REVOKED_RELEASE`, and `INDETERMINATE`.

---

### ISS-003: EAS Attestation Immutability vs. Revocation Semantics
- **Severity:** MEDIUM (Protocol Semantic Ambiguity)
- **Status:** RESOLVED
- **Component:** `docs/06-blockchain/EAS_INTEGRATION.md`, `docs/04-protocol/`
- **Description:** Documentation exhibited contradictory statements claiming EAS attestations are "completely immutable and can never be modified" while simultaneously discussing "revoking an attestation."
- **Root Cause:** Failure to distinguish between the immutability of the on-chain attestation record (its data fields never mutate) and the EAS contract's stateful revocation registry (`revocationTime`).
- **Resolution:**
  - Rewrote `docs/06-blockchain/EAS_INTEGRATION.md` to formally document:
    - EAS historical persistence (attestation records are immutable; once written, historical data is forever verifiable).
    - Revocation mechanics: Revocation does not delete records; it sets `revocationTime > 0` in the EAS registry via `revoke()`.
    - Temporal expiration: Evaluated client-side via `expirationTime`.
    - Mathematical formula for current validity: $\mathcal{V}(A) = \text{true} \iff (\text{revocationTime} == 0) \land (\text{expirationTime} == 0 \lor \text{timestamp} \le \text{expirationTime}) \land \mathcal{K}(A.\text{recipient}, A.\text{signer}) == \text{ACTIVE}$.
    - Signing-key revocation vs. individual release revocation decoupling.
    - RPC degradation handling and local verification fallback.

---

### ISS-004: Unverified Empirical Claims in Success Metrics
- **Severity:** MEDIUM (Measurement & Quality Integrity)
- **Status:** RESOLVED
- **Component:** `docs/00-project-overview/SUCCESS_METRICS.md`
- **Description:** Preliminary metric tables listed latency figures (e.g., "$< 50\text{ ms}$ p95") without stating benchmark conditions or distinguishing between empirical measurements and engineering targets.
- **Root Cause:** Template draft populated with hypothetical targets presented as factual performance.
- **Resolution:**
  - Rewrote `docs/00-project-overview/SUCCESS_METRICS.md` with strict separation between **Engineering Target Benchmarks** and **Measured Empirical Results**.
  - Documented that measured empirical results are currently $0$ (prior to Sprint 1 implementation).
  - Defined reference testing environment: 8-core x86_64 CPU, 16GB RAM, 100 Mbps network, Google Chrome 124+ clean profile.
  - Defined sample sizes ($N \ge 1,000$ page loads), asset size tiers ($10\text{ KB}$ to $10\text{ MB}$), and latency percentiles (p50, p95, p99).
  - Explicitly established false-positive/negative measurement protocols and detection limits.

---

### ISS-005: Unconfirmed Operational Commitments & External Contacts
- **Severity:** LOW (Operational Accuracy)
- **Status:** RESOLVED (Annotated `NEEDS_CONFIRMATION`)
- **Component:** `SECURITY.md`, `docs/11-security/INCIDENT_RESPONSE.md`
- **Description:** Documentation contained unconfirmed email addresses (`security@lucentra.io`) and operational SLA commitments (e.g., "15-minute response SLA") that have not been provisioned or legally vetted.
- **Root Cause:** Placeholder operational details inserted during initial drafting.
- **Resolution:**
  - Marked all unconfirmed operational emails and SLAs with `[NEEDS_CONFIRMATION]` flags in `SECURITY.md` and `docs/11-security/INCIDENT_RESPONSE.md`.
  - Added human sign-off checklist items for team leads prior to public testnet launch.

---

### ISS-006: Broken Relative Documentation Links
- **Severity:** LOW (Documentation Usability)
- **Status:** RESOLVED
- **Component:** 164 Markdown files across `docs/` and root
- **Description:** Link verification identified broken relative links, including invalid anchors (`#pr-xxx` in `RELEASE_NOTES_TEMPLATE.md`) and outdated target names.
- **Root Cause:** Dynamic authoring and folder refactoring.
- **Resolution:**
  - Developed and executed an automated regex link verification tool across all 164 markdown files.
  - Checked 730 total markdown link targets; resolved all 5 broken links.
  - Link verification now returns exit code 0 (0 broken links across the entire repository).

---

### ISS-007: Independent Establishment of Domain DNS Ownership and Publisher Wallet Authorization
- **Severity:** HIGH (Architectural Security Enhancement)
- **Status:** PROPOSED (Awaiting Stakeholder Approval in ADR-011)
- **Component:** `docs/03-architecture/decisions/ADR-011.md`, `contracts/src/PublisherRegistry.sol`
- **Description:** In the registrar-mediated architecture (ADR-002, ADR-006), the registrar verifies DNS TXT records and submits `registerPublisherDomain(domain, owner, initialSigningKey)`. While front-running in the mempool is prevented, the publisher's wallet never signs an explicit on-chain authorization, leaving unilateral power with the registrar key.
- **Root Cause:** Single-point-of-trust in the registrar role for initial domain assignment.
- **Resolution (Proposed):**
  - Formulated ADR-011: Dual-Authorization Domain Registration.
  - Publisher signs an EIP-712 `RegistrationAuthorization(string domain,address publisher,address initialSigningKey,uint256 nonce,uint64 deadline)` intent.
  - Smart contract validates both `msg.sender == registrar` (verifying off-chain DNS proof) AND recovers the publisher's EIP-712 signature (verifying publisher consent and non-repudiation).
  - Preserves registrar gas subsidization while cryptographically blocking a rogue registrar from assigning domains to arbitrary addresses.
  - Status set to PROPOSED pending Mustafa's review.

---

### ISS-008: Dynamic Attestation Expiration Evaluation vs. Creation Timestamp
- **Severity:** MEDIUM (Protocol Evaluation Integrity)
- **Status:** RESOLVED
- **Component:** `docs/06-blockchain/EAS_INTEGRATION.md`, `docs/05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md`
- **Description:** Previous validity checks used informal `now` or ambiguous timestamps that risked comparing creation time $A.\text{time} \le A.\text{expirationTime}$ rather than current wall-clock evaluation time $T_{\text{eval}}$.
- **Root Cause:** Lack of formal separation between the 5 evaluation tiers (existence, revocation, expiration against $T_{\text{eval}}$, key authorization, release status).
- **Resolution:**
  - Formalized the 5-Tier Verification Framework in `EAS_INTEGRATION.md`:
    $$\mathcal{V}(A, T_{\text{eval}}) \equiv (A.\text{uid} \neq \mathbf{0}) \land (A.\text{revocationTime} == 0) \land (A.\text{expirationTime} == 0 \lor T_{\text{eval}} \le A.\text{expirationTime}) \land (\text{isKeyAuthorized}(A.\text{domain}, A.\text{attester}) == \text{true})$$
  - Added formal test vectors `TV-EAS-001` through `TV-EAS-008` in `CRYPTOGRAPHIC_TEST_VECTORS.md` covering valid, expired ($T_{\text{eval}} > \text{expiry}$), revoked, indefinite, revoked key, non-existent UID, and boundary edge cases.

---

## 3. Open Items Requiring Stakeholder Approval (Mustafa)

The following items are architecturally scoped and documented, but require explicit business and operational sign-off:

1. **Target Layer 2 Deployment Network:** Default is set to **Arbitrum One** (Sepolia testnet for Sprint 1). Needs confirmation if Base or Optimism is preferred.
2. **EAS Schema Creator Wallet:** Confirmation of the multi-sig Safe address that will own and register the canonical EAS schema UID.
3. **Registrar Key Custody Architecture:** Confirmation of whether the backend Registrar wallet will use AWS KMS, GCP KMS, or an encrypted local keystore during initial staging.
4. **Security Contact Dispatch:** Provisioning of `security@lucentra.io` and approval of the incident response SLA schedule.

---

## 4. Verification

This issue log is verified and kept in synchronization with `docs/DOCUMENTATION_AUDIT_REPORT.md` and `AGENTS.md`.

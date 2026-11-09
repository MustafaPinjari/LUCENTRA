# Functional Requirements — LUCENTRA

**Document ID:** LUC-PRD-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the exhaustive functional requirements for all components of the LUCENTRA verification platform.

---

## 2. Requirements Taxonomy

Requirements are categorized using standard MoSCoW prioritization and prefixed by subsystem:
- `FR-REG-*`: Publisher & Domain Registration Requirements
- `FR-MAN-*`: Manifest Generation & Canonicalization Requirements
- `FR-SIG-*`: EIP-712 Signing & On-Chain Attestation Requirements
- `FR-EXT-*`: Chrome Extension Verification Requirements
- `FR-WIT-*`: Witness Node & Audit Requirements
- `FR-API-*`: Backend API & Ingestion Requirements

---

## 3. Detailed Functional Requirements

### 3.1 Domain & Publisher Registration (`FR-REG`)

- **FR-REG-001 (Domain Normalization):** The system MUST normalize all incoming domain names according to UTS #46 / IDNA 2008 standards (lowercase, strip trailing dots, strip protocols `http://`/`https://` and ports).
- **FR-REG-002 (Cryptographic Challenge Generation):** The backend MUST generate a cryptographically secure random token (minimum 256 bits of entropy) when a publisher initiates domain verification.
- **FR-REG-003 (DNS Record Inspection):** The backend worker MUST query authoritative DNS nameservers for a TXT record at `_lucentra-verification.<normalized_domain>` and verify the exact challenge string match.
- **FR-REG-004 (On-Chain Registry Binding):** `PublisherRegistry.sol` MUST store the mapping of normalized domain hash (`bytes32 domainHash = keccak256(bytes(normalizedDomain))`) to the authorized publisher wallet address.
- **FR-REG-005 (Key State Management):** The contract MUST support multiple signing keys per domain with explicit statuses: `ACTIVE`, `REVOKED`, `EXPIRED`.

### 3.2 Manifest Schema & Canonicalization (`FR-MAN`)

- **FR-MAN-001 (Schema Conformance):** The manifest MUST strictly conform to JSON Schema `LUCENTRA-Manifest-v0.1`.
- **FR-MAN-002 (RFC 8785 Canonicalization):** Prior to hashing and signing, the manifest JSON MUST be canonicalized using the RFC 8785 JSON Canonicalization Scheme (JCS).
- **FR-MAN-003 (SHA-256 Resource Digits):** Every listed JavaScript resource MUST declare its relative path, file byte size, and lowercase hex SHA-256 hash formatted as `sha256:<64-char-hex>`.
- **FR-MAN-004 (Manifest Root Hash):** The system MUST compute the SHA-256 digest of the canonicalized manifest string, yielding a 32-byte `manifestHash`.

### 3.3 EIP-712 Signing & EAS Attestation (`FR-SIG`)

- **FR-SIG-001 (EIP-712 Domain Separator):** Signatures MUST use an EIP-712 domain separator specifying `name: "LUCENTRA"`, `version: "1"`, `chainId`, and `verifyingContract`.
- **FR-SIG-002 (EIP-712 Type Hash):** The structured type for signing MUST be:
  `ReleaseManifest(string domain,string version,bytes32 manifestHash,uint64 timestamp,uint64 expiresAt)`.
- **FR-SIG-003 (EAS Schema Definition):** The system MUST register an official EAS schema on Ethereum Sepolia and Mainnet:
  `bytes32 manifestHash, string domain, string version, bytes signature`.
- **FR-SIG-004 (On-Chain Attestation Verification):** Verification clients MUST be able to query the EAS contract or indexing subgraph to confirm attestation validity and revocations.

### 3.4 Chrome Extension Verification Engine (`FR-EXT`)

- **FR-EXT-001 (DOM Script Detection):** The extension content script MUST detect all `<script>` tags present in the initial DOM and any dynamically inserted scripts via a `MutationObserver`.
- **FR-EXT-002 (Asynchronous Script Hashing):** The extension MUST fetch script byte streams and calculate SHA-256 digests in an isolated Web Worker off the main execution thread.
- **FR-EXT-003 (Cross-Origin Resource Handling):** For scripts restricted by CORS from content script context, the extension service worker MUST securely fetch the asset using privileged extension background permissions.
- **FR-EXT-004 (Verification State Machine):** The extension MUST evaluate script hashes against the active signed manifest and transition into one of: `VERIFIED`, `MISMATCH`, `UNREGISTERED`, `UNATTESTED`, `REVOKED`.
- **FR-EXT-005 (Security Badging):** The extension icon MUST visually reflect the current state (Green for `VERIFIED`, Amber for `UNREGISTERED`, Red with alert badge for `MISMATCH`).

### 3.5 Witness Protocol (`FR-WIT`)

- **FR-WIT-001 (Automated Crawling):** The witness client MUST periodically request the active release manifest for registered domains and download all declared JavaScript assets.
- **FR-WIT-002 (Independent Hashing):** The witness MUST independently compute the SHA-256 hash of each downloaded asset.
- **FR-WIT-003 (Signed Observation Publication):** The witness MUST sign its observation digest (`domain`, `timestamp`, `manifestHash`, `observedHashes`, `status`) using its authorized witness key and post to the witness ingestion API.
- **FR-WIT-004 (Conflict Alerting):** If a witness discovers a discrepancy between the live web assets and the signed EAS attestation, the system MUST flag the domain for active investigation.

---

## 4. Dependencies & Security Implications

- Strict conformance to RFC 8785 is required; any parser discrepancy will cause valid signatures to fail validation.
- Smart contract logic must prevent front-running of domain registrations.

---

## 5. Known Limitations

- Manifest V3 limits background service worker lifetime; state must be persisted in `chrome.storage.local`.

---

## 6. Related Documents

- [docs/01-product-management/NON_FUNCTIONAL_REQUIREMENTS.md](NON_FUNCTIONAL_REQUIREMENTS.md)
- [docs/04-protocol/PROTOCOL_SPECIFICATION_V0.1.md](../04-protocol/PROTOCOL_SPECIFICATION_V0.1.md)

---

## 7. References

- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)
- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)

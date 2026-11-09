# User Stories — LUCENTRA

**Document ID:** LUC-PRD-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the functional user stories for LUCENTRA, defining the value delivered to publishers, end users, and witness node operators along with standard acceptance criteria.

---

## 2. User Stories by Persona

### 2.1 Persona 1: Alex (Publisher / DevOps Lead)

- **US-PUB-01 (Domain Ownership Challenge):**  
  *As a* website publisher,  
  *I want to* request a cryptographic verification challenge for my domain in the dashboard,  
  *So that* I can prove administrative ownership via DNS TXT records.  
  *Acceptance Criteria:*
  - System generates a unique 32-byte high-entropy challenge string.
  - Clear DNS instructions provided: host `_lucentra-verification.<domain>`, value `lucentra-challenge=<token>`.
  - Backend Celery task validates DNS TXT propagation within 30 seconds.

- **US-PUB-02 (On-Chain Key Registration):**  
  *As a* website publisher,  
  *I want to* register my Ethereum wallet address as an authorized signing key for my verified domain,  
  *So that* clients can verify my cryptographic release signatures against an on-chain source of truth.  
  *Acceptance Criteria:*
  - Smart contract verifies that the domain verification signature originated from the backend validator.
  - Contract records domain-to-address mapping and emits `DomainRegistered` event.

- **US-PUB-03 (Release Manifest Creation & EIP-712 Signing):**  
  *As a* website publisher,  
  *I want to* compile a release manifest containing all JavaScript asset SHA-256 hashes and sign it with my Web3 wallet,  
  *So that* I can authorize this specific release bundle for production deployment.  
  *Acceptance Criteria:*
  - Manifest is serialized using RFC 8785 JSON Canonicalization Scheme.
  - EIP-712 structured data prompt appears in publisher's wallet (e.g. MetaMask).
  - Signature is anchored on-chain via EAS attestation.

- **US-PUB-04 (Emergency Key Revocation):**  
  *As a* website publisher,  
  *I want to* revoke an authorized signing key immediately from my registered admin address,  
  *So that* an adversary who compromised my CI key cannot attest to rogue releases.  
  *Acceptance Criteria:*
  - Smart contract immediately sets key status to REVOKED.
  - Backend and client extensions invalidate the revoked key within the next cache check.

---

### 2.2 Persona 2: Maya (End User / Browser Extension)

- **US-USR-01 (Real-Time Script Integrity Verification):**  
  *As a* web user visiting a registered website,  
  *I want* the LUCENTRA Chrome Extension to automatically verify all executed JavaScript resources against the publisher's signed release manifest,  
  *So that* I am protected from Magecart attacks and supply chain tampering without manual effort.  
  *Acceptance Criteria:*
  - Content script detects all `<script>` elements in the DOM.
  - Web Worker computes SHA-256 digests in $< 150\text{ ms}$.
  - Hashes are compared against the cached release manifest.

- **US-USR-02 (Visual Verification Status Badge):**  
  *As a* web user,  
  *I want* an intuitive browser toolbar icon indicating current verification state,  
  *So that* I can immediately know if the website is verified, unverified, or compromised.  
  *Acceptance Criteria:*
  - Green icon: 100% scripts verified and attested.
  - Red flashing warning badge: Script hash mismatch or unauthorized script detected.
  - Gray icon: Unregistered domain.

- **US-USR-03 (Detailed Evidence Inspection Popup):**  
  *As a* security-conscious user,  
  *I want to* click the extension popup and inspect the publisher's identity, EAS attestation UID, and individual file hashes,  
  *So that* I have complete cryptographic transparency.  
  *Acceptance Criteria:*
  - Popup displays: Domain, Publisher Address, Release Version, EAS UID (with direct link to EAS explorer), and list of all verified scripts.

---

### 2.3 Persona 3: Liam (Witness Node Operator)

- **US-WIT-01 (Automated Public Audit Observation):**  
  *As a* witness node operator,  
  *I want to* run an automated crawler daemon that fetches registered website assets and records signed observations,  
  *So that* I can contribute to public split-view attack detection.  
  *Acceptance Criteria:*
  - Daemon fetches manifest from backend, downloads declared scripts, computes SHA-256.
  - Generates signed observation JSON conforming to `LUCENTRA-Witness-v0.1`.
  - Submits observation to backend and p2p witness channels.

---

## 3. Related Documents

- [docs/01-product-management/FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md)
- [docs/01-product-management/ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)

---

## 4. References

- [Agile Alliance: User Stories Primer](https://www.agilealliance.org/glossary/user-stories/)

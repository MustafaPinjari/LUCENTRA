# Product Requirements Document (PRD) — LUCENTRA

**Document ID:** LUC-PRD-001  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the complete product requirements for the LUCENTRA internet authenticity and verification platform, defining functional capabilities, operational workflows, and system constraints.

---

## 2. Scope

Encompasses the end-to-end user workflows for:
1. Website Publishers registering domains and signing releases.
2. Web End Users verifying website integrity via a Chrome Extension.
3. Independent Witness Operators auditing web deployments.

---

## 3. Product Architecture & Core Workflows

```mermaid
sequenceDiagram
    autonumber
    actor Publisher as Publisher (Dashboard)
    participant DNS as DNS Authority
    participant Backend as LUCENTRA API (DRF)
    participant Contract as PublisherRegistry Contract
    participant EAS as EAS Protocol
    actor User as Web User (Extension)
    participant CDN as Website / CDN

    Note over Publisher, Backend: Phase 1: Publisher & Domain Registration
    Publisher->>Backend: Request Domain Verification Challenge for "example.com"
    Backend-->>Publisher: Challenge Token: "lucentra-challenge=abc123xyz"
    Publisher->>DNS: Add TXT record: _lucentra-verification.example.com
    Publisher->>Backend: Confirm DNS Record Published
    Backend->>DNS: Query TXT Record
    DNS-->>Backend: TXT Record Confirmed
    Publisher->>Contract: registerDomain("example.com", publisherWallet)
    Contract-->>Publisher: DomainRegistered Event Emitted

    Note over Publisher, EAS: Phase 2: Release Creation & Attestation
    Publisher->>Publisher: Compile Release Manifest & Compute SHA-256 Hashes
    Publisher->>Publisher: EIP-712 Sign Manifest Hash with Publisher Wallet
    Publisher->>EAS: attest(ReleaseSchema, manifestHash, domain, signature)
    EAS-->>Publisher: UID returned (0x456def...)
    Publisher->>Backend: Post Release Manifest & Attestation UID

    Note over User, CDN: Phase 3: Client Verification
    User->>CDN: Navigate to https://example.com
    CDN-->>User: Delivers HTML + JavaScript Assets
    Note over User: Extension Intercepts Scripts & Computes SHA-256
    User->>Backend: Fetch Active Release Manifest for "example.com"
    User->>EAS: Verify Attestation UID & On-Chain Signature
    alt Hashes Match & Attestation Valid
        User-->>User: Surface Green Shield: "VERIFIED PUBLISHER"
    else Hash Mismatch or Unknown Script Injected
        User-->>User: Surface Red Alert: "TAMPERING DETECTED"
    end
```

---

## 4. Key Functional Areas

1. **Domain Ownership Verification:** Authoritative DNS TXT verification ensuring the applicant controls the claimed web property.
2. **On-Chain Key Management:** Anchoring authorized publisher wallet addresses to normalized domains on Ethereum.
3. **Deterministic Release Packaging:** RFC 8785 JSON Canonicalization ensuring identical hash generation across distributed environments.
4. **EAS Attestation Integration:** Public, immutable, non-custodial attestation recording.
5. **Real-Time Client Verification:** Chrome Extension (Manifest V3) inspecting DOM scripts, calculating SHA-256 hashes in a Web Worker, and validating against the signed manifest.
6. **Witness Audit Feed:** Decentralized monitoring against targeted split-view tampering.

---

## 5. Dependencies & Security Implications

- Requires secure DNS challenge generation with strong cryptographic entropy.
- System integrity requires that the browser extension strictly validates on-chain records rather than blindly trusting the backend API.

---

## 6. Known Limitations

- Manifest generation currently covers external JavaScript resources; inline scripts must either be hashed as inline blocks or migrated to external scripts.

---

## 7. Related Documents

- [docs/01-product-management/FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md)
- [docs/01-product-management/NON_FUNCTIONAL_REQUIREMENTS.md](NON_FUNCTIONAL_REQUIREMENTS.md)
- [docs/01-product-management/ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)

---

## 8. References

- [Ethereum Attestation Service Documentation](https://docs.attest.org/)
- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)

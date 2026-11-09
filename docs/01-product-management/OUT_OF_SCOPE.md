# Out of Scope Features — LUCENTRA

**Document ID:** LUC-PRD-007  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document explicitly enumerates features, architectures, and capabilities that are strictly **OUT OF SCOPE** for LUCENTRA. Documenting what the project will *not* build prevents scope creep, maintains engineering focus, and protects system security boundaries.

---

## 2. Explicitly Excluded Capabilities

### 2.1 Cryptography & Key Management
- **Centralized Key Custody:** The LUCENTRA backend will NEVER store publisher private keys, seed phrases, or AWS KMS credentials for signing releases. All signing remains non-custodial via publisher wallets.
- **Proprietary Cryptography:** Custom encryption, custom hash algorithms, or non-standard elliptic curves are strictly prohibited.
- **Direct CA Certificate Issuance:** LUCENTRA is not an SSL/TLS Certificate Authority (CA) and does not issue X.509 certificates.

### 2.2 Blockchain & Smart Contracts
- **Full Asset Storage on EVM:** Storing full JavaScript bundles, source code, or sourcemaps on Ethereum or Layer 2 storage is strictly out of scope due to prohibitive gas and storage costs.
- **Custom Layer 1 Blockchain:** LUCENTRA will not launch a proprietary L1 consensus blockchain. It deploys directly to established EVM ecosystems (Ethereum, Arbitrum, Optimism).
- **Native Utility Token for MVP:** There is no required ERC-20 token for core verification functionality in the MVP.

### 2.3 Browser Extension & Client
- **Pre-execution Synchronous WebRequest Blocking:** Chrome Manifest V3 does not support synchronous `webRequestBlocking` for consumer extensions. The extension will not attempt unsupported hacky workarounds that violate Chrome Web Store policies.
- **Native Firefox / Safari Extensions (MVP):** Phase 1 targets Chrome Manifest V3. Non-Chromium browsers are scheduled for Phase 3.
- **Dynamic Inline Script Deobfuscation:** LUCENTRA verifies integrity against signed digests; it does not perform automated static analysis, reverse engineering, or deobfuscation of proprietary client scripts.

### 2.4 Infrastructure & Networking
- **WAF / Reverse Proxy Replacement:** LUCENTRA is an authenticity verification layer, not a replacement for Cloudflare, Fastly, or AWS CloudFront.
- **DNS Server Replacement:** LUCENTRA integrates with existing DNS via TXT records; it does not replace domain registrars or authoritative nameservers.

---

## 3. Scope Boundary Enforcement

Any proposal or pull request attempting to introduce out-of-scope features must be rejected by the Product Architect (Agent 1) or require an explicit Architecture Decision Record (ADR) approved by executive leadership.

---

## 4. Related Documents

- [docs/00-project-overview/PROJECT_SCOPE.md](../00-project-overview/PROJECT_SCOPE.md)
- [docs/01-product-management/MVP_FEATURES.md](MVP_FEATURES.md)

---

## 5. References

- [Chrome Web Store Policy on Single Purpose and Manifest V3](https://developer.chrome.com/docs/extensions/mv3/policy/)


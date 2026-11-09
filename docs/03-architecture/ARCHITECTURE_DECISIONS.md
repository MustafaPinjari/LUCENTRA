# Architecture Decision Records (ADR) Summary — LUCENTRA

**Document ID:** LUC-ARC-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs and indexes all formal Architecture Decision Records (ADRs) governing the technical architecture, cryptographic choices, and protocol invariants of LUCENTRA.

---

## 2. ADR Governance Index

All individual decision records are located in `docs/03-architecture/decisions/`.

| ADR ID | Title | Status | Primary Deciders | Key Trade-Off / Outcome |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-001](decisions/ADR-001.md) | Hybrid Web2/Web3 Architecture | **APPROVED** | Chief Architect, System Architect | Off-chain high-speed cache + On-chain immutable trust anchor. |
| [ADR-002](decisions/ADR-002.md) | Publisher Identity via Wallet & DNS Verification | **APPROVED** | Security Architect, Product Architect | Combines Web2 DNS TXT challenge with EVM wallet ownership. |
| [ADR-003](decisions/ADR-003.md) | EIP-712 Release Signatures | **APPROVED** | Blockchain Engineer, Security Architect | Human-readable, structured typed data signing with replay protection. |
| [ADR-004](decisions/ADR-004.md) | SHA-256 Artifact Integrity Standard | **APPROVED** | Security Architect, Cryptographer | NIST FIPS 180-4 standard; universal browser and runtime support. |
| [ADR-005](decisions/ADR-005.md) | JSON Canonicalization Scheme (RFC 8785) | **APPROVED** | Protocol Architect, Backend Engineer | Eliminates JSON key ordering and whitespace signature malleability. |
| [ADR-006](decisions/ADR-006.md) | Ethereum Publisher Registry (`PublisherRegistry.sol`) | **APPROVED** | Blockchain Engineer, System Architect | Decentralized domain-to-address mapping with key revocation lifecycle. |
| [ADR-007](decisions/ADR-007.md) | Ethereum Attestation Service (EAS) Integration | **APPROVED** | Blockchain Engineer, Protocol Architect | Standardized on-chain attestation schema instead of custom indexing. |
| [ADR-008](decisions/ADR-008.md) | Chrome Manifest V3 Architecture | **APPROVED** | Extension Engineer, System Architect | Fully compliant with modern Chrome security boundaries; Web Worker hashing. |
| [ADR-009](decisions/ADR-009.md) | Independent Witness Observation Model | **APPROVED** | Security Architect, Protocol Architect | Autonomous multi-party observers to detect split-view / targeted attacks. |
| [ADR-010](decisions/ADR-010.md) | Off-Chain Manifest Storage with Content Addressing | **APPROVED** | Backend Engineer, System Architect | Manifests stored in DB/CDN; verified by on-chain SHA-256 root digest. |

---

## 3. ADR Life Cycle & Decision Process

1. **PROPOSED:** An ADR is drafted using `docs/templates/ADR_TEMPLATE.md` and submitted for technical review.
2. **APPROVED:** Reviewed and formally signed off by the System Architect and Security Architect.
3. **SUPERSEDED:** Replaced by a newer ADR; links updated accordingly.
4. **DEPRECATED:** Architectural path decommissioned.

---

## 4. Related Documents

- [docs/03-architecture/SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
- [docs/templates/ADR_TEMPLATE.md](../templates/ADR_TEMPLATE.md)

# Architecture & Engineering Decision Log — LUCENTRA

**Document ID:** LUC-PM-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides a chronological log of all architectural, product, and protocol decisions made during the engineering lifecycle of LUCENTRA.

---

## 2. Chronological Decision Log

| Date | Decision | Driver / Context | Outcome / Reference |
| :--- | :--- | :--- | :--- |
| **2026-11-09** | Adopt Hybrid Web2/Web3 Topology | Performance requirements ($\le 150\text{ ms}$) vs decentralization | [ADR-001](../03-architecture/decisions/ADR-001.md) |
| **2026-11-09** | Authorize Publisher via DNS TXT + EVM Wallet | Non-invasive verification leveraging standard DNS | [ADR-002](../03-architecture/decisions/ADR-002.md) |
| **2026-11-09** | Adopt EIP-712 for Release Signatures | Human readability in wallets & replay protection | [ADR-003](../03-architecture/decisions/ADR-003.md) |
| **2026-11-09** | Standardize on SHA-256 for Assets | Hardware WebCrypto support & SRI alignment | [ADR-004](../03-architecture/decisions/ADR-004.md) |
| **2026-11-09** | Adopt RFC 8785 (JCS) Canonicalization | Eliminate JSON key order and whitespace malleability | [ADR-005](../03-architecture/decisions/ADR-005.md) |
| **2026-11-09** | Build Dedicated `PublisherRegistry.sol` | On-chain domain-to-key mapping & revocation | [ADR-006](../03-architecture/decisions/ADR-006.md) |
| **2026-11-09** | Integrate Ethereum Attestation Service (EAS) | Standardized attestation schema & indexing | [ADR-007](../03-architecture/decisions/ADR-007.md) |
| **2026-11-09** | Mandate Chrome Manifest V3 Architecture | Conformance to modern browser security boundaries | [ADR-008](../03-architecture/decisions/ADR-008.md) |
| **2026-11-09** | Deploy Independent Witness Observer Model | Defense against localized split-view attacks | [ADR-009](../03-architecture/decisions/ADR-009.md) |
| **2026-11-09** | Off-Chain Manifest Storage with Content Addressing | Gas minimization & fast API manifest delivery | [ADR-010](../03-architecture/decisions/ADR-010.md) |

---

## 3. Related Documents

- [docs/03-architecture/ARCHITECTURE_DECISIONS.md](../03-architecture/ARCHITECTURE_DECISIONS.md)

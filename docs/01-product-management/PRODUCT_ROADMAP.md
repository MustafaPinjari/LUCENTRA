# Product Roadmap — LUCENTRA

**Document ID:** LUC-PRD-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document outlines the multi-phase product roadmap for LUCENTRA, defining milestones, release targets, and evolution pathways from MVP to decentralized internet verification infrastructure.

---

## 2. Roadmap Timeline & Phases

```mermaid
gantt
    title LUCENTRA Engineering Roadmap
    dateFormat  YYYY-MM
    section Phase 1: MVP & Core Protocol
    Architecture & Documentation         :done,    des1, 2026-11, 2026-12
    Smart Contracts & EAS Schema (Sepolia) :active,  des2, 2026-12, 2027-01
    Backend API & DNS Challenge Worker  :         des3, 2027-01, 2027-02
    Chrome Extension MVP (MV3)          :         des4, 2027-02, 2027-03
    Next.js Publisher Dashboard         :         des5, 2027-02, 2027-03
    End-to-End Testnet Pilot            :         des6, 2027-03, 2027-04
    
    section Phase 2: Production & Audits
    Formal Smart Contract Audits        :         aud1, 2027-04, 2027-05
    Mainnet & Arbitrum Deployment       :         dep1, 2027-05, 2027-06
    Chrome Web Store Public Launch      :         cws1, 2027-06, 2027-07
    CI/CD Release Signer CLI            :         cli1, 2027-07, 2027-08

    section Phase 3: Witness Network & Expansion
    P2P Witness Mesh (Libp2p)           :         wit1, 2027-08, 2027-10
    Firefox & Safari Extension Support   :         ext1, 2027-10, 2027-12
    Decentralized Governance & Staking  :         gov1, 2027-12, 2028-02
```

---

## 3. Phase Descriptions

### Phase 1: Foundation & Core Verification (v0.1.0 - Current)
- **Goal:** Establish proven end-to-end verification flow on testnet.
- **Key Deliverables:**
  - Complete engineering documentation system.
  - `PublisherRegistry.sol` deployed on Sepolia.
  - EAS schema registration for release manifests.
  - Next.js dashboard with Web3 wallet signing.
  - Chrome Manifest V3 extension with DOM MutationObserver & Web Worker hashing.
  - Basic CLI witness client.

### Phase 2: Hardening, Security Audits & Public Launch (v0.2.0 - v1.0.0)
- **Goal:** Production deployment with institutional security guarantees.
- **Key Deliverables:**
  - Independent smart contract security audits (OpenZeppelin / Trail of Bits).
  - Mainnet and Arbitrum One smart contract deployments.
  - Official Chrome Web Store listing.
  - Automated GitHub Action (`lucentra/release-action`) for automated CI/CD release signing via hardware security modules or ephemeral cloud keys.

### Phase 3: Decentralized Witness Network & Multi-Browser Support (v1.1.0+)
- **Goal:** Unstoppable, censorship-resistant verification layer.
- **Key Deliverables:**
  - Distributed witness network with libp2p gossip channels and consensus scoring.
  - Support for Mozilla Firefox (WebExtensions API) and Apple Safari.
  - Extended verification for CSS, WebAssembly (.wasm), and critical media assets.

---

## 4. Dependencies & Security Implications

Transitions between phases require formal security audits and passing all quality gates defined in `SUCCESS_METRICS.md`.

---

## 5. Related Documents

- [docs/00-project-overview/SUCCESS_METRICS.md](../00-project-overview/SUCCESS_METRICS.md)
- [docs/01-product-management/MVP_FEATURES.md](MVP_FEATURES.md)
- [docs/14-project-management/DEVELOPMENT_ROADMAP.md](../14-project-management/DEVELOPMENT_ROADMAP.md)

---

## 6. References

- [Ethereum Roadmap](https://ethereum.org/en/roadmap/)
- [EAS Documentation](https://docs.attest.org/)


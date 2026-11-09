# Engineering Development Roadmap — LUCENTRA

**Document ID:** LUC-PM-001  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the high-level engineering roadmap, quarterly milestones, and subsystem dependencies for developing and deploying the LUCENTRA verification platform.

---

## 2. Engineering Milestones Timeline

```mermaid
gantt
    title LUCENTRA Engineering Milestones
    dateFormat  YYYY-MM
    section Milestone 1: Architecture & Foundation
    Architecture & Documentation         :done,    m1, 2026-11, 2026-12
    Foundry Environment & Contract Drafts:active,  m2, 2026-12, 2027-01
    
    section Milestone 2: Core Subsystems
    PublisherRegistry.sol & EAS (Sepolia):         m3, 2027-01, 2027-02
    Backend API & DNS Verification Worker:         m4, 2027-01, 2027-02
    Chrome MV3 Extension Prototype       :         m5, 2027-02, 2027-03
    Next.js Publisher Dashboard          :         m6, 2027-02, 2027-03

    section Milestone 3: Testnet Integration
    End-to-End Testnet Integration       :         m7, 2027-03, 2027-04
    Witness Node Alpha Testing           :         m8, 2027-03, 2027-04

    section Milestone 4: Production Audit
    Formal Security Audits               :         m9, 2027-04, 2027-05
    Mainnet / Arbitrum Deployment        :         m10, 2027-05, 2027-06
```

---

## 3. Related Documents

- [docs/14-project-management/MILESTONES.md](MILESTONES.md)
- [docs/14-project-management/SPRINT_PLAN.md](SPRINT_PLAN.md)
- [docs/14-project-management/DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)

---

## 4. References

- [LUCENTRA Product Requirements](../01-product-management/PRODUCT_REQUIREMENTS.md)


# Risk Register & Mitigation Strategy — LUCENTRA

**Document ID:** LUC-PM-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs technical, operational, regulatory, and adoption risks facing LUCENTRA along with their probability, impact, and mitigation strategies.

---

## 2. Risk Matrix

| Risk ID | Risk Description | Category | Prob. | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-001** | Chrome MV3 changes break content script script interception. | Technical | Low | High | Adhere strictly to stable MV3 standards; maintain early preview testing on Chrome Canary. |
| **RSK-002** | Ethereum L1 gas fees make domain key updates expensive. | Financial | Medium | Medium | Target Arbitrum One as primary production L2; optimize storage slots in `PublisherRegistry.sol`. |
| **RSK-003** | Complex SPAs with dynamic code splitting generate non-deterministic hashes. | Technical | Medium | High | Provide bundler plugins (Webpack/Vite/Next.js) ensuring deterministic chunk outputs. |
| **RSK-004** | Private key compromise of a high-value publisher. | Security | Low | Critical | Separate domain ownership key from daily signing keys; provide 1-click on-chain revocation in `PublisherRegistry.sol`. |
| **RSK-005** | Browser extension store delays or rejects listing. | Operational | Medium | High | Strict compliance with Single Purpose Policy; request minimal permissions (`activeTab`, `storage`). |

---

## 3. Related Documents

- [docs/11-security/THREAT_MODEL.md](../11-security/THREAT_MODEL.md)
- [docs/09-browser-extension/BROWSER_LIMITATIONS.md](../09-browser-extension/BROWSER_LIMITATIONS.md)

# Engineering Task Backlog — LUCENTRA

**Document ID:** LUC-PM-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the prioritized master backlog of technical tasks across all subsystems for the LUCENTRA MVP.

---

## 2. Master Backlog Tasks

| Task ID | Subsystem | Title / Description | Priority | Assigned Role | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-001** | Architecture | Establish complete engineering documentation system | P0 | Agent 9 (Doc Engineer) | VERIFIED |
| **TSK-002** | Contracts | Initialize Foundry repository & install OpenZeppelin v5 | P0 | Agent 3 (Blockchain) | PLANNED |
| **TSK-003** | Contracts | Code `PublisherRegistry.sol` & deploy to local Anvil node | P0 | Agent 3 (Blockchain) | PLANNED |
| **TSK-004** | Contracts | Register official EAS Schema on Ethereum Sepolia | P0 | Agent 3 (Blockchain) | PLANNED |
| **TSK-005** | Backend | Scaffold Django 5.0 project with DRF & Celery | P0 | Agent 4 (Backend) | PLANNED |
| **TSK-006** | Backend | Implement DNS TXT challenge resolution worker | P0 | Agent 4 (Backend) | PLANNED |
| **TSK-007** | Backend | Implement `GET /api/v1/domains/{domain}/manifest/active/` | P0 | Agent 4 (Backend) | PLANNED |
| **TSK-008** | Frontend | Scaffold Next.js 14 App Router dashboard with Tailwind | P0 | Agent 5 (Frontend) | PLANNED |
| **TSK-009** | Frontend | Build EIP-712 manifest signing UI with Wagmi & Viem | P0 | Agent 5 (Frontend) | PLANNED |
| **TSK-010** | Extension | Scaffold Chrome Extension MV3 with TypeScript & Vite | P0 | Agent 6 (Extension) | PLANNED |
| **TSK-011** | Extension | Implement MutationObserver & Web Worker SHA-256 pipeline | P0 | Agent 6 (Extension) | PLANNED |
| **TSK-012** | Extension | Implement action badge and verification status popup | P0 | Agent 6 (Extension) | PLANNED |
| **TSK-013** | Witness | Implement Python CLI witness daemon for testnet crawling | P1 | Agent 4 (Backend) | PLANNED |
| **TSK-014** | Security | Run Slither & Mythril scans on smart contracts | P0 | Agent 7 (Security) | PLANNED |

---

## 3. Related Documents

- [docs/14-project-management/SPRINT_PLAN.md](SPRINT_PLAN.md)
- [docs/14-project-management/DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)

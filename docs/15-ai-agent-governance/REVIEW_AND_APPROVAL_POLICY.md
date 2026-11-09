# Review and Approval Policy — LUCENTRA

**Document ID:** LUC-GOV-010  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document establishes the review criteria, role approvals, and sign-off gates required before any pull request or architectural modification is merged.

---

## 2. Review Responsibility Matrix

| Scope of Change | Required Reviewers | Mandatory Quality Gates |
| :--- | :--- | :--- |
| **Smart Contracts (`contracts/`)** | Agent 3 (Blockchain), Agent 7 (Security) | 100% Foundry tests passing, Slither clean, gas benchmarks met. |
| **Backend API (`services/backend/`)** | Agent 4 (Backend), Agent 7 (Security) | Pytest pass with $\ge 90\%$ coverage, DRF schema synchronized. |
| **Browser Extension (`apps/extension/`)**| Agent 6 (Extension), Agent 7 (Security) | Playwright tests passing, CSP verified, sub-150ms verification met. |
| **Protocol / Cryptography (`packages/`)**| Agent 2 (System Arch), Agent 7 (Security) | Cross-language test vectors pass byte-for-byte. |
| **Documentation Updates (`docs/`)** | Agent 9 (Doc Engineer) | Zero broken cross-references, status tags accurate. |

---

## 3. Related Documents

- [docs/15-ai-agent-governance/AGENT_ROLES.md](AGENT_ROLES.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)

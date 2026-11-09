# Context Loading Policy — LUCENTRA

**Document ID:** LUC-GOV-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document establishes the selective context loading policy for AI engineering agents operating within Antigravity to prevent token bloat, context dilution, and hallucinations.

---

## 2. Mandatory Context Loading Rules

1. **Never Load the Entire Documentation Directory:** An agent must never recursively read all files in `docs/` into its working context.
2. **Standard Minimal Context Set:** Every agent task must load only:
   - `AGENTS.md` (Global operating rules)
   - Relevant high-level architecture document (e.g. `docs/03-architecture/SYSTEM_ARCHITECTURE.md`)
   - The specific component specification (e.g. `docs/06-blockchain/PUBLISHER_REGISTRY.md` for smart contract work)
   - Direct source code files and their corresponding unit tests.
3. **Range-Limited File Reads:** For files $> 300$ lines, read specific line ranges using targeted tooling rather than dumping entire files.

---

## 3. Context Boundaries by Domain

| Task Type | Allowed Context Files | Forbidden Context |
| :--- | :--- | :--- |
| **Smart Contract Dev** | `AGENTS.md`, `contracts/src/*`, `contracts/test/*`, `docs/06-blockchain/*` | `services/backend/*`, `apps/dashboard/*` |
| **Backend API Dev** | `AGENTS.md`, `services/backend/*`, `docs/07-backend/*`, `docs/04-protocol/*` | `contracts/test/*`, `apps/extension/*` |
| **Browser Extension Dev**| `AGENTS.md`, `apps/extension/*`, `docs/09-browser-extension/*` | `contracts/script/*`, `services/backend/apps/registry/*` |

---

## 4. Related Documents

- [docs/15-ai-agent-governance/RESOURCE_OPTIMIZATION.md](RESOURCE_OPTIMIZATION.md)
- [docs/15-ai-agent-governance/TOOL_USAGE_POLICY.md](TOOL_USAGE_POLICY.md)


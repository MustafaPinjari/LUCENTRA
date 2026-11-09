# Code Change Policy & Quality Gates — LUCENTRA

**Document ID:** LUC-GOV-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document defines the strict policies governing code additions, refactoring, dependency introductions, and deprecations within the LUCENTRA repository.

---

## 2. Inviolable Code Change Rules

1. **Zero Uninspected Overwrites:** An agent must never overwrite or delete an existing file without first inspecting its contents, history, and caller dependencies.
2. **Preserve Documentation & Comments:** Maintain all existing inline comments, docstrings, and architectural annotations. Do not delete explanatory notes during refactoring.
3. **No Unjustified Dependencies:** Do not add third-party npm packages or Python libraries unless a documented requirement justifies them and their security posture is vetted.
4. **Mandatory Test Pairing:** Every new function, endpoint, or contract method must be accompanied by corresponding unit and integration tests.

---

## 3. Related Documents

- [AGENTS.md](../../AGENTS.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)


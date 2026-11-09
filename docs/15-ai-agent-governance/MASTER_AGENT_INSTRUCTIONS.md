# Master AI Agent Instructions — LUCENTRA

**Document ID:** LUC-GOV-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Operating Charter

You are operating inside the **LUCENTRA** engineering repository as an autonomous AI engineering agent.

Your mission is to maintain, develop, test, and document the LUCENTRA internet authenticity and verification platform without introducing regressions, unauthorized architectural changes, hallucinated APIs, or security vulnerabilities.

---

## 2. Inviolable Governance Principles

1. **Strict Fidelity to Documentation:** Every file you create or edit must adhere strictly to the approved specifications in `docs/`. You must never invent unapproved protocols, endpoints, or features.
2. **Inspect Before Mutating:** Always inspect existing code, schemas, and tests before making modifications. Never overwrite working code.
3. **No Centralized Key Custody:** Never write code that accepts, logs, transmits, or stores publisher private signing keys on the server.
4. **Deterministic Standards:** Always use approved standards: SHA-256 (FIPS 180-4), EIP-712 structured hashing, and RFC 8785 JSON Canonicalization Scheme.
5. **Accurate Status Tracking:** Never claim an unimplemented feature is complete. Mark statuses accurately: `PROPOSED`, `APPROVED`, `IN_PROGRESS`, `IMPLEMENTED`, `TESTED`, `VERIFIED`.

---

## 3. Related Documents

- [AGENTS.md](../../AGENTS.md)
- [docs/15-ai-agent-governance/AGENT_ROLES.md](AGENT_ROLES.md)
- [docs/15-ai-agent-governance/CONTEXT_LOADING_POLICY.md](CONTEXT_LOADING_POLICY.md)
- [docs/15-ai-agent-governance/AGENT_HANDOFF_PROTOCOL.md](AGENT_HANDOFF_PROTOCOL.md)

---

## 4. References

- [Google DeepMind Agent Architecture Guidelines](https://deepmind.google/)


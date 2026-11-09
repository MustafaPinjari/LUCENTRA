# Protocol Versioning & Compatibility Policy — LUCENTRA

**Document ID:** LUC-PRO-010  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document outlines the protocol versioning strategy, backwards compatibility guarantees, schema evolution rules, and deprecation lifecycles across the LUCENTRA ecosystem.

---

## 2. Versioning Taxonomy

LUCENTRA uses Semantic Versioning (`MAJOR.MINOR.PATCH`) for all software subsystems, combined with explicit protocol schema identifiers:

- **Protocol & Manifest Versioning:** Identifiers like `LUCENTRA-Manifest-v0.1` and `LUCENTRA-Witness-v0.1`.
- **EIP-712 Domain Version:** Incremented only when the EIP-712 structured data type hash or signature domain semantics change (e.g. `version: "1"` $\rightarrow$ `version: "2"`).
- **EAS Schema UID:** New schema requirements on EAS instantiate a new immutable Schema UID. Client extensions must support legacy schema UIDs until formal deprecation.

---

## 3. Backwards Compatibility Rules

1. **Client Extension Parsing:** Newer browser extension versions must maintain backwards compatibility for existing, active releases conforming to older schema versions (e.g., v0.1 must be readable by a v0.2 extension).
2. **Deterministic Canonicalization:** Canonicalization logic (RFC 8785) is mathematically immutable; changes to the canonicalization algorithm constitute a breaking change requiring a major protocol upgrade.
3. **Deprecation Window:** Deprecated manifest schemas or EAS schema UIDs must provide at least a 6-month migration notice before client extensions drop verification support.

---

## 4. Related Documents

- [docs/04-protocol/PROTOCOL_SPECIFICATION_V0.1.md](PROTOCOL_SPECIFICATION_V0.1.md)
- [docs/17-releases/VERSION_0.1.md](../17-releases/VERSION_0.1.md)

---

## 5. References

- [Semantic Versioning 2.0.0](https://semver.org/)


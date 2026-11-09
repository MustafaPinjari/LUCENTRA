# Security Requirements & Verification Matrix — LUCENTRA

**Document ID:** LUC-SEC-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies mandatory security requirements and their associated verification procedures across all LUCENTRA subsystems.

---

## 2. Security Requirements Matrix

| Requirement ID | Subsystem | Requirement Statement | Verification Procedure |
| :--- | :--- | :--- | :--- |
| **SEC-REQ-001** | Cryptography | All asset digests must use SHA-256 (NIST FIPS 180-4). | Automated test vector execution (`test_sha256.py`). |
| **SEC-REQ-002** | Cryptography | Manifest serialization must strictly follow RFC 8785 (JCS). | Cross-language test vector comparison. |
| **SEC-REQ-003** | Backend | Private signing keys must never be accepted, stored, or logged by the server. | Codebase regex scan for private key patterns in backend. |
| **SEC-REQ-004** | Contracts | Domain registration must verify cryptographic signature of authoritative DNS check. | Foundry invariant and fuzz tests. |
| **SEC-REQ-005** | Contracts | Signing keys marked as `REVOKED` can never be re-activated. | Foundry test asserting revert on re-authorization attempt. |
| **SEC-REQ-006** | Extension | Content script must execute in Isolated World without `eval()` permissions. | Manifest V3 CSP audit and automated Chrome WebDriver test. |
| **SEC-REQ-007** | Extension | Client must evaluate on-chain EAS attestation, not trust backend API unquestioningly. | Integration test verifying tamper detection when backend serves altered manifest. |

---

## 3. Related Documents

- [docs/11-security/THREAT_MODEL.md](THREAT_MODEL.md)
- [docs/11-security/SECURITY_AUDIT_CHECKLIST.md](SECURITY_AUDIT_CHECKLIST.md)

---

## 4. References

- [NIST SP 800-53: Security and Privacy Controls](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)


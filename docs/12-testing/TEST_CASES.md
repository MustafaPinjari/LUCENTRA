# Master Test Cases & Acceptance Matrix — LUCENTRA

**Document ID:** LUC-TST-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs the master end-to-end test cases and acceptance scenarios governing verification, publisher workflows, and security regression defense.

---

## 2. Master Test Cases Matrix

| Test Case ID | Test Category | Pre-Conditions | Action / Input | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-001** | Publisher Registration | Domain `example.com` has no active record; valid DNS TXT record added. | Submit challenge verification and call `registerDomain`. | Record stored in `PublisherRegistry.sol`; `DomainRegistered` event emitted. | Contract owner matches caller address. |
| **TC-002** | Release Attestation | Publisher registered on Sepolia; manifest compiled. | EIP-712 sign `manifestHash` and submit to EAS contract. | Attestation UID minted; manifest indexed in DRF backend. | UID returned and readable from EAS GraphQL. |
| **TC-003** | Extension Clean Match | Target website loaded with 5 authorized scripts. | Open page in Chrome with extension active. | All 5 script hashes match manifest; badge displays green `✓`. | Status is `VERIFIED`. |
| **TC-004** | Tampered Script Detection | Attacker modifies 1 byte in `app.js` on CDN origin. | Open page in Chrome with extension active. | Extension computes divergent hash; badge displays red `!`. | Status is `MISMATCH`. |
| **TC-005** | Unauthorized Injection | Attacker injects `<script src="https://evil.com/skimmer.js">`. | Page dynamically executes injection. | MutationObserver intercepts script; not in manifest; triggers red `!`. | Status is `MISMATCH`. |
| **TC-006** | Key Revocation | Publisher executes `revokeKey(domain, key)`. | User visits site signed by revoked key. | Extension checks key status on-chain; detects revoked state; displays red alert. | Status is `REVOKED`. |

---

## 3. Related Documents

- [docs/01-product-management/ACCEPTANCE_CRITERIA.md](../01-product-management/ACCEPTANCE_CRITERIA.md)
- [docs/12-testing/TESTING_STRATEGY.md](TESTING_STRATEGY.md)

---

## 4. References

- [IEEE 829 Standard for Software Test Documentation](https://standards.ieee.org/)


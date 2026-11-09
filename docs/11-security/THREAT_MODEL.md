# Threat Model (STRIDE) — LUCENTRA

**Document ID:** LUC-SEC-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides a comprehensive threat model for LUCENTRA using the STRIDE methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

---

## 2. STRIDE Threat Analysis Matrix

| Threat Category | Specific Threat Scenario | Affected Component | Likelihood | Impact | Implemented Mitigation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker registers a domain they do not own in `PublisherRegistry.sol`. | Smart Contract / DNS | Medium | Critical | Requires EIP-712 DNS verification ticket signed by authoritative DNS verifier service; UTS #46 domain normalization prevents homoglyphs. |
| **Spoofing** | Rogue witness node submits forged observation logs. | Witness Ingestion API | Medium | High | Witness submissions require secp256k1 signature validation against registered witness keys. |
| **Tampering** | Attacker breaches CDN and injects Magecart skimmer into JavaScript bundle. | Client Browser / CDN | High | Critical | Chrome Extension intercepts script in DOM, computes SHA-256 hash, detects mismatch against signed manifest, and triggers `MISMATCH` alert. |
| **Tampering** | Attacker compromises backend PostgreSQL database and alters stored manifest JSON. | Backend Database | Medium | Critical | Chrome Extension independently computes `SHA-256(canonical(manifest))` and verifies that it matches the on-chain EAS attestation digest. Tampered DB manifest fails on-chain check. |
| **Repudiation** | Publisher claims a compromised release was not authorized by their organization. | Publisher Workflow | Low | High | Releases require non-repudiable EIP-712 structured signatures signed by the publisher's authorized on-chain key. |
| **Information Disclosure** | Extension leaks user browsing history to LUCENTRA backend during verification queries. | Browser Extension / API | High | High | Extension queries manifest by domain name only, never transmitting full URL paths, search queries, or user session identifiers. |
| **Denial of Service** | Sybil attack flooding backend with bogus DNS challenge requests. | Backend API | High | Medium | IP and wallet-based rate limiting (10 challenge req/hour); Redis rate-limiting tokens. |
| **Elevation of Privilege** | Malicious web page script bypasses sandbox and tampers with extension verification state. | Extension Content Script | Low | Critical | Content scripts run in Chrome **Isolated World** context with zero access to page `window` scope; CSP strictly bans `eval()`. |

---

## 3. Threat Trees & Scenarios

### Scenario: Complete Backend Compromise
If an adversary obtains root access to the Django backend server:
- Attacker can delete cached manifests $\rightarrow$ Extension enters `INDETERMINATE` state and falls back to direct on-chain RPC queries.
- Attacker can serve fake manifests $\rightarrow$ Extension verifies the manifest against the on-chain EAS attestation; because the attacker lacks the publisher's private key, the on-chain signature check fails, preventing false verification.

---

## 4. Related Documents

- [docs/11-security/ATTACK_SURFACE_ANALYSIS.md](ATTACK_SURFACE_ANALYSIS.md)
- [docs/11-security/SECURITY_REQUIREMENTS.md](SECURITY_REQUIREMENTS.md)

---

## 5. References

- [Microsoft STRIDE Threat Modeling](https://learn.microsoft.com/en-us/security/engineering/stride-threat-modeling)

# Privacy Model & Data Minimization — LUCENTRA

**Document ID:** LUC-SEC-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document articulates the privacy architecture of LUCENTRA, defining how the platform verifies web integrity without collecting, storing, or transmitting user browsing history or Personally Identifiable Information (PII).

---

## 2. Privacy Guarantees

1. **Zero Browsing History Transmission:** When verifying a web page, the Chrome Extension requests metadata by **domain name only** (e.g. `example.com`). Full URLs, path parameters, query strings, and hashes are never transmitted over the network.
2. **Zero Cookie / Token Tracking:** The extension operates without analytics trackers, user telemetry beacons, or advertising cookies.
3. **Local Hashing:** All script SHA-256 digests are computed locally within the client's Web Worker. No website content or user data is uploaded to LUCENTRA servers during verification.
4. **Zero On-Chain PII:** The Ethereum blockchain and EAS attestations store only cryptographic hashes, domain strings, and public wallet addresses.

---

## 3. Related Documents

- [docs/09-browser-extension/PERMISSION_MODEL.md](../09-browser-extension/PERMISSION_MODEL.md)
- [docs/11-security/SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md)

---

## 4. References

- [GDPR Principle of Data Minimisation (Article 5(1)(c))](https://gdpr-info.eu/art-5-gdpr/)


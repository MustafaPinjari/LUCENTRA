# Competitor Analysis — LUCENTRA

**Document ID:** LUC-RES-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document analyzes existing industry solutions, commercial products, and emerging protocols targeting client-side script protection and web integrity.

---

## 2. Competitive Landscape Comparison

| Solution | Mechanism | Publisher Identity Verification | First-Party Script Protection | Decentralized / Non-Custodial | Client Extension Auditing | Split-View Mitigation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **W3C Subresource Integrity (SRI)** | HTML `integrity="..."` tag | None | Weak (Host-controlled HTML) | N/A (Standard) | No | None |
| **Cloudflare Page Shield** | Edge CSP & script inventory | None (ISP/Edge level) | Moderate (Server telemetry) | No (Proprietary SaaS) | No | Weak (Single provider perspective) |
| **Human Security / Akamai Client-Side** | Injected runtime agent | None | Yes (Runtime heuristics) | No (Centralized enterprise SaaS) | No | None |
| **Certificates / DNSSEC** | TLS X.509 + DNS RRSIG | Domain-level only | None (Transport only) | No (Certificate Authorities) | Built-in browser | None |
| **LUCENTRA** | Signed Release Manifest + EAS + Chrome MV3 | **Yes (EVM Key + DNS TXT)** | **Yes (Cryptographic SHA-256 Manifest)** | **Yes (Ethereum & Open Standards)** | **Yes (Real-time DOM inspection)** | **Yes (Decentralized Witness Nodes)** |

---

## 3. Detailed Differentiators

1. **Independent Decentralized Trust:** Unlike Cloudflare Page Shield or Akamai, LUCENTRA does not require the publisher to route traffic through a closed corporate intermediary. Verification is anchored publicly on Ethereum.
2. **Immutable Non-Repudiation:** Releases are cryptographically signed using EIP-712 and attested on-chain via EAS. Publishers cannot retroactively deny having authorized a release, and compromised servers cannot forge attestations.
3. **Consumer-Facing Transparency:** Enterprise products like Human Security report security telemetry only to enterprise dashboards; LUCENTRA provides actionable verification directly to end users in the browser.

---

## 4. Related Documents

- [docs/02-research-and-analysis/EXISTING_SOLUTIONS.md](EXISTING_SOLUTIONS.md)
- [docs/02-research-and-analysis/TECHNICAL_GAP_ANALYSIS.md](TECHNICAL_GAP_ANALYSIS.md)

---

## 5. References

- [Cloudflare Page Shield Documentation](https://developers.cloudflare.com/page-shield/)
- [W3C SRI Specification](https://www.w3.org/TR/SRI/)

# Technical Gap Analysis — LUCENTRA

**Document ID:** LUC-RES-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides a systematic analysis of the technical gaps between existing web security infrastructure and the requirements for trustless, decentralized web resource verification.

---

## 2. Technical Gap Matrix

| Security / Operational Layer | Current Web Architecture (Status Quo) | LUCENTRA Target Architecture | Critical Technical Gap | Engineering Solution in LUCENTRA |
| :--- | :--- | :--- | :--- | :--- |
| **Origin Trust Model** | Trust is tied strictly to DNS + TLS Certificate Authority. | Trust is anchored to cryptographic keys owned by verified publishers and registered on Ethereum. | CAs certify server identity, not author release intent. | `PublisherRegistry.sol` binds DNS ownership to Ethereum signing addresses. |
| **Integrity Specification** | SRI hashes reside inside the host-delivered HTML. | Signed release manifests are anchored on-chain via EAS and served out-of-band. | Host compromise invalidates SRI tags concurrently. | Independent EAS release attestations verified directly by browser extension. |
| **Dynamic Execution Detection** | Browser executes any `<script>` or dynamic `import()` permitted by CSP. | Extension intercepts DOM script injection and validates hashes against signed release. | No client mechanism to distinguish publisher script from skimmer injection. | Chrome MV3 MutationObserver + Web Worker SHA-256 pipeline. |
| **Auditing & Visibility** | Split-view attacks (serving malware only to specific IPs) go undetected by site owners. | Multi-location independent witness nodes crawl and log signed observations. | Publishers cannot detect localized edge tampering. | Autonomous witness daemon network publishing verifiable observation logs. |

---

## 3. Engineering Challenges & Risks

1. **MV3 Service Worker Ephemerality:** Chrome MV3 terminates idle background service workers after 30 seconds. In-memory attestation caches are lost unless persisted in `chrome.storage.local`.
2. **CORS on Extension Script Fetches:** Fetching script contents from content script execution contexts can be blocked by CORS unless executed in background context with proper host permissions.
3. **Bundler Non-Determinism:** If build tools generate non-deterministic chunk names or timestamps, publishers cannot reproduce identical release hashes. Build guidelines must mandate deterministic bundler configurations.

---

## 4. Related Documents

- [docs/02-research-and-analysis/PROBLEM_RESEARCH.md](PROBLEM_RESEARCH.md)
- [docs/03-architecture/SYSTEM_ARCHITECTURE.md](../03-architecture/SYSTEM_ARCHITECTURE.md)

---

## 5. References

- [Google Chrome MV3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating/)
- [Reproducible Builds Project](https://reproducible-builds.org/)


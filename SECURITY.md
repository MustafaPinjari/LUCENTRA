# Security Policy — LUCENTRA

**Document ID:** LUC-SEC-000  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Security Philosophy

LUCENTRA exists to provide independent verification of web resources and publisher identity. Because LUCENTRA is itself a trust-enabling verification system, the security of its contracts, APIs, extensions, and cryptographic verification pipelines is paramount.

A failure in LUCENTRA's security posture undermines the trust users place in the entire verification ecosystem.

---

## 2. Inviolable Security Mandates

1. **No Custody of Private Keys:** Neither the LUCENTRA backend, database, nor witness infrastructure shall ever generate, handle, store, or transmit publisher private signing keys. All signing is strictly non-custodial via client-side wallets (EIP-712).
2. **Immutable On-Chain Anchor:** Publisher public keys and identity links are anchored immutably via EVM smart contracts and EAS attestations. The centralized backend is strictly an acceleration and caching layer and cannot forge valid attestations.
3. **Strict Client-Side Validation:** The Chrome Extension and client verification engines must cryptographically verify signatures and EAS attestations independently rather than blindly trusting the backend API response.
4. **Least Privilege MV3 Permissions:** The Chrome Extension requests strictly necessary permissions (`activeTab`, `scripting`, declarative network observation where permitted) and avoids invasive blanket permissions (`<all_urls>` where host permissions can be restricted).
5. **Deterministic Canonicalization:** All signed payloads must adhere to RFC 8785 JSON Canonicalization Scheme (JCS) to eliminate signature malleability caused by JSON key ordering or whitespace differences.

---

## 3. Supported Versions

| Component | Version | Supported | Security Maintenance Status |
| :--- | :--- | :--- | :--- |
| **Protocol Specification** | v0.1 | Yes | Active specification |
| **Smart Contracts** | v0.1 | Yes | Pre-deployment design |
| **Backend API** | v0.1 | Yes | Pre-deployment design |
| **Chrome Extension** | v0.1 | Yes | Pre-deployment design |

---

## 4. Reporting a Vulnerability

We take responsible disclosure seriously. If you discover a security vulnerability in LUCENTRA, please follow these steps:

1. **Do NOT open a public GitHub issue.**
2. Send an encrypted email to `security@lucentra.io` (or the designated security architect contact).
3. Include:
   - Component affected (e.g., Extension, Contract, Backend, Protocol).
   - Clear description of the vulnerability and attack vector.
   - Proof of Concept (PoC) or reproducible steps.
   - Potential impact assessment.
4. The security team will acknowledge receipt within 24 hours and provide an initial assessment within 72 hours.
5. Coordinated disclosure will follow a standard 90-day window, or sooner upon mutual agreement once a fix is verified.

---

## 5. Security Architecture References

For detailed threat modeling and audit checklists, refer to:
- [docs/11-security/THREAT_MODEL.md](docs/11-security/THREAT_MODEL.md)
- [docs/11-security/ATTACK_SURFACE_ANALYSIS.md](docs/11-security/ATTACK_SURFACE_ANALYSIS.md)
- [docs/11-security/SMART_CONTRACT_SECURITY.md](docs/11-security/SMART_CONTRACT_SECURITY.md)
- [docs/11-security/EXTENSION_SECURITY.md](docs/11-security/EXTENSION_SECURITY.md)

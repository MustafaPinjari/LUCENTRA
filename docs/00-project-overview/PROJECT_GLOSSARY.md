# Project Glossary — LUCENTRA

**Document ID:** LUC-OVR-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This glossary establishes precise, unambiguous definitions for domain-specific terminology, cryptographic concepts, and protocol identifiers across all LUCENTRA documentation and code.

---

## 2. Definitions

### 2.1 Core Protocol Terms

- **Publisher:** The verified owner of a web domain who possesses administrative control over its DNS records and holds an authorized Ethereum signing key.
- **Publisher Registry (`PublisherRegistry.sol`):** The canonical Ethereum smart contract mapping normalized domain names to publisher wallet addresses and active signing keys.
- **Domain Normalization:** The process of converting domain strings to a lowercase, canonical, ASCII-compatible format (using UTS #46 / IDNA 2008 and removing trailing dots, protocols, and port numbers).
- **Release Manifest:** A deterministic JSON document conforming to `LUCENTRA-Manifest-v0.1` that lists all authorized JavaScript files, their relative URIs, and their SHA-256 digests.
- **Manifest Hash:** The SHA-256 digest of the canonicalized (RFC 8785) release manifest JSON string.
- **EIP-712 Signature:** A typed structured cryptographic signature created by the publisher's wallet authorizing a specific Release Manifest for a specific domain and release version.
- **EAS (Ethereum Attestation Service):** A public, decentralized infrastructure for creating and verifying on-chain and off-chain attestations.
- **Release Attestation:** An immutable on-chain record created via EAS by the publisher certifying that a specific Manifest Hash is the authorized release for a given domain.
- **Witness Node:** An independent server or client running an automated observer daemon that crawls web pages, computes asset SHA-256 digests, and reports signed observations to detect localized tampering or split-view attacks.
- **Split-View Attack:** An attack where an adversary serves legitimate code to auditors or search engines while serving malicious payloads to targeted end-users or specific geographic regions.

### 2.2 Cryptographic Primitives

- **SHA-256 (Secure Hash Algorithm 256-bit):** FIPS 180-4 standard cryptographic hash function used to generate unique 32-byte digests of JavaScript resources. Represented in hexadecimal format with a `sha256:` prefix.
- **JSON Canonicalization Scheme (JCS / RFC 8785):** A deterministic standard for canonicalizing JSON data (lexicographical sorting of keys, uniform whitespace removal, standard number formatting) prior to hashing and signing.
- **secp256k1:** The elliptic curve cryptography parameters used by Ethereum for public-private key cryptography and ECDSA signatures.

### 2.3 Verification States

- **VERIFIED:** All loaded scripts match the publisher's signed release manifest, the publisher identity is validated on-chain, and active EAS attestations are confirmed.
- **MISMATCH / TAMPERED:** One or more scripts loaded into the DOM fail to match the hashes declared in the signed release manifest, or an unauthorized external script has been injected.
- **UNREGISTERED:** The domain does not have a registered publisher identity in the LUCENTRA `PublisherRegistry.sol` contract.
- **UNATTESTED:** The domain has a registered publisher, but no active release attestation has been published for the current site release.
- **REVOKED:** The release attestation or the publisher's signing key has been explicitly revoked on-chain due to a security incident or deprecation.
- **INDETERMINATE:** Verification could not be finalized due to network timeouts, CORS isolation, or browser extension restrictions.

---

## 3. Related Documents

- [docs/00-project-overview/PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
- [docs/04-protocol/PROTOCOL_SPECIFICATION_V0.1.md](../04-protocol/PROTOCOL_SPECIFICATION_V0.1.md)
- [docs/05-cryptography/CRYPTOGRAPHIC_ARCHITECTURE.md](../05-cryptography/CRYPTOGRAPHIC_ARCHITECTURE.md)

---

## 4. References

- [RFC 8785: JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785.html)
- [NIST FIPS 180-4: Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)

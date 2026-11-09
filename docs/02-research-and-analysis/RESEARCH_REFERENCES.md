# Research References & Bibliography — LUCENTRA

**Document ID:** LUC-RES-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs all verified, authoritative technical standards, academic literature, security advisories, and official documentation governing LUCENTRA.

---

## 2. Authoritative Standards & RFCs

1. **RFC 8785: JSON Canonicalization Scheme (JCS)**  
   *Author:* A. Rundgren, B. Jordan, S. Erdtman (IETF, 2020)  
   *URL:* https://www.rfc-editor.org/rfc/rfc8785.html  
   *Usage in LUCENTRA:* Canonical serialization of release manifests before hashing.

2. **EIP-712: Ethereum Typed Structured Data Hashing and Signing**  
   *Author:* Remco Bloemen, Leonid Logvinov, Jacob Evans (Ethereum Foundation, 2018)  
   *URL:* https://eips.ethereum.org/EIPS/eip-712  
   *Usage in LUCENTRA:* Structured cryptographic signing of release manifests.

3. **NIST FIPS PUB 180-4: Secure Hash Standard (SHS)**  
   *Author:* National Institute of Standards and Technology (NIST, 2015)  
   *URL:* https://csrc.nist.gov/pubs/fips/180-4/upd1/final  
   *Usage in LUCENTRA:* SHA-256 asset integrity calculations.

4. **W3C Subresource Integrity (SRI)**  
   *Author:* D. Akhawe, F. Braun, F. Marier, P. Weinberger (W3C Recommendation, 2016)  
   *URL:* https://www.w3.org/TR/SRI/  
   *Usage in LUCENTRA:* Baseline comparative analysis and cryptographic compatibility.

5. **Unicode Technical Standard #46: Unicode IDNA Compatibility Processing**  
   *Author:* M. Davis, M. Suignard (Unicode Consortium)  
   *URL:* https://unicode.org/reports/tr46/  
   *Usage in LUCENTRA:* Canonical domain normalization and homograph attack defense.

---

## 3. Official Platform Documentation

1. **Ethereum Attestation Service (EAS)**  
   *URL:* https://docs.attest.org/  
   *Usage in LUCENTRA:* Release attestation schemas, on-chain contract interfaces, and indexing.

2. **Google Chrome Extensions Manifest V3**  
   *URL:* https://developer.chrome.com/docs/extensions/mv3/  
   *Usage in LUCENTRA:* Extension background service workers, content script sandboxing, and permissions.

3. **OpenZeppelin Contracts v5.x**  
   *URL:* https://docs.openzeppelin.com/contracts/5.x/  
   *Usage in LUCENTRA:* Smart contract access control (`Ownable2Step`), cryptographic primitives (`ECDSA`), and reentrancy guards.

4. **Foundry Book**  
   *URL:* https://book.getfoundry.sh/  
   *Usage in LUCENTRA:* Smart contract compilation, testing, gas benchmarking, and fuzz testing.

5. **Django REST Framework**  
   *URL:* https://www.django-rest-framework.org/  
   *Usage in LUCENTRA:* Backend REST API, serialization, and viewset architecture.

---

## 4. Related Documents

- [docs/02-research-and-analysis/STANDARDS_AND_RFC_RESEARCH.md](STANDARDS_AND_RFC_RESEARCH.md)


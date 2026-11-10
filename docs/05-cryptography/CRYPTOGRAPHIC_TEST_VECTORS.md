# Cryptographic Test Vectors — LUCENTRA

**Document ID:** LUC-CRY-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides official, reproducible cryptographic test vectors for SHA-256 asset hashing, RFC 8785 canonicalization, and EIP-712 structured data signing.

---

## 2. Test Vector 1: SHA-256 Asset Hashing

### Input Data
- File Content: `console.log("Hello, LUCENTRA!");\n` (33 bytes, UTF-8 encoded).
- Hex Bytes: `636f6e736f6c652e6c6f67282248656c6c6f2c204c5543454e5452412122293b0a`

### Expected Outputs
- Raw Hex Digest: `09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1`
- Standard Formatted String: `sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1`

---

## 3. Test Vector 2: RFC 8785 Canonicalization & Manifest Hash

### Input Manifest Object (Unsorted Keys, Arbitrary Whitespace)
```json
{
  "version": "0.1.0",
  "resources": [
    {
      "type": "script",
      "path": "/bundle.js",
      "sha256": "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1",
      "size": 33
    }
  ],
  "expiresAt": 1799999999,
  "domain": "example.com",
  "createdAt": 1700000000,
  "schemaVersion": "LUCENTRA-Manifest-v0.1"
}
```

### Expected Canonical Output String (Byte-for-byte exact UTF-8)
```json
{"createdAt":1700000000,"domain":"example.com","expiresAt":1799999999,"resources":[{"path":"/bundle.js","sha256":"sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1","size":33,"type":"script"}],"schemaVersion":"LUCENTRA-Manifest-v0.1","version":"0.1.0"}
```

### Expected Manifest Hash
- SHA-256 of Canonical String: `0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4`

---

## 4. Test Vector 3: EIP-712 Structured Data Signing

### Domain Separator Parameters
- `name`: `"LUCENTRA"`
- `version`: `"1"`
- `chainId`: `11155111` (Sepolia)
- `verifyingContract`: `0x1111111111111111111111111111111111111111`

### Signer Key Pair
- Private Key: `0x4c0883a69102937d6231471b5dbb6204db7e716b78ac5c7827453b4112f46973`
- Derived Address: `0xa0629861EeD36918aeF4750df910253a59b26977`

### Message Fields
- `domain`: `"example.com"`
- `version`: `"0.1.0"`
- `manifestHash`: `0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4`
- `timestamp`: `1700000000`
- `expiresAt`: `1799999999`

### Expected Output Signature
- `signature`: `0xdebe38b2c5399315ce7083f0e46f43ce6e45dd1351325b11ef1f88e734178a974e0f49fa9a7373d854b93c12f348546278579fa41638720f1553ea0b7a7a495f1c`
- Recovered Address: `0xa0629861EeD36918aeF4750df910253a59b26977` (Matches Signer Address exactly)

---

## 5. Test Vector 4: EAS Attestation Validity Evaluation

Formal evaluation vectors testing the five-tier validity formula:
$$\mathcal{V}(A, T_{\text{eval}}) \equiv (A.\text{uid} \neq \mathbf{0}) \land (A.\text{revocationTime} == 0) \land (A.\text{expirationTime} == 0 \lor T_{\text{eval}} \le A.\text{expirationTime}) \land (\text{isKeyAuthorized}(A.\text{domain}, A.\text{attester}) == \text{true})$$

| Test ID | Evaluation Scenario | $A.\text{uid}$ | $A.\text{time}$ | $A.\text{revocationTime}$ | $A.\text{expirationTime}$ | $T_{\text{eval}}$ | $\mathcal{K}$ (Key Auth) | Expected Verdict $\mathcal{V}(A, T_{\text{eval}})$ | Protocol State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TV-EAS-001** | Valid active bounded release | `0x1111...` | 1,700,000,000 | 0 | 1,735,689,600 | 1,715,000,000 | `true` | **`true` (PASS)** | `VERIFIED_RELEASE_MATCH` |
| **TV-EAS-002** | Expired release ($T_{\text{eval}} > \text{expiry}$) | `0x2222...` | 1,700,000,000 | 0 | 1,710,000,000 | 1,715,000,000 | `true` | **`false` (FAIL)** | `UNATTESTED_RELEASE` |
| **TV-EAS-003** | Explicitly revoked release | `0x3333...` | 1,700,000,000 | 1,705,000,000 | 1,735,689,600 | 1,715,000,000 | `true` | **`false` (FAIL)** | `REVOKED_RELEASE` |
| **TV-EAS-004** | Valid indefinite release ($\text{expiry} = 0$) | `0x4444...` | 1,700,000,000 | 0 | 0 | 1,800,000,000 | `true` | **`true` (PASS)** | `VERIFIED_RELEASE_MATCH` |
| **TV-EAS-005** | Revoked publisher signing key | `0x5555...` | 1,700,000,000 | 0 | 1,735,689,600 | 1,715,000,000 | `false` | **`false` (FAIL)** | `REVOKED_RELEASE` |
| **TV-EAS-006** | Non-existent attestation UID | `0x0000...` | 0 | 0 | 0 | 1,715,000,000 | `true` | **`false` (FAIL)** | `UNATTESTED_RELEASE` |
| **TV-EAS-007** | Boundary: exactly at expiration | `0x7777...` | 1,700,000,000 | 0 | 1,715,000,000 | 1,715,000,000 | `true` | **`true` (PASS)** | `VERIFIED_RELEASE_MATCH` |
| **TV-EAS-008** | Boundary: 1 second past expiry | `0x8888...` | 1,700,000,000 | 0 | 1,715,000,000 | 1,715,000,001 | `true` | **`false` (FAIL)** | `UNATTESTED_RELEASE` |

---

## 6. Related Documents

- [docs/04-protocol/CANONICALIZATION.md](../04-protocol/CANONICALIZATION.md)
- [docs/05-cryptography/EIP712_SIGNING.md](EIP712_SIGNING.md)

---

## 6. References

- [RFC 8785 Appendix A Test Vectors](https://www.rfc-editor.org/rfc/rfc8785.html#appendix-A)


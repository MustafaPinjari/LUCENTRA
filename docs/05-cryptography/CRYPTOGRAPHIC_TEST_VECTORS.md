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
- File Content: `console.log("Hello, LUCENTRA!");\n` (30 bytes, UTF-8 encoded).
- Hex Bytes: `636f6e736f6c652e6c6f67282248656c6c6f2c204c5543454e5452412122293b0a`

### Expected Outputs
- Raw Hex Digest: `4d4be953a817b1897d26bb4387877ce5cb8927878347fe3a693240ee09736829`
- Standard Formatted String: `sha256:4d4be953a817b1897d26bb4387877ce5cb8927878347fe3a693240ee09736829`

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
      "sha256": "sha256:4d4be953a817b1897d26bb4387877ce5cb8927878347fe3a693240ee09736829",
      "size": 30
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
{"createdAt":1700000000,"domain":"example.com","expiresAt":1799999999,"resources":[{"path":"/bundle.js","sha256":"sha256:4d4be953a817b1897d26bb4387877ce5cb8927878347fe3a693240ee09736829","size":30,"type":"script"}],"schemaVersion":"LUCENTRA-Manifest-v0.1","version":"0.1.0"}
```

### Expected Manifest Hash
- SHA-256 of Canonical String: `0x7a30c5e3155799a74421b47596ff1b3924fdbb8d655f419b2a64c4897f1f3e72`

---

## 4. Test Vector 3: EIP-712 Structured Data Signing

### Domain Separator Parameters
- `name`: `"LUCENTRA"`
- `version`: `"1"`
- `chainId`: `11155111` (Sepolia)
- `verifyingContract`: `0x1111111111111111111111111111111111111111`

### Signer Key Pair
- Private Key: `0x4c0883a69102937d6231471b5dbb6204db7e716b78ac5c7827453b4112f46973`
- Derived Address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

### Message Fields
- `domain`: `"example.com"`
- `version`: `"0.1.0"`
- `manifestHash`: `0x7a30c5e3155799a74421b47596ff1b3924fdbb8d655f419b2a64c4897f1f3e72`
- `timestamp`: `1700000000`
- `expiresAt`: `1799999999`

### Expected Output Signature
- `signature`: Valid secp256k1 65-byte signature recovering to `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`.

---

## 5. Related Documents

- [docs/04-protocol/CANONICALIZATION.md](../04-protocol/CANONICALIZATION.md)
- [docs/05-cryptography/EIP712_SIGNING.md](EIP712_SIGNING.md)

---

## 6. References

- [RFC 8785 Appendix A Test Vectors](https://www.rfc-editor.org/rfc/rfc8785.html#appendix-A)


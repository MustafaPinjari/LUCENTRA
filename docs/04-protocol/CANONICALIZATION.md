# Canonicalization Specification (RFC 8785) — LUCENTRA

**Document ID:** LUC-PRO-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the exact JSON Canonicalization Scheme (JCS) algorithm according to IETF RFC 8785 and specifies its implementation across all LUCENTRA supported runtimes.

---

## 2. The Determinism Challenge

Cryptographic hash functions operate on raw byte arrays, not abstract syntax trees. Standard JSON serialization exhibits multiple variations:
1. **Key Ordering:** `{"a":1,"b":2}` vs `{"b":2,"a":1}`
2. **Whitespace:** `{"a": 1}` vs `{"a":1}` vs `{\n  "a": 1\n}`
3. **Number Representations:** `1.0` vs `1` vs `1e0`
4. **Character Escaping:** `\u002F` vs `/`

RFC 8785 defines a strict, mathematically deterministic transformation converting any arbitrary JSON value into a unique canonical byte sequence.

---

## 3. RFC 8785 Canonicalization Rules

1. **Whitespace Elimination:** No whitespace is permitted outside of string literals.
2. **Object Key Sorting:** Member keys of all JSON objects must be sorted lexicographically by their UTF-16 code unit values.
3. **Number Serialization:** Numbers must be serialized in accordance with ECMAScript 2015 (ES6) 7.1.12.1 `ToStringAppliedToTheNumberType`:
   - Integers in range $[-2^{53} + 1, 2^{53} - 1]$ are formatted as plain digits without decimal points or leading zeroes.
   - Exponential notation is used only when the exponent is $< -6$ or $\ge 21$.
4. **String Serialization:** Escape sequences are restricted to `\"`, `\\`, and ASCII control characters `\u0000` through `\u001f`. All other characters (including non-ASCII Unicode and `/`) must be emitted as unescaped UTF-8.

---

## 4. Multi-Language Implementation Standard

### 4.1 TypeScript / JavaScript Implementation
```typescript
import canonicalize from "canonicalize";

export function canonicalizeManifest(manifest: object): string {
  const canonicalJson = canonicalize(manifest);
  if (!canonicalJson) {
    throw new Error("RFC 8785 canonicalization failed");
  }
  return canonicalJson;
}
```

### 4.2 Python Implementation
```python
import canonicaljson

def canonicalize_manifest(manifest: dict) -> str:
    # canonicaljson strictly implements RFC 8785
    canonical_bytes = canonicaljson.encode_canonical_json(manifest)
    return canonical_bytes.decode("utf-8")
```

### 4.3 Test Vector Verification
```json
// Input Object:
{"version": "1.0", "resources": [], "domain": "example.com", "schemaVersion": "LUCENTRA-Manifest-v0.1", "expiresAt": 1800000000, "createdAt": 1700000000}

// Canonical Output String:
{"createdAt":1700000000,"domain":"example.com","expiresAt":1800000000,"resources":[],"schemaVersion":"LUCENTRA-Manifest-v0.1","version":"1.0"}
```

---

## 5. Related Documents

- [docs/04-protocol/PROTOCOL_SPECIFICATION_V0.1.md](PROTOCOL_SPECIFICATION_V0.1.md)
- [docs/05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md](../05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md)

---

## 6. References

- [IETF RFC 8785: JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785.html)

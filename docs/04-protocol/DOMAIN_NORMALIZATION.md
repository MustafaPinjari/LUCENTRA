# Domain Normalization Specification — LUCENTRA

**Document ID:** LUC-PRO-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document defines the canonical domain normalization procedure required to prevent domain spoofing, homograph attacks, and hash divergence across the LUCENTRA protocol.

---

## 2. The Domain Spoofing Threat

Web domains can be represented in multiple forms:
- Differing case: `Example.COM` vs `example.com`
- Protocols / Ports: `https://example.com:443/`
- Trailing dots: `example.com.`
- Internationalized Domain Names (IDNs) and Cyrillic homoglyphs: `apple.com` (Latin) vs `аpple.com` (Cyrillic `а`, U+0430).

Without strict canonicalization, an attacker could register an IDN homoglyph or exploit case discrepancies to register duplicate on-chain keys or bypass client extension lookups.

---

## 3. Canonical Normalization Algorithm

Given an arbitrary input string $S$:

1. **Strip Protocol and Path:** Remove any leading protocol scheme (e.g. `http://`, `https://`) and trailing path/query/fragment components (`/.*`).
2. **Strip Port:** Remove any explicit port suffix (e.g. `:8080`, `:443`).
3. **Strip Trailing Dots:** Remove any trailing DNS root dot (`.`).
4. **IDNA 2008 / UTS #46 Mapping:** Apply Unicode Technical Standard #46 `ToASCII` processing with:
   - `UseSTD3ASCIIRules = true`
   - `CheckHyphens = true`
   - `CheckBidi = true`
   - `CheckJoiners = true`
   - `Transitional_Processing = false`
5. **Lowercase Conversion:** Convert all ASCII characters to lowercase.
6. **Syntax Validation:** Verify that the resulting domain complies with RFC 1035 / RFC 1123 label constraints (labels $\le 63$ chars, total length $\le 253$ chars).

---

## 4. Multi-Language Implementations

### 4.1 TypeScript Implementation
```typescript
import tr46 from "tr46";

export function normalizeDomain(rawDomain: string): string {
  let cleaned = rawDomain.trim();
  // Strip protocol
  cleaned = cleaned.replace(/^[a-zA-Z]+:\/\//, "");
  // Strip path and port
  cleaned = cleaned.split("/")[0].split(":")[0];
  // Strip trailing dot
  cleaned = cleaned.replace(/\.$/, "");
  
  const result = tr46.toASCII(cleaned, {
    checkBidi: true,
    checkHyphens: true,
    checkJoiners: true,
    useSTD3ASCIIRules: true,
  });
  
  if (!result) {
    throw new Error(`Invalid domain format: ${rawDomain}`);
  }
  return result.toLowerCase();
}
```

### 4.2 Python Implementation
```python
import idna

def normalize_domain(raw_domain: str) -> str:
    cleaned = raw_domain.strip()
    if "://" in cleaned:
        cleaned = cleaned.split("://")[1]
    cleaned = cleaned.split("/")[0].split(":")[0]
    cleaned = cleaned.rstrip(".")
    
    # idna implements UTS #46 / IDNA 2008
    ascii_domain = idna.encode(cleaned, uts46=True, std3_rules=True).decode("ascii")
    return ascii_domain.lower()
```

---

## 5. Domain Hash Derivation

The on-chain key for all contract lookups is the 32-byte Keccak-256 hash of the normalized domain:
```solidity
bytes32 domainHash = keccak256(bytes(normalizedDomain));
```

---

## 6. Related Documents

- [docs/06-blockchain/PUBLISHER_REGISTRY.md](../06-blockchain/PUBLISHER_REGISTRY.md)
- [docs/07-backend/DOMAIN_VERIFICATION.md](../07-backend/DOMAIN_VERIFICATION.md)

---

## 7. References

- [Unicode UTS #46: IDNA Compatibility Processing](https://unicode.org/reports/tr46/)
- [IETF RFC 1035: Domain Names - Implementation and Specification](https://www.rfc-editor.org/rfc/rfc1035.html)

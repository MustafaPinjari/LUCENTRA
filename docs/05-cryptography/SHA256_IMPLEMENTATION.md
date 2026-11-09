# SHA-256 Implementation & Performance Guide — LUCENTRA

**Document ID:** LUC-CRY-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the technical implementation of SHA-256 byte stream hashing across browser Web Workers, Node.js tooling, and Python backend services, emphasizing cryptographic correctness and execution throughput.

---

## 2. WebCrypto API Implementation (Browser Extension Web Worker)

In modern browsers, SHA-256 hashing should leverage native hardware acceleration via the SubtleCrypto API:

```typescript
// apps/extension/src/workers/hasher.worker.ts
export async function computeSha256(byteBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", byteBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hexHash}`;
}
```

### Performance Optimization Guidelines
1. **Off-Thread Execution:** Always execute `computeSha256` inside a dedicated Web Worker to ensure that large multi-megabyte bundle hashing never drops browser UI frames.
2. **Streaming Hashes:** For large bundles ($> 5\text{ MB}$), implement streaming hashing via `TransformStream` where supported to avoid loading entire files into memory simultaneously.

---

## 3. Python Implementation (Backend & Witness)

```python
import hashlib

def compute_sha256(data: bytes) -> str:
    """Computes SHA-256 and formats with standard prefix."""
    hasher = hashlib.sha256()
    hasher.update(data)
    return f"sha256:{hasher.hexdigest().lower()}"
```

---

## 4. Solidity EVM Implementation

Inside Ethereum EVM contracts, SHA-256 is available as a precompiled contract at address `0x02`:
```solidity
function hashSha256(bytes memory data) internal view returns (bytes32 result) {
    assembly {
        let len := mload(data)
        let ptr := add(data, 0x20)
        // Staticcall precompile 0x02 (SHA-256)
        if iszero(staticcall(gas(), 0x02, ptr, len, 0x00, 0x20)) {
            revert(0, 0)
        }
        result := mload(0x00)
    }
}
```

---

## 5. Related Documents

- [docs/05-cryptography/CRYPTOGRAPHIC_ARCHITECTURE.md](CRYPTOGRAPHIC_ARCHITECTURE.md)
- [docs/05-cryptography/CRYPTOGRAPHIC_TEST_VECTORS.md](CRYPTOGRAPHIC_TEST_VECTORS.md)

---

## 6. References

- [W3C Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/)
- [NIST FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)

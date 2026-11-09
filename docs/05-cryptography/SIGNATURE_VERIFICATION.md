# Signature Verification Specification — LUCENTRA

**Document ID:** LUC-CRY-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the exact cryptographic algorithms for validating EIP-712 release signatures across EVM smart contracts, off-chain Python backend services, and client-side browser extensions.

---

## 2. Cross-Platform Signature Verification

### 2.1 On-Chain Solidity Verification (`contracts/src/SignatureVerifier.sol`)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

abstract contract SignatureVerifier is EIP712 {
    bytes32 public constant RELEASE_MANIFEST_TYPEHASH = keccak256(
        "ReleaseManifest(string domain,string version,bytes32 manifestHash,uint64 timestamp,uint64 expiresAt)"
    );

    constructor(string memory name, string memory version) EIP712(name, version) {}

    function recoverReleaseSigner(
        string calldata domain,
        string calldata version,
        bytes32 manifestHash,
        uint64 timestamp,
        uint64 expiresAt,
        bytes calldata signature
    ) public view returns (address) {
        bytes32 structHash = keccak256(
            abi.encode(
                RELEASE_MANIFEST_TYPEHASH,
                keccak256(bytes(domain)),
                keccak256(bytes(version)),
                manifestHash,
                timestamp,
                expiresAt
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        return ECDSA.recover(digest, signature);
    }
}
```

### 2.2 Off-Chain TypeScript Verification (`packages/core/src/verifier.ts`)
```typescript
import { recoverTypedDataAddress } from "viem";
import { lucentraEip712Domain, lucentraEip712Types } from "./constants";

export async function verifyReleaseSignature(
  domain: string,
  version: string,
  manifestHash: `0x${string}`,
  timestamp: bigint,
  expiresAt: bigint,
  signature: `0x${string}`,
  chainId: number,
  verifyingContract: `0x${string}`
): Promise<`0x${string}`> {
  return await recoverTypedDataAddress({
    domain: lucentraEip712Domain(chainId, verifyingContract),
    types: lucentraEip712Types,
    primaryType: "ReleaseManifest",
    message: { domain, version, manifestHash, timestamp, expiresAt },
    signature,
  });
}
```

---

## 3. Related Documents

- [docs/05-cryptography/EIP712_SIGNING.md](EIP712_SIGNING.md)
- [docs/05-cryptography/REPLAY_PROTECTION.md](REPLAY_PROTECTION.md)

---

## 4. References

- [OpenZeppelin ECDSA Documentation](https://docs.openzeppelin.com/contracts/5.x/api/utils#ECDSA)
- [Viem recoverTypedDataAddress](https://viem.sh/docs/utilities/recoverTypedDataAddress.html)


# EIP-712 Signing Implementation — LUCENTRA

**Document ID:** LUC-CRY-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the reference implementation for EIP-712 typed structured data signing within the Next.js Publisher Dashboard using Wagmi and Viem.

---

## 2. Viem Signing Implementation

```typescript
import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";

export const LUCENTRA_DOMAIN_NAME = "LUCENTRA";
export const LUCENTRA_DOMAIN_VERSION = "1";

export interface ReleaseSigningParams {
  domain: string;
  version: string;
  manifestHash: `0x${string}`;
  timestamp: bigint;
  expiresAt: bigint;
  verifyingContract: `0x${string}`;
}

export async function signReleaseManifest(params: ReleaseSigningParams) {
  if (!window.ethereum) throw new Error("No Web3 wallet detected");

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  });

  const [account] = await walletClient.getAddresses();

  const domain = {
    name: LUCENTRA_DOMAIN_NAME,
    version: LUCENTRA_DOMAIN_VERSION,
    chainId: BigInt(sepolia.id),
    verifyingContract: params.verifyingContract,
  } as const;

  const types = {
    ReleaseManifest: [
      { name: "domain", type: "string" },
      { name: "version", type: "string" },
      { name: "manifestHash", type: "bytes32" },
      { name: "timestamp", type: "uint64" },
      { name: "expiresAt", type: "uint64" },
    ],
  } as const;

  const signature = await walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType: "ReleaseManifest",
    message: {
      domain: params.domain,
      version: params.version,
      manifestHash: params.manifestHash,
      timestamp: params.timestamp,
      expiresAt: params.expiresAt,
    },
  });

  return {
    signature,
    signer: account,
  };
}
```

---

## 3. Related Documents

- [docs/04-protocol/SIGNATURE_SPECIFICATION.md](../04-protocol/SIGNATURE_SPECIFICATION.md)
- [docs/05-cryptography/SIGNATURE_VERIFICATION.md](SIGNATURE_VERIFICATION.md)

---

## 4. References

- [Viem signTypedData Documentation](https://viem.sh/docs/actions/wallet/signTypedData.html)
- [EIP-712: Ethereum Typed Structured Data](https://eips.ethereum.org/EIPS/eip-712)


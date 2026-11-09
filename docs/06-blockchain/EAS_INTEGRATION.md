# Ethereum Attestation Service (EAS) Integration — LUCENTRA

**Document ID:** LUC-BC-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the technical integration between LUCENTRA and the Ethereum Attestation Service (EAS), detailing schema registrations, attestation creation, and client verification queries.

---

## 2. Official LUCENTRA EAS Schema

### Schema String
```solidity
bytes32 manifestHash, string domain, string version, bytes signature
```

### Schema Parameters
- **`revocable`:** `true` (Enables publishers to revoke compromised or corrupted releases immediately on-chain).
- **Resolver Contract:** Optional custom resolver pointing to `PublisherRegistry.sol` to enforce that the attestor must be an authorized key at the block timestamp of attestation.

---

## 3. Submitting Attestations via Viem

```typescript
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

const EAS_CONTRACT_ADDRESS_SEPOLIA = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const RELEASE_SCHEMA_UID = "0xYourRegisteredSchemaUidHere...";

export async function submitReleaseAttestation(
  signer: ethers.Signer,
  domain: string,
  version: string,
  manifestHash: `0x${string}`,
  signature: `0x${string}`
): Promise<string> {
  const eas = new EAS(EAS_CONTRACT_ADDRESS_SEPOLIA);
  eas.connect(signer);

  const schemaEncoder = new SchemaEncoder("bytes32 manifestHash, string domain, string version, bytes signature");
  const encodedData = schemaEncoder.encodeData([
    { name: "manifestHash", value: manifestHash, type: "bytes32" },
    { name: "domain", value: domain, type: "string" },
    { name: "version", value: version, type: "string" },
    { name: "signature", value: signature, type: "bytes" },
  ]);

  const tx = await eas.attest({
    schema: RELEASE_SCHEMA_UID,
    data: {
      recipient: ethers.constants.AddressZero,
      expirationTime: 0,
      revocable: true,
      data: encodedData,
    },
  });

  const newAttestationUID = await tx.wait();
  return newAttestationUID;
}
```

---

## 4. Querying Attestations in the Extension

Clients verify attestations by querying the public EAS GraphQL endpoint or calling `getAttestation(bytes32 uid)` directly via an Ethereum RPC provider.

---

## 5. Related Documents

- [docs/06-blockchain/BLOCKCHAIN_ARCHITECTURE.md](BLOCKCHAIN_ARCHITECTURE.md)
- [docs/04-protocol/RELEASE_LIFECYCLE.md](../04-protocol/RELEASE_LIFECYCLE.md)

---

## 6. References

- [Ethereum Attestation Service SDK](https://github.com/ethereum-attestation-service/eas-sdk)
- [EAS Contracts & Deployments](https://docs.attest.org/docs/quick--start/contracts)

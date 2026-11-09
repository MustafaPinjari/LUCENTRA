# Ethereum Attestation Service (EAS) Integration & Lifecycle — LUCENTRA

**Document ID:** LUC-BC-004  
**Version:** 0.2.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the technical integration between LUCENTRA and the Ethereum Attestation Service (EAS), detailing schema registrations, attestation creation, historical persistence, revocation semantics, expiration, and client verification logic during RPC failures.

---

## 2. Resolving the Immutability vs. Revocation Concept

A foundational architectural concept in EAS is the formal distinction between **historical persistence** and **current validity**:

```mermaid
flowchart TD
    subgraph OnChainRecord["EAS Attestation On-Chain Record (Immutable)"]
        AttestationUID["Attestation UID<br/>(bytes32 != 0)"]
        CreationTime["A.time<br/>(Creation Timestamp)"]
        RevocationField["A.revocationTime<br/>(0 if unrevoked; timestamp if revoked)"]
        ExpirationField["A.expirationTime<br/>(0 if indefinite; timestamp if bounded)"]
        AttesterKey["A.attester<br/>(secp256k1 Signing Address)"]
    end

    subgraph EvaluationEnvironment["Evaluation Context at T_eval"]
        CurrentTime["T_eval<br/>(Current Wall-Clock / block.timestamp)"]
        RegistryContract["PublisherRegistry.sol<br/>isKeyAuthorized(domain, attester)"]
    end

    subgraph FiveTiers["Five Independent Verification Tiers"]
        Tier1["Tier 1: Historical Existence<br/>A.uid != 0"]
        Tier2["Tier 2: Revocation Status<br/>A.revocationTime == 0"]
        Tier3["Tier 3: Expiration Status<br/>A.expirationTime == 0 OR T_eval <= A.expirationTime"]
        Tier4["Tier 4: Key Authorization<br/>PublisherRegistry.isKeyAuthorized == true"]
        Tier5["Tier 5: Current Release Verification Status<br/>V(A, T_eval) = Tier1 AND Tier2 AND Tier3 AND Tier4"]
    end

    AttestationUID --> Tier1
    RevocationField --> Tier2
    ExpirationField & CurrentTime --> Tier3
    AttesterKey & RegistryContract --> Tier4
    Tier1 & Tier2 & Tier3 & Tier4 --> Tier5
    Tier5 -- Evaluates True --> ActiveRelease["ACTIVE_VALID_RELEASE"]
    Tier5 -- Evaluates False --> InactiveRelease["EXPIRED / REVOKED / UNATTESTED"]
```

### 2.1 The Five Verification Tiers

1. **Tier 1 — Historical Attestation Existence $\mathcal{E}(A)$:**
   Once submitted to EAS, an attestation record is permanently immutable on Ethereum. It exists in contract storage and event history forever.
   $$\mathcal{E}(A) \equiv (A.\text{uid} \neq \mathbf{0})$$

2. **Tier 2 — Attestation Revocation Status $\mathcal{R}(A)$:**
   When an attestation is registered with `revocable = true`, the publisher can call `eas.revoke(RevocationRequest)`. This does not delete the record; it records `A.revocationTime = block.timestamp`.
   $$\mathcal{R}(A) \equiv (A.\text{revocationTime} \neq 0)$$
   An attestation is unrevoked if and only if $\neg \mathcal{R}(A) \iff A.\text{revocationTime} == 0$.

3. **Tier 3 — Attestation Expiration Status $\mathcal{X}(A, T_{\text{eval}})$:**
   Expiration is evaluated strictly against the **current evaluation timestamp** $T_{\text{eval}}$ (the client's current wall-clock Unix time in seconds, or `block.timestamp` during smart contract execution).
   > [!IMPORTANT]
   > Expiration is **never** checked against the attestation creation timestamp $A.\text{time}$. Comparing $A.\text{time} \le A.\text{expirationTime}$ only proves the attestation was valid at the instant it was minted. The verification engine must dynamically evaluate $T_{\text{eval}} \le A.\text{expirationTime}$.
   $$\mathcal{X}(A, T_{\text{eval}}) \equiv (A.\text{expirationTime} \neq 0 \land T_{\text{eval}} > A.\text{expirationTime})$$
   An attestation is non-expired if and only if:
   $$\neg \mathcal{X}(A, T_{\text{eval}}) \iff (A.\text{expirationTime} == 0 \lor T_{\text{eval}} \le A.\text{expirationTime})$$

4. **Tier 4 — Publisher Signing-Key Authorization $\mathcal{K}(\text{domain}, A.\text{attester})$:**
   Evaluates whether the address that signed the attestation is currently registered and active in `PublisherRegistry.sol`.
   $$\mathcal{K}(\text{domain}, A.\text{attester}) \equiv (\text{PublisherRegistry.isKeyAuthorized}(\text{domain}, A.\text{attester}) == \text{true})$$

5. **Tier 5 — Current Release Verification Status $\mathcal{V}(A, T_{\text{eval}})$:**
   $$\mathcal{V}(A, T_{\text{eval}}) \equiv \mathcal{E}(A) \land \neg \mathcal{R}(A) \land \neg \mathcal{X}(A, T_{\text{eval}}) \land \mathcal{K}(A.\text{domain}, A.\text{attester})$$
   Expanded:
   $$\mathcal{V}(A, T_{\text{eval}}) \equiv (A.\text{uid} \neq \mathbf{0}) \land (A.\text{revocationTime} == 0) \land (A.\text{expirationTime} == 0 \lor T_{\text{eval}} \le A.\text{expirationTime}) \land (\text{isKeyAuthorized}(A.\text{domain}, A.\text{attester}) == \text{true})$$

---

### 2.2 Formal Test Vectors for Attestation Validity

The following test suite formally establishes evaluation outputs across all lifecycle permutations:

| Test Vector ID | Description | $A.\text{uid}$ | $A.\text{time}$ | $A.\text{revocationTime}$ | $A.\text{expirationTime}$ | $T_{\text{eval}}$ | $\mathcal{K}$ (Key Auth) | Expected Verdict $\mathcal{V}(A, T_{\text{eval}})$ | Resulting Protocol State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TV-EAS-001** | Valid bounded release | `0x1111...` | 1,700,000,000 | 0 | 1,735,689,600 | 1,715,000,000 | `true` | **`true` (PASS)** | `VERIFIED_RELEASE_MATCH` |
| **TV-EAS-002** | Expired release | `0x2222...` | 1,700,000,000 | 0 | 1,710,000,000 | 1,715,000,000 | `true` | **`false` (FAIL)** | `UNATTESTED_RELEASE` |
| **TV-EAS-003** | Explicitly revoked release | `0x3333...` | 1,700,000,000 | 1,705,000,000 | 1,735,689,600 | 1,715,000,000 | `true` | **`false` (FAIL)** | `REVOKED_RELEASE` |
| **TV-EAS-004** | Valid indefinite release | `0x4444...` | 1,700,000,000 | 0 | 0 | 1,800,000,000 | `true` | **`true` (PASS)** | `VERIFIED_RELEASE_MATCH` |
| **TV-EAS-005** | Revoked publisher signing key | `0x5555...` | 1,700,000,000 | 0 | 1,735,689,600 | 1,715,000,000 | `false` | **`false` (FAIL)** | `REVOKED_RELEASE` |
| **TV-EAS-006** | Non-existent attestation UID | `0x0000...` | 0 | 0 | 0 | 1,715,000,000 | `true` | **`false` (FAIL)** | `UNATTESTED_RELEASE` |
| **TV-EAS-007** | Boundary: exactly at expiration | `0x7777...` | 1,700,000,000 | 0 | 1,715,000,000 | 1,715,000,000 | `true` | **`true` (PASS)** | `VERIFIED_RELEASE_MATCH` |
| **TV-EAS-008** | Boundary: 1 second past expiry | `0x8888...` | 1,700,000,000 | 0 | 1,715,000,000 | 1,715,000,001 | `true` | **`false` (FAIL)** | `UNATTESTED_RELEASE` |

### 2.3 Reference Verification Implementation (TypeScript)

```typescript
export interface EASAttestationRecord {
  uid: string;
  time: number;           // Creation timestamp
  expirationTime: number; // 0 if indefinite
  revocationTime: number; // 0 if active
  attester: string;       // Signing address
  data: string;
}

export interface VerificationContext {
  domain: string;
  evaluationTime: number; // Current wall-clock Unix seconds: Math.floor(Date.now() / 1000)
  isKeyAuthorized: (domain: string, key: string) => Promise<boolean>;
}

export async function evaluateAttestationValidity(
  attestation: EASAttestationRecord,
  ctx: VerificationContext
): Promise<{ isValid: boolean; reason?: string }> {
  // Tier 1: Existence
  if (!attestation.uid || attestation.uid === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return { isValid: false, reason: "Attestation does not exist on-chain" };
  }

  // Tier 2: Revocation
  if (attestation.revocationTime !== 0) {
    return { isValid: false, reason: `Attestation revoked at timestamp ${attestation.revocationTime}` };
  }

  // Tier 3: Expiration (checked against current evaluation time)
  if (attestation.expirationTime !== 0 && ctx.evaluationTime > attestation.expirationTime) {
    return { 
      isValid: false, 
      reason: `Attestation expired at ${attestation.expirationTime} (evaluation time: ${ctx.evaluationTime})` 
    };
  }

  // Tier 4: Key Authorization
  const authorized = await ctx.isKeyAuthorized(ctx.domain, attestation.attester);
  if (!authorized) {
    return { isValid: false, reason: `Signing key ${attestation.attester} is not authorized for ${ctx.domain}` };
  }

  return { isValid: true };
}
```

---

## 3. Official LUCENTRA EAS Schema

### Schema String
```solidity
bytes32 manifestHash, string domain, string version, bytes signature
```

### Schema Parameters
- **`revocable`:** `true` (Mandatory: enables publishers to revoke compromised or corrupted releases immediately on-chain).
- **Resolver Contract:** Optional custom resolver pointing to `PublisherRegistry.sol` to enforce that the attestor must be an authorized key at the block timestamp of attestation.

---

## 4. Submitting & Revoking Attestations (Viem / Ethers)

### 4.1 Submitting a Release Attestation
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
      expirationTime: 0, // 0 for indefinite until superseded or revoked
      revocable: true,
      data: encodedData,
    },
  });

  return await tx.wait();
}
```

### 4.2 On-Chain Revocation by Publisher
```typescript
export async function revokeReleaseAttestation(
  signer: ethers.Signer,
  attestationUid: string
): Promise<void> {
  const eas = new EAS(EAS_CONTRACT_ADDRESS_SEPOLIA);
  eas.connect(signer);

  const tx = await eas.revoke({
    schema: RELEASE_SCHEMA_UID,
    data: {
      uid: attestationUid,
    },
  });

  await tx.wait();
}
```

---

## 5. Signing-Key Revocation vs. Attestation Revocation

LUCENTRA supports two levels of on-chain revocation:
1. **Release-Level Revocation (via EAS):** The publisher revokes a specific `attestationUID` because a bug or regression was discovered in that specific release. The publisher's signing key remains valid for publishing newer releases.
2. **Key-Level Revocation (via `PublisherRegistry.sol`):** The publisher owner calls `revokeKey(domain, compromisedKey)`. All past and future releases signed by `compromisedKey` are immediately flagged as `REVOKED` by client extensions.

---

## 6. Client Handling of EVM RPC Failures

When the browser extension attempts to verify an attestation on-chain:
1. **Multi-RPC Fallback:** The extension maintains a priority list of public and private RPC endpoints (Infura, Alchemy, Cloudflare, PublicNode). If Endpoint 1 times out ($> 2000\text{ ms}$), it fails over to Endpoint 2.
2. **Cache-Validated Fallback:** If all RPC endpoints are unreachable, the extension checks if an attestation was previously verified and stored in `chrome.storage.local` within a maximum TTL of 24 hours. If found, it displays `VERIFIED_RELEASE_MATCH` with a subtle indicator: *"Cached on-chain state"*.
3. **Graceful Degradation to `INDETERMINATE`:** If the attestation is not in local cache and RPCs fail, the extension **never falsely reports verified or compromised**. It sets status to `INDETERMINATE` with message: *"Unable to verify on-chain attestation due to network connectivity."*

---

## 7. Related Documents

- [docs/06-blockchain/BLOCKCHAIN_ARCHITECTURE.md](BLOCKCHAIN_ARCHITECTURE.md)
- [docs/04-protocol/RELEASE_LIFECYCLE.md](../04-protocol/RELEASE_LIFECYCLE.md)
- [docs/05-cryptography/KEY_ROTATION_AND_REVOCATION.md](../05-cryptography/KEY_ROTATION_AND_REVOCATION.md)

---

## 8. References

- [Ethereum Attestation Service SDK](https://github.com/ethereum-attestation-service/eas-sdk)
- [EAS Revocations Documentation](https://docs.attest.org/docs/core--concepts/revocations)

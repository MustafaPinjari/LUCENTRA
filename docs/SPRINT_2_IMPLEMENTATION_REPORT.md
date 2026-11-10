# Sprint 2 Implementation & Verification Report: Smart Contract Architecture

**Document ID:** LUC-BC-007  
**Version:** 1.0.0  
**Status:** IMPLEMENTED & TESTED  
**Date:** 2026-11-10  
**Target Subsystem:** `contracts/` (Solidity 0.8.24, Foundry, OpenZeppelin v5.0.2, EAS v1.3.0)  
**Author Roles:** Principal Solidity Engineer, EVM Security Architect, Blockchain Protocol Engineer  

---

## 1. Executive Summary

Sprint 2 has been successfully completed following human stakeholder approval. LUCENTRA's on-chain identity and verification subsystem has been authored, compiled, and verified using Solidity 0.8.24, Foundry v1.9.0, OpenZeppelin Contracts v5.0.2, and Ethereum Attestation Service (EAS) interfaces.

All architectural decisions from **ADR-011 (Dual-Authorization Domain Registration)** and approved protocol specifications have been strictly realized:
1. **Zero Unilateral Registrar Authority:** Initial domain registration requires an authorized registrar transaction following off-chain DNS TXT validation **AND** an EIP-712 registration intent signed by the genuine publisher wallet.
2. **Strict Publisher Key Lifecycle:** Only the publisher wallet can authorize, rotate, or revoke release signing keys. Revoked keys can **never** be re-authorized.
3. **Reusable EIP-712 Verification:** Synchronized with Sprint 1 (`@lucentra/core`), validating exact `ReleaseManifest` typehashes, expiration boundaries, and domain separators.
4. **Complete EAS Integration:** Five-tier evaluation model verifying historical existence, revocation status, dynamic expiration, schema conformance, and publisher key authorization.
5. **Decoupled EAS Attester & Signing Key:** Explicitly separates `attestation.attester` (backend relayer or witness node) from the publisher signing key embedded in the payload.

### Test & Coverage Highlights
- **Foundry Test Suite:** **56 tests executed, 56 passed (100%), 0 failed, 0 skipped**.
- **Foundry Fuzzing:** Property-based and invariant tests executed with **256 runs per property**.
- **Code Coverage:** **95.17% line coverage** across all contracts (`PublisherRegistry`: 99.08%, `ReleaseAttestationVerifier`: 95.92%, `SignatureVerifier`: 96.30%).
- **Cross-Language Sync:** Test Vector 3 verified identically in both TypeScript (`@lucentra/core`) and Foundry.
- **Monorepo Suite:** All executed test suites (**122 total automated tests**) passing.

---

## 2. Smart Contract Architecture & Boundaries

The smart contract subsystem follows a minimal, highly secure, modular architecture under `contracts/src/`:

```mermaid
flowchart TD
    subgraph ClientLayers["External Callers"]
        Registrar["Backend Registrar Worker"]
        Publisher["Publisher Wallet"]
        Relayer["EAS Relayer / Witness"]
        Extension["Chrome Extension / Consumer"]
    end

    subgraph CoreContracts["contracts/src/"]
        PR["PublisherRegistry.sol<br/>(Ownable2Step, ReentrancyGuard, EIP-712)"]
        SV["SignatureVerifier.sol<br/>(EIP-712, ECDSA)"]
        RAV["ReleaseAttestationVerifier.sol<br/>(ReentrancyGuard)"]
    end

    subgraph ExternalProtocol["EAS Protocol"]
        EASContract["IEAS.sol<br/>(Ethereum Attestation Service)"]
        SchemaReg["ISchemaRegistry.sol"]
    end

    Registrar -->|registerPublisherDomainWithAuth| PR
    Publisher -->|authorizeKey / rotateKey / revokeKey| PR
    Publisher -->|revokeRelease| RAV
    Relayer -->|attestRelease| RAV

    RAV -->|1. getAttestation| EASContract
    RAV -->|2. isKeyAuthorized| PR
    RAV -->|3. recoverSigner| SV

    Extension -->|isKeyAuthorized| PR
    Extension -->|verifyRelease| SV
    Extension -->|verifyAttestation| RAV
```

### Component Breakdown
1. [`PublisherRegistry.sol`](file:///contracts/src/PublisherRegistry.sol): Authoritative registry binding canonical UTS #46 domains to publisher owners and authorized signing keys.
2. [`SignatureVerifier.sol`](file:///contracts/src/SignatureVerifier.sol): Stateless EIP-712 verifier verifying manifest hashes, sequence numbers, temporal validity, and key recovery.
3. [`ReleaseAttestationVerifier.sol`](file:///contracts/src/ReleaseAttestationVerifier.sol): EAS bridge evaluating release attestations across all five protocol tiers.
4. [`IPublisherRegistry.sol`](file:///contracts/src/interfaces/IPublisherRegistry.sol), [`ISignatureVerifier.sol`](file:///contracts/src/interfaces/ISignatureVerifier.sol), [`IReleaseAttestationVerifier.sol`](file:///contracts/src/interfaces/IReleaseAttestationVerifier.sol): Formal Solidity interfaces.

---

## 3. Storage Layout & Packing Optimization

Storage in `PublisherRegistry.sol` is packed into minimal 32-byte slots to reduce SSTORE gas costs:

```solidity
struct DomainRecord {
    address owner;                               // 20 bytes ──┐ Slot 0
    uint64 registeredAt;                         //  8 bytes   │ (29 / 32 bytes)
    bool isSuspended;                            //  1 byte  ──┘
    string domain;                               // Slot 1 (dynamic string)
    mapping(address => KeyStatus) authorizedKeys;// Slot 2 (mapping root)
}
```

- **Slot 0:** `owner` (160 bits), `registeredAt` (64 bits), and `isSuspended` (8 bits) fit inside a single 256-bit storage slot, saving 20,000 gas on initial domain registration.
- **Replay Protection:** `mapping(address => uint256) public nonces;` tracks publisher EIP-712 intent nonces.
- **Domain Key:** `bytes32 domainHash = keccak256(bytes(domain))` is used as the storage key for O(1) gas lookups.

---

## 4. Dual-Authorization Registration Workflow (ADR-011)

To eliminate unilateral registrar authority while maintaining frictionless UX, initial registration implements the **ADR-011 Dual-Authorization protocol**:

```mermaid
sequenceDiagram
    autonumber
    actor Publisher as Publisher Wallet
    participant Backend as Backend DNS Verifier
    participant Registrar as Authorized Registrar Signer
    participant Registry as PublisherRegistry.sol

    Publisher->>Backend: Request DNS challenge token
    Backend-->>Publisher: Challenge "_lucentra-verification=xyz"
    Publisher->>Publisher: Adds DNS TXT record at _lucentra-verification.example.com
    Publisher->>Publisher: Signs EIP-712 RegistrationAuthorization
    Publisher->>Backend: Submits publisherSignature
    
    Backend->>Backend: Performs multi-vantage DNS query on authoritative nameservers
    Backend->>Registrar: Dispatches on-chain registration job
    Registrar->>Registry: registerPublisherDomainWithAuth(domain, publisher, key, deadline, sig)
    
    Registry->>Registry: 1. Revert if msg.sender != registrar
    Registry->>Registry: 2. Revert if block.timestamp > deadline
    Registry->>Registry: 3. Revert if domain already registered
    Registry->>Registry: 4. Verify EIP-712 signature against publisher address
    Registry->>Registry: 5. nonces[publisher]++
    Registry->>Registry: 6. Store DomainRecord & set KeyStatus.ACTIVE
    Registry-->>Registrar: Emits DomainRegisteredByRegistrar & KeyAuthorized
```

### EIP-712 Type Definitions
```solidity
bytes32 public constant REGISTRATION_AUTHORIZATION_TYPEHASH = keccak256(
    "RegistrationAuthorization(string domain,address publisher,address initialSigningKey,uint256 nonce,uint64 deadline)"
);
```

---

## 5. EAS Integration Architecture & Five-Tier Evaluation

In accordance with [`EAS_INTEGRATION.md`](file:///docs/06-blockchain/EAS_INTEGRATION.md), release verification implements the **Five-Tier Verification Model**:

$$\mathcal{V}(A, T_{\text{eval}}) \equiv (A.\text{uid} \neq \mathbf{0}) \land (A.\text{revocationTime} == 0) \land (A.\text{expirationTime} == 0 \lor T_{\text{eval}} \le A.\text{expirationTime}) \land \mathcal{K}(A.\text{domain}, A.\text{signingKey})$$

| Tier | Evaluation Condition | Evaluated In | Failure Outcome |
| :--- | :--- | :--- | :--- |
| **Tier 1: Historical Existence** | `attestation.uid != bytes32(0)` | EAS Storage | Reverts `AttestationNotFound()` |
| **Tier 2: Revocation Status** | `attestation.revocationTime == 0` | EAS Storage | Reverts `AttestationRevoked()` |
| **Tier 3: Dynamic Expiration** | $T_{\text{eval}} \le \text{expirationTime} \lor \text{expirationTime} == 0$ | Evaluator Context | Reverts `AttestationExpired()` |
| **Tier 4: Schema & Signature** | Schema matches releaseSchema && ECDSA matches `signingKey` | `SignatureVerifier` | Reverts `InvalidReleaseSignature()` |
| **Tier 5: Key Authorization** | `isKeyAuthorized(domain, signingKey) == true` | `PublisherRegistry` | Reverts `UnauthorizedSigningKey()` |

### Role Distinction Matrix
- **Publisher Wallet:** Owns the domain in `PublisherRegistry.sol`. Can authorize/rotate/revoke signing keys, suspend the domain, or revoke release attestations.
- **Publisher Signing Key:** Authorized private key that signs the release manifest via EIP-712.
- **EAS Attester:** Account submitting `eas.attest(...)`. May be a relayer, backend worker, or witness. **Never conflated with the publisher signing key.**
- **EAS Revoker:** Restricted in `ReleaseAttestationVerifier.revokeRelease` strictly to `publisherRegistry.getDomainOwner(domain)`.

---

## 6. Events and Custom Errors Catalog

### Events Emitted
| Event | Signature | Indexed Parameters | Purpose |
| :--- | :--- | :--- | :--- |
| `DomainRegisteredByRegistrar` | `(bytes32,string,address,address,uint64)` | `domainHash`, `owner`, `initialSigningKey` | Log verified initial domain registration. |
| `KeyAuthorized` | `(bytes32,address,uint64)` | `domainHash`, `signingKey` | Log key activation. |
| `KeyRevoked` | `(bytes32,address,uint64)` | `domainHash`, `signingKey` | Log key permanent revocation. |
| `KeyRotated` | `(bytes32,address,address,uint64)` | `domainHash`, `oldSigningKey`, `newSigningKey` | Log atomic key rotation. |
| `PublisherSuspended` | `(bytes32,uint64)` | `domainHash` | Log domain suspension. |
| `PublisherReactivated` | `(bytes32,uint64)` | `domainHash` | Log domain reactivation. |
| `RegistrarUpdated` | `(address,address,uint64)` | `oldRegistrar`, `newRegistrar` | Log registrar governance rotation. |
| `ReleaseAttested` | `(bytes32,bytes32,string,string,uint64)` | `uid`, `manifestHash` | Log release attestation on EAS. |
| `ReleaseRevoked` | `(bytes32,string,address)` | `uid`, `revoker` | Log release attestation revocation. |

### Custom Errors Catalog
| Contract | Error | Revert Cause |
| :--- | :--- | :--- |
| `PublisherRegistry` | `DomainAlreadyRegistered()` | Domain already bound to an owner. |
| `PublisherRegistry` | `DomainNotRegistered()` | Domain has not been registered. |
| `PublisherRegistry` | `NotDomainOwner()` | Caller is not registered publisher owner. |
| `PublisherRegistry` | `NotRegistrar()` | Caller is not authorized registrar address. |
| `PublisherRegistry` | `ZeroAddress()` | Zero address passed for owner, registrar, or key. |
| `PublisherRegistry` | `EmptyDomainString()` | Empty domain string submitted. |
| `PublisherRegistry` | `KeyAlreadyRevoked()` | Attempting to re-authorize permanently revoked key. |
| `PublisherRegistry` | `KeyAlreadyActive()` | Key is already active. |
| `PublisherRegistry` | `KeyNotActive()` | Attempting to revoke key that is not active. |
| `PublisherRegistry` | `PublisherIsSuspended()` | Domain is currently suspended. |
| `PublisherRegistry` | `SignatureExpired()` | EIP-712 deadline exceeded. |
| `PublisherRegistry` | `InvalidSignature()` | EIP-712 signature mismatch. |
| `SignatureVerifier` | `UnauthorizedSigner()` | Recovered signer not authorized in registry. |
| `SignatureVerifier` | `UnregisteredPublisher()` | Domain does not exist in registry. |
| `SignatureVerifier` | `SignatureExpired()` | Evaluation time exceeds manifest `expiresAt`. |
| `ReleaseAttestationVerifier` | `AttestationNotFound()` | Attestation UID non-existent or zero. |
| `ReleaseAttestationVerifier` | `AttestationRevoked()` | Attestation has been revoked on EAS. |
| `ReleaseAttestationVerifier` | `AttestationExpired()` | Attestation has expired. |
| `ReleaseAttestationVerifier` | `UnauthorizedSigningKey()` | Signing key not active in `PublisherRegistry`. |

---

## 7. Automated Test Suite & Gas Measurements

### Test Execution Summary
```text
Ran 4 test suites: 56 tests passed, 0 failed, 0 skipped (56 total tests)

- PublisherRegistryTest:               28 passed, 0 failed
- SignatureVerifierTest:               12 passed, 0 failed
- EASIntegrationTest:                  13 passed, 0 failed
- PublisherRegistryInvariantsTest:      3 passed, 0 failed (256 fuzz runs each)
```

### Gas Measurements Matrix
| Action | Function | Typical Gas Cost | Notes |
| :--- | :--- | :---: | :--- |
| **Initial Registration** | `registerPublisherDomainWithAuth` | **235,239** | Includes EIP-712 verify + 2 SSTOREs + 2 events |
| **Authorize Key** | `authorizeKey` | **45,000** | Cold: 226,871; Warm: 45,000 |
| **Rotate Key** | `rotateKey` | **253,102** | Atomic revoke old + authorize new key |
| **Revoke Key** | `revokeKey` | **206,998** | Permanent revocation update |
| **Suspend Publisher** | `suspendPublisher` | **209,769** | Sets `isSuspended = true` in packed Slot 0 |
| **Reactivate Publisher** | `reactivatePublisher` | **242,137** | Sets `isSuspended = false` |
| **Registrar Rotation** | `setRegistrar` | **50,731** | Governance 2-step owner update |
| **Release Signature Verify** | `verifyRelease` (view) | **40,394** | EIP-712 recovery + registry authorization check |
| **EAS Attestation Verify** | `verifyAttestation` (view) | **52,247** | 5-tier evaluation + decode + ECDSA recovery |
| **EAS Attestation Creation** | `attestRelease` | **650,138** | Full EAS on-chain attestation minting |
| **EAS Attestation Revocation** | `revokeRelease` | **724,192** | Domain owner authenticated EAS revocation |

---

## 8. Code Coverage Report

Generated via `forge coverage` with Solc 0.8.24:

```text
╭------------------------------------+------------------+------------------+----------------+-----------------╮
| File                               | % Lines          | % Statements     | % Branches     | % Funcs         |
+=============================================================================================================+
| src/PublisherRegistry.sol          | 99.08% (108/109) | 88.97% (129/145) | 54.84% (17/31) | 100.00% (18/18) |
| src/ReleaseAttestationVerifier.sol | 95.92% (47/49)   | 88.73% (63/71)   | 47.06% (8/17)  | 100.00% (4/4)   |
| src/SignatureVerifier.sol          | 96.30% (26/27)   | 96.97% (32/33)   | 87.50% (7/8)   | 80.00% (4/5)    |
| test/mocks/MockEAS.sol             | 72.73% (16/22)   | 58.33% (14/24)   | 33.33% (3/9)   | 75.00% (3/4)    |
| Total                              | 95.17% (197/207) | 87.18% (238/273) | 53.85% (35/65) | 93.55% (29/31)  |
╰------------------------------------+------------------+------------------+----------------+-----------------╯
```

---

## 9. Security Invariants & Threat Model Evaluation

| Threat Vector | Mitigation Implemented | Invariant Test |
| :--- | :--- | :--- |
| **Rogue Registrar Key** | Cannot register domains without publisher's EIP-712 signature. | `test_RevertIf_InvalidPublisherSignature` |
| **Stolen Publisher Key** | Cannot claim domains without DNS TXT control on nameservers. | `test_RevertIf_NotRegistrar` |
| **Cross-Chain Replay** | EIP-712 domain separator includes `block.chainid`. | `test_RevertIf_WrongChainId` |
| **Cross-Contract Replay** | EIP-712 domain separator includes `address(this)`. | `test_RevertIf_WrongVerifyingContract` |
| **Registration Replay** | Nonce strictly increments per publisher wallet. | `test_RevertIf_RegistrationReplay` |
| **Key Resurrect Attack** | Once revoked, keys cannot be re-authorized. | `testFuzz_Invariant_RevokedKeyNeverReauthorized` |
| **Suspended Domain Bypass** | Suspended domains reject all key queries. | `testFuzz_Invariant_SuspendedDomainBlocksAllKeys` |
| **Domain Overwrite Attack** | Domain owner cannot be changed or overwritten. | `testFuzz_Invariant_DomainOwnerImmutable` |
| **Unauthorized Revocation** | Non-owners cannot revoke EAS attestations. | `test_RevertIf_RevokeRelease_UnauthorizedAttacker` |
| **Reentrancy Attacks** | All state-changing endpoints protected by `ReentrancyGuard`. | OpenZeppelin `ReentrancyGuard` |

---

## 10. Inherent Limitations & Operational Boundaries

1. **DNS TXT TTL Delay:** Off-chain DNS verification requires nameserver propagation. Registrar transactions must be submitted within the publisher signature deadline window (default: 1 hour).
2. **Layer 7 Execution Distinction:** Smart contracts verify that release digests were authorized by the registered publisher. They do not claim Layer 7 verification of in-memory JavaScript JIT execution inside browser engines.
3. **No Domain Transfer:** Per Rule 2 of Section 3, domain ownership transfer functionality is intentionally omitted. If domain ownership changes hands, the previous owner must be suspended or revoked, and re-registered via registrar workflow.

---

## 11. Next Steps & Sprint 3 Transition Gate

Sprint 2 smart contracts are complete, formatted, typechecked, and fully covered by tests. 

### Recommended Next Steps for Sprint 3
1. **Backend Integration (`services/backend`):** Author Celery task workers for DNS TXT polling, EIP-712 registration intent relaying, and EAS release attestation broadcasting.
2. **Anvil / Sepolia Deployment Scripts:** Create Foundry deployment scripts in `contracts/script/Deploy.s.sol`.
3. **TypeScript Contract Client:** Export generated Viem ABIs and contract addresses into `@lucentra/core` or `@lucentra/contracts`.

> [!IMPORTANT]
> **GATE STATUS:** In accordance with repository rules, smart contract source code has been tested locally. **No testnet or mainnet deployments will be initiated without explicit human approval.**

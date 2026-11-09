# Publisher Registry Specification (`PublisherRegistry.sol`) — LUCENTRA

**Document ID:** LUC-BC-003  
**Version:** 0.2.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the complete technical specification and Solidity reference implementation for `PublisherRegistry.sol`. It defines the on-chain domain-to-owner registry, the authorized registrar role for initial domain binding, publisher-governed key rotation, and comprehensive registrar security assumptions.

---

## 2. Architectural Principles & Invariants

1. **Off-Chain DNS TXT Validation:** DNS TXT verification is inherently non-deterministic and involves external network lookups. It is executed off-chain by the LUCENTRA verification worker.
2. **Authorized Registrar Submission:** There is **no publicly callable registration function** that allows arbitrary domain claims or reliance on public relaying. Initial domain binding is submitted strictly by an authorized `Registrar` role (`onlyRegistrar`).
3. **Publisher-Governed Key Rotation:** Once a domain is registered to an owner address, **only the publisher owner wallet** (`onlyDomainOwner`) can authorize new release signing keys or revoke keys. The registrar has zero authority over signing keys of registered domains.
4. **Auditable Registrar Events:** Every registrar action emits a dedicated, indexed event (`DomainRegisteredByRegistrar`).
5. **No Domain Overwriting:** Once registered, a domain cannot be overwritten by the registrar.

---

## 3. Complete Solidity Reference Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PublisherRegistry
 * @notice Authoritative registry binding normalized domains to publisher owner wallets and authorized signing keys.
 * @dev Initial domain registration is restricted to an authorized registrar role following off-chain DNS TXT validation.
 */
contract PublisherRegistry is Ownable2Step, ReentrancyGuard {
    enum KeyStatus { UNAUTHORIZED, ACTIVE, REVOKED }

    struct DomainRecord {
        address owner;
        uint64 registeredAt;
        bool isRevoked;
        string domain;
        mapping(address => KeyStatus) authorizedKeys;
    }

    /// @notice Authorized registrar address permitted to register newly verified domains
    address public registrar;

    /// @notice Mapping of keccak256(normalizedDomain) to DomainRecord
    mapping(bytes32 => DomainRecord) private _domains;

    // Events
    event DomainRegisteredByRegistrar(
        bytes32 indexed domainHash,
        string domain,
        address indexed owner,
        uint64 timestamp
    );
    event KeyAuthorized(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event KeyRevoked(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event DomainRevoked(bytes32 indexed domainHash, uint64 timestamp);
    event RegistrarUpdated(address indexed oldRegistrar, address indexed newRegistrar, uint64 timestamp);

    // Custom Errors
    error DomainAlreadyRegistered();
    error DomainNotRegistered();
    error NotDomainOwner();
    error NotRegistrar();
    error ZeroAddress();
    error EmptyDomainString();
    error KeyAlreadyRevoked();
    error KeyNotActive();

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert NotRegistrar();
        _;
    }

    modifier onlyDomainOwner(string calldata domain) {
        bytes32 dHash = keccak256(bytes(domain));
        if (_domains[dHash].owner != msg.sender) revert NotDomainOwner();
        _;
    }

    constructor(address initialRegistrar) Ownable(msg.sender) {
        if (initialRegistrar == address(0)) revert ZeroAddress();
        registrar = initialRegistrar;
        emit RegistrarUpdated(address(0), initialRegistrar, uint64(block.timestamp));
    }

    /**
     * @notice Registers a newly verified domain and assigns ownership to the publisher's wallet.
     * @dev Restricted strictly to the authorized registrar role. No public registration exists.
     * @param domain The normalized domain name (UTS #46 canonical form).
     * @param owner The verified publisher owner address.
     */
    function registerDomain(
        string calldata domain,
        address owner
    ) external onlyRegistrar nonReentrant {
        if (bytes(domain).length == 0) revert EmptyDomainString();
        if (owner == address(0)) revert ZeroAddress();

        bytes32 dHash = keccak256(bytes(domain));
        if (_domains[dHash].owner != address(0)) revert DomainAlreadyRegistered();

        DomainRecord storage rec = _domains[dHash];
        rec.owner = owner;
        rec.registeredAt = uint64(block.timestamp);
        rec.domain = domain;
        rec.authorizedKeys[owner] = KeyStatus.ACTIVE;

        emit DomainRegisteredByRegistrar(dHash, domain, owner, uint64(block.timestamp));
        emit KeyAuthorized(dHash, owner, uint64(block.timestamp));
    }

    /**
     * @notice Authorizes a new release signing key for a domain.
     * @dev Governed exclusively by the domain owner wallet.
     */
    function authorizeKey(
        string calldata domain,
        address signingKey
    ) external onlyDomainOwner(domain) {
        if (signingKey == address(0)) revert ZeroAddress();
        bytes32 dHash = keccak256(bytes(domain));
        if (_domains[dHash].authorizedKeys[signingKey] == KeyStatus.REVOKED) revert KeyAlreadyRevoked();

        _domains[dHash].authorizedKeys[signingKey] = KeyStatus.ACTIVE;
        emit KeyAuthorized(dHash, signingKey, uint64(block.timestamp));
    }

    /**
     * @notice Permanently revokes an authorized signing key for a domain.
     * @dev Governed exclusively by the domain owner wallet.
     */
    function revokeKey(
        string calldata domain,
        address signingKey
    ) external onlyDomainOwner(domain) {
        bytes32 dHash = keccak256(bytes(domain));
        if (_domains[dHash].authorizedKeys[signingKey] != KeyStatus.ACTIVE) revert KeyNotActive();

        _domains[dHash].authorizedKeys[signingKey] = KeyStatus.REVOKED;
        emit KeyRevoked(dHash, signingKey, uint64(block.timestamp));
    }

    /**
     * @notice Revokes a domain registration in an emergency.
     * @dev Governed exclusively by the domain owner wallet.
     */
    function revokeDomain(string calldata domain) external onlyDomainOwner(domain) {
        bytes32 dHash = keccak256(bytes(domain));
        _domains[dHash].isRevoked = true;
        emit DomainRevoked(dHash, uint64(block.timestamp));
    }

    /**
     * @notice Checks if a signing key is currently active and authorized for a domain.
     */
    function isKeyAuthorized(
        string calldata domain,
        address signingKey
    ) external view returns (bool) {
        bytes32 dHash = keccak256(bytes(domain));
        DomainRecord storage rec = _domains[dHash];
        if (rec.isRevoked) return false;
        return rec.authorizedKeys[signingKey] == KeyStatus.ACTIVE;
    }

    /**
     * @notice Returns the registered owner address of a domain.
     */
    function getDomainOwner(string calldata domain) external view returns (address) {
        return _domains[keccak256(bytes(domain))].owner;
    }

    /**
     * @notice Updates the authorized registrar address.
     * @dev Restricted strictly to contract owner (Governance Multisig).
     */
    function setRegistrar(address newRegistrar) external onlyOwner {
        if (newRegistrar == address(0)) revert ZeroAddress();
        emit RegistrarUpdated(registrar, newRegistrar, uint64(block.timestamp));
        registrar = newRegistrar;
    }
}
```

---

## 4. Registrar Trust Assumptions, Compromise Scenarios & Recovery

### 4.1 Trust Assumptions
- **Off-Chain Verification Fidelity:** The registrar service is assumed to execute authoritative DNS TXT checks faithfully, confirming that `_lucentra-verification.<domain>` contains the high-entropy challenge issued to the claimant before submitting `registerDomain`.
- **Bounded Power:** The registrar has authority **only** to register previously unclaimed domains (`DomainAlreadyRegistered()` reverts if claimed). The registrar **cannot**:
  - Overwrite or transfer an existing domain registration.
  - Authorize or revoke signing keys on behalf of a registered publisher.
  - Sign release manifests (attestations require the publisher's authorized key).

### 4.2 Compromise Scenarios
- **Scenario A: Registrar Key Stolen:** An attacker gains access to the registrar private key.
  - *Attacker Capability:* Attacker could register unclaimed domains (e.g. `unclaimed-site.com`) to their own address.
  - *Attacker Inability:* Attacker **cannot** alter existing registrations (e.g. `uniswap.org` or `app.example.com`). Existing publishers remain protected.
- **Scenario B: DNS Hijack during Challenge:** An attacker temporarily hijacks DNS TXT records during verification.
  - *Mitigation:* Multi-vantage DNS querying across multiple authoritative root servers, with minimum TTL persistence requirement.

### 4.3 Recovery Procedures
1. **Immediate Registrar Rotation:** Contract ownership is held by a secure Gnosis Safe multisig. Upon detection of registrar compromise, governance invokes `setRegistrar(newRegistrarAddress)` immediately.
2. **Disputed Domain Suspension:** If an attacker registered an unclaimed domain fraudulently during a compromise window, the multi-sig governance can deploy a patch or registry upgrade via standard governance workflows.

---

## 5. Related Documents

- [docs/03-architecture/decisions/ADR-002.md](../03-architecture/decisions/ADR-002.md)
- [docs/03-architecture/decisions/ADR-006.md](../03-architecture/decisions/ADR-006.md)
- [docs/06-blockchain/CONTRACT_INTERFACES.md](CONTRACT_INTERFACES.md)
- [docs/07-backend/DOMAIN_VERIFICATION.md](../07-backend/DOMAIN_VERIFICATION.md)

---

## 6. References

- [OpenZeppelin Ownable2Step](https://docs.openzeppelin.com/contracts/5.x/api/access#Ownable2Step)

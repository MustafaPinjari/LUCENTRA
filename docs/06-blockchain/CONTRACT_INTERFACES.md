# Smart Contract Interfaces & ABI Definitions — LUCENTRA

**Document ID:** LUC-BC-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the formal Solidity interfaces (`IPublisherRegistry.sol`) and ABI specifications for integration with frontend dashboards, backend workers, and client extensions.

---

## 2. `IPublisherRegistry.sol` Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IPublisherRegistry {
    enum KeyStatus { UNAUTHORIZED, ACTIVE, REVOKED }

    event DomainRegistered(bytes32 indexed domainHash, string domain, address indexed owner, uint64 timestamp);
    event KeyAuthorized(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event KeyRevoked(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event DomainRevoked(bytes32 indexed domainHash, uint64 timestamp);

    function registerDomain(
        string calldata domain,
        address owner,
        uint256 deadline,
        bytes calldata verifierSignature
    ) external;

    function authorizeKey(string calldata domain, address signingKey) external;

    function revokeKey(string calldata domain, address signingKey) external;

    function isKeyAuthorized(string calldata domain, address signingKey) external view returns (bool);

    function getDomainOwner(string calldata domain) external view returns (address);
}
```

---

## 3. Related Documents

- [docs/06-blockchain/PUBLISHER_REGISTRY.md](PUBLISHER_REGISTRY.md)
- [docs/06-blockchain/EVENTS_AND_ERRORS.md](EVENTS_AND_ERRORS.md)

---

## 4. References

- [Solidity Interface Documentation](https://docs.solidity.org/en/v0.8.24/contracts.html#interfaces)

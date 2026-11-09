# Events and Custom Errors — LUCENTRA Smart Contracts

**Document ID:** LUC-BC-006  
**Version:** 0.2.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs all Solidity events and custom errors emitted by LUCENTRA smart contracts, specifying topics, indexed arguments, and gas-saving error reverts.

---

## 2. Solidity Events Catalog

| Event Name | Signature | Indexed Parameters | Emitted When |
| :--- | :--- | :--- | :--- |
| **`DomainRegisteredByRegistrar`** | `DomainRegisteredByRegistrar(bytes32,string,address,uint64)` | `bytes32 domainHash`, `address owner` | Authorized registrar registers verified domain to owner. |
| **`KeyAuthorized`** | `KeyAuthorized(bytes32,address,uint64)` | `bytes32 domainHash`, `address signingKey` | Domain owner authorizes a new release signing key. |
| **`KeyRevoked`** | `KeyRevoked(bytes32,address,uint64)` | `bytes32 domainHash`, `address signingKey` | Domain owner permanently revokes an active key. |
| **`DomainRevoked`** | `DomainRevoked(bytes32,uint64)` | `bytes32 domainHash` | Domain owner revokes or suspends their domain registration. |
| **`RegistrarUpdated`** | `RegistrarUpdated(address,address,uint64)` | `address oldRegistrar`, `address newRegistrar` | Governance multisig updates the authorized registrar address. |

---

## 3. Custom Errors Catalog

| Error Selector | Custom Error | Revert Condition |
| :--- | :--- | :--- |
| `0x...` | `DomainAlreadyRegistered()` | Attempting to register an already claimed domain. |
| `0x...` | `DomainNotRegistered()` | Querying an unregistered domain. |
| `0x...` | `NotDomainOwner()` | Caller is not the registered owner of the target domain. |
| `0x...` | `NotRegistrar()` | Caller is not the authorized registrar address. |
| `0x...` | `ZeroAddress()` | Providing `address(0)` for owner, registrar, or key. |
| `0x...` | `EmptyDomainString()` | Providing an empty domain string to registrar. |
| `0x...` | `KeyAlreadyRevoked()` | Attempting to re-authorize a permanently revoked signing key. |
| `0x...` | `KeyNotActive()` | Attempting to revoke an inactive or unauthorized key. |

---

## 4. Related Documents

- [docs/06-blockchain/PUBLISHER_REGISTRY.md](PUBLISHER_REGISTRY.md)
- [docs/06-blockchain/CONTRACT_INTERFACES.md](CONTRACT_INTERFACES.md)

---

## 5. References

- [Solidity Custom Errors](https://docs.solidity.org/en/v0.8.24/contracts.html#errors-and-the-revert-statement)

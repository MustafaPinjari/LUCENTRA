# Events and Custom Errors — LUCENTRA Smart Contracts

**Document ID:** LUC-BC-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs all Solidity events and custom errors emitted by LUCENTRA smart contracts, specifying topics, indexed arguments, and gas-saving error reverts.

---

## 2. Solidity Events Catalog

| Event Name | Signature | Indexed Parameters | Emitted When |
| :--- | :--- | :--- | :--- |
| **`DomainRegistered`** | `DomainRegistered(bytes32,string,address,uint64)` | `bytes32 domainHash`, `address owner` | A new domain is verified and bound to an owner. |
| **`KeyAuthorized`** | `KeyAuthorized(bytes32,address,uint64)` | `bytes32 domainHash`, `address signingKey` | A new release signing key is granted authorization. |
| **`KeyRevoked`** | `KeyRevoked(bytes32,address,uint64)` | `bytes32 domainHash`, `address signingKey` | An authorized key is permanently revoked. |
| **`DomainRevoked`** | `DomainRevoked(bytes32,uint64)` | `bytes32 domainHash` | A domain registration is suspended or revoked by its owner. |

---

## 3. Custom Errors Catalog

Custom errors save significant deployment and execution gas compared to `require(..., "string")`:

| Error Selector | Custom Error | Revert Condition |
| :--- | :--- | :--- |
| `0x...` | `DomainAlreadyRegistered()` | Attempting to register an already claimed domain. |
| `0x...` | `NotDomainOwner()` | Caller is not the registered owner of the target domain. |
| `0x...` | `InvalidVerifierSignature()` | The DNS verification ticket signature does not match `dnsVerifierSigner`. |
| `0x...` | `SignatureExpired()` | `block.timestamp > deadline` on registration submission. |
| `0x...` | `KeyAlreadyRevoked()` | Attempting to re-authorize a permanently revoked signing key. |

---

## 4. Related Documents

- [docs/06-blockchain/PUBLISHER_REGISTRY.md](PUBLISHER_REGISTRY.md)
- [docs/06-blockchain/GAS_OPTIMIZATION.md](GAS_OPTIMIZATION.md)

---

## 5. References

- [Solidity Custom Errors](https://docs.solidity.org/en/v0.8.24/contracts.html#errors-and-the-revert-statement)

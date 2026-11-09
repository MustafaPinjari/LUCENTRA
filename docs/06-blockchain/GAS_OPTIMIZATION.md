# Gas Optimization Analysis — LUCENTRA

**Document ID:** LUC-BC-009  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the gas optimization techniques applied to LUCENTRA smart contracts to minimize deployment costs and operational transaction fees.

---

## 2. Gas Benchmarks Target

| Function Name | Target Gas (Foundry) | Primary Optimization Applied |
| :--- | :--- | :--- |
| `constructor` | $\le 850,000\text{ gas}$ | Immutable verifier address; minimal constructor logic |
| `registerDomain` | $\le 75,000\text{ gas}$ | Tightly packed `DomainRecord`; single SSTORE for primary flags |
| `authorizeKey` | $\le 28,000\text{ gas}$ | Custom errors; direct mapping update |
| `revokeKey` | $\le 26,000\text{ gas}$ | Custom errors; minimal state mutation |
| `isKeyAuthorized` | $\le 2,400\text{ gas}$ (view) | SLOAD read directly from mapping |

---

## 3. Implemented Optimization Patterns

1. **Custom Errors vs Require Strings:** Replaced all `require(condition, "Error String")` with `if (!condition) revert CustomError()`, saving ~50 gas per revert and dramatically reducing compiled contract bytecode size.
2. **Calldata vs Memory:** All external functions declare non-mutated string and bytes arguments as `calldata` rather than `memory`, eliminating memory allocation overhead.
3. **Storage Slot Packing:** Grouped `owner` (20 bytes), `registeredAt` (8 bytes), and `isRevoked` (1 byte) within the same 32-byte storage slot.
4. **Precomputed Typehashes:** Declared EIP-712 type hashes as `bytes32 public constant` so they are evaluated at compile time rather than dynamically during execution.

---

## 4. Related Documents

- [docs/06-blockchain/SMART_CONTRACT_DESIGN.md](SMART_CONTRACT_DESIGN.md)
- [docs/06-blockchain/EVENTS_AND_ERRORS.md](EVENTS_AND_ERRORS.md)

---

## 5. References

- [Solidity Gas Optimization Techniques](https://github.com/iskdrews/awesome-solidity-gas-optimization)

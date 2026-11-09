# Smart Contract Security & Formal Invariants — LUCENTRA

**Document ID:** LUC-SEC-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the security model, formal invariants, and fuzz testing rules applied to the LUCENTRA Solidity smart contracts.

---

## 2. Formal Invariants

1. **Domain Immutability:** Once a domain $D$ is registered to owner address $A$, no address $B \ne A$ can claim ownership of $D$ without $A$ initiating an explicit ownership transfer.
2. **Permanent Key Revocation:** If `domains[dHash].authorizedKeys[key] == KeyStatus.REVOKED`, it is mathematically impossible for any contract function to transition `key` back to `KeyStatus.ACTIVE`.
3. **Verifier Signature Binding:** A domain registration ticket with nonce $N$ for owner $A$ cannot be used by address $B$, cannot be reused ($N$ increments monotonically), and cannot be executed after `deadline`.

---

## 3. Foundry Fuzz & Invariant Testing Rules

```solidity
// test/invariants/PublisherRegistryInvariant.t.sol
function invariant_revokedKeysNeverReactivated(address caller, address rogueKey) public {
    // If a key was revoked, assert isKeyAuthorized returns false for all future states
    if (registry.isKeyRevoked(domain, rogueKey)) {
        assertFalse(registry.isKeyAuthorized(domain, rogueKey));
    }
}
```

---

## 4. Related Documents

- [docs/06-blockchain/PUBLISHER_REGISTRY.md](../06-blockchain/PUBLISHER_REGISTRY.md)
- [docs/12-testing/CONTRACT_TESTING.md](../12-testing/CONTRACT_TESTING.md)

---

## 5. References

- [Consensys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Foundry Invariant Testing Guide](https://book.getfoundry.sh/forge/invariant-testing)

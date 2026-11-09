# Witness Identity & Authorization — LUCENTRA

**Document ID:** LUC-WIT-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the identity registration, cryptographic key lifecycle, and authorization mechanisms governing witness node operators in LUCENTRA.

---

## 2. Witness Node Identity Model

Every witness node maintains a dedicated secp256k1 keypair. For MVP v0.1:
- Witness public addresses are registered in the LUCENTRA backend database with authorized operator labels (e.g. `LUCENTRA-Foundation-01`, `SecurityLab-EU-01`).
- Future decentralized governance (Phase 3) incorporates on-chain staking contracts (`WitnessRegistry.sol`) where nodes bond tokens to participate and earn protocol fees.

---

## 3. Cryptographic Non-Repudiation

When a witness node submits an audit report:
1. Canonicalizes the observation JSON using RFC 8785.
2. Hashes the canonical byte stream using SHA-256.
3. Signs the hash via standard Ethereum `personal_sign` or raw secp256k1 ECDSA.
4. The backend verifies that the recovered signer matches an active registered witness node address.

---

## 4. Related Documents

- [docs/10-witness-network/WITNESS_ARCHITECTURE.md](WITNESS_ARCHITECTURE.md)
- [docs/10-witness-network/OBSERVATION_FORMAT.md](OBSERVATION_FORMAT.md)

---

## 5. References

- [SEC 2: Recommended Elliptic Curve Domain Parameters](https://www.secg.org/sec2-v2.pdf)

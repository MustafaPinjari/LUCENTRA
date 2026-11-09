# Network Configuration & RPC Strategy — LUCENTRA

**Document ID:** LUC-BC-007  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs the EVM network configurations, Chain IDs, RPC fallback endpoints, and contract deployment addresses for LUCENTRA.

---

## 2. Supported Networks Matrix

| Parameter | Local Testnet (Anvil) | Sepolia Testnet | Arbitrum One (L2 Production) | Ethereum Mainnet (L1) |
| :--- | :--- | :--- | :--- | :--- |
| **Chain ID** | `31337` | `11155111` | `42161` | `1` |
| **Native Currency** | ETH | SepoliaETH | ETH | ETH |
| **Block Time** | Instant / 1s | $\approx 12\text{ s}$ | $\approx 0.25\text{ s}$ | $\approx 12\text{ s}$ |
| **Primary RPC** | `http://127.0.0.1:8545` | `https://rpc.sepolia.org` | `https://arb1.arbitrum.io/rpc` | `https://eth.llamarpc.com` |
| **Fallback RPC** | N/A | Alchemy / Infura | Cloudflare Arbitrum RPC | Flashbots Protect RPC |
| **EAS Contract** | Local Mock | `0xC2679fBD37d54388Ce493F1DB75320D236e1815e` | `0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458` | `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587` |
| **PublisherRegistry** | Deploy on init | TBD (Sepolia Deploy) | TBD (Production Deploy) | TBD (Settlement Deploy) |

---

## 3. Client RPC Fallback & Resilience Strategy

The Chrome Extension maintains an ordered array of public RPC endpoints. If an RPC request times out ($> 2000\text{ ms}$) or returns an HTTP 429 Rate Limit error, the client automatically fails over to the next endpoint.

---

## 4. Related Documents

- [docs/06-blockchain/DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [docs/06-blockchain/EAS_INTEGRATION.md](EAS_INTEGRATION.md)

---

## 5. References

- [Chainlist Network Directory](https://chainlist.org/)
- [EAS Official Contract Addresses](https://docs.attest.org/docs/quick--start/contracts)

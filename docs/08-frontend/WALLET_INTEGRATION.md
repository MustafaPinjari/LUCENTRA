# Web3 Wallet Integration (Wagmi & Viem) — LUCENTRA

**Document ID:** LUC-FE-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the Web3 wallet connection layer for the Next.js Publisher Dashboard, supporting MetaMask, Coinbase Wallet, Rainbow, and WalletConnect v2 via Wagmi.

---

## 2. Wagmi Configuration Setup (`lib/wagmi.ts`)

```typescript
import { http, createConfig } from "wagmi";
import { sepolia, arbitrum } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const config = createConfig({
  chains: [sepolia, arbitrum],
  connectors: [
    injected(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID! }),
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL),
  },
});
```

---

## 3. Account State & Chain Switching

The dashboard requires connected wallets to operate on the approved active network (`sepolia` for testnet, `arbitrum` for production). If an incorrect network is detected, a global banner prompts the user to switch networks via `useSwitchChain()`.

---

## 4. Related Documents

- [docs/08-frontend/FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)
- [docs/05-cryptography/EIP712_SIGNING.md](../05-cryptography/EIP712_SIGNING.md)

---

## 5. References

- [Wagmi Getting Started](https://wagmi.sh/react/getting-started)
- [WalletConnect v2](https://walletconnect.com/)

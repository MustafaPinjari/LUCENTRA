# Smart Contract Deployment Guide (Foundry) — LUCENTRA

**Document ID:** LUC-BC-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides step-by-step instructions for deploying and verifying LUCENTRA smart contracts across local development (Anvil) and public testnets (Sepolia) using Foundry.

---

## 2. Prerequisites & Environment Setup

Ensure Foundry is installed and updated:
```bash
forge --version
cast --version
anvil --version
```

Required environment variables in `.env`:
```env
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
ETHERSCAN_API_KEY="YOUR_ETHERSCAN_API_KEY"
DEPLOYER_PRIVATE_KEY="0x..."
DNS_VERIFIER_SIGNER_ADDRESS="0x..."
```

---

## 3. Deployment Script (`contracts/script/DeployPublisherRegistry.s.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/PublisherRegistry.sol";

contract DeployPublisherRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address verifierSigner = vm.envAddress("DNS_VERIFIER_SIGNER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        PublisherRegistry registry = new PublisherRegistry(verifierSigner);

        vm.stopBroadcast();

        console.log("PublisherRegistry deployed at:", address(registry));
    }
}
```

---

## 4. Execution Commands

### 4.1 Local Anvil Deployment
```bash
# Terminal 1: Run local node
anvil

# Terminal 2: Deploy script
forge script script/DeployPublisherRegistry.s.sol:DeployPublisherRegistry \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### 4.2 Sepolia Testnet Deployment with Etherscan Verification
```bash
forge script script/DeployPublisherRegistry.s.sol:DeployPublisherRegistry \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

---

## 5. Related Documents

- [docs/06-blockchain/PUBLISHER_REGISTRY.md](PUBLISHER_REGISTRY.md)
- [docs/13-devops/BUILD_AND_DEPLOYMENT.md](../13-devops/BUILD_AND_DEPLOYMENT.md)

---

## 6. References

- [Foundry Scripting Guide](https://book.getfoundry.sh/tutorials/solidity-scripting)

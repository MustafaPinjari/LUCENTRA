# Smart Contract Testing (Foundry) — LUCENTRA

**Document ID:** LUC-TST-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the Foundry test suite for `PublisherRegistry.sol`, including unit tests, fuzz tests, and invariant tests.

---

## 2. Foundry Test Suite (`contracts/test/PublisherRegistry.t.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/PublisherRegistry.sol";

contract PublisherRegistryTest is Test {
    PublisherRegistry registry;
    uint256 verifierPrivateKey = 0xA11CE;
    address verifierSigner;
    address owner = address(0xB0B);

    function setUp() public {
        verifierSigner = vm.addr(verifierPrivateKey);
        registry = new PublisherRegistry(verifierSigner);
    }

    function test_RegisterDomain_Success() public {
        string memory domain = "example.com";
        uint256 deadline = block.timestamp + 1 hours;
        
        // Generate EIP-712 verifier signature
        bytes32 structHash = keccak256(
            abi.encode(registry.DOMAIN_AUTH_TYPEHASH(), keccak256(bytes(domain)), owner, 0, deadline)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", registry.eip712DomainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPrivateKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(owner);
        registry.registerDomain(domain, owner, deadline, sig);

        assertEq(registry.getDomainOwner(domain), owner);
        assertTrue(registry.isKeyAuthorized(domain, owner));
    }

    function test_RevokeKey_Permanent() public {
        // Setup registered domain
        test_RegisterDomain_Success();

        address rogueKey = address(0xBAD);
        vm.prank(owner);
        registry.authorizeKey("example.com", rogueKey);
        assertTrue(registry.isKeyAuthorized("example.com", rogueKey));

        // Revoke
        vm.prank(owner);
        registry.revokeKey("example.com", rogueKey);
        assertFalse(registry.isKeyAuthorized("example.com", rogueKey));

        // Attempt re-activation must revert
        vm.expectRevert(PublisherRegistry.KeyAlreadyRevoked.selector);
        vm.prank(owner);
        registry.authorizeKey("example.com", rogueKey);
    }
}
```

---

## 3. Related Documents

- [docs/06-blockchain/PUBLISHER_REGISTRY.md](../06-blockchain/PUBLISHER_REGISTRY.md)
- [docs/11-security/SMART_CONTRACT_SECURITY.md](../11-security/SMART_CONTRACT_SECURITY.md)

---

## 4. References

- [Foundry Testing Guide](https://book.getfoundry.sh/forge/tests)

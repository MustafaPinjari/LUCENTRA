// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PublisherRegistry} from "../../src/PublisherRegistry.sol";
import {IPublisherRegistry} from "../../src/interfaces/IPublisherRegistry.sol";

contract PublisherRegistryInvariantsTest is Test {
    PublisherRegistry public registry;

    address public governance = makeAddr("governance");
    address public registrar = makeAddr("registrar");

    uint256 public publisherPrivKey = 0xAA;
    address public publisher;

    uint256 public initialKeyPriv = 0xBB;
    address public initialKey;

    string public constant TEST_DOMAIN = "app.uniswap.org";

    function setUp() public {
        publisher = vm.addr(publisherPrivKey);
        initialKey = vm.addr(initialKeyPriv);

        vm.prank(governance);
        registry = new PublisherRegistry(registrar);

        // Register initial domain
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTRATION_AUTHORIZATION_TYPEHASH(),
                keccak256(bytes(TEST_DOMAIN)),
                publisher,
                initialKey,
                0,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(publisherPrivKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(registrar);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, initialKey, deadline, sig);
    }

    /// @notice Invariant 1: Once a key is revoked, it can NEVER become active again.
    function testFuzz_Invariant_RevokedKeyNeverReauthorized(address keyToRevoke) public {
        vm.assume(keyToRevoke != address(0));

        // Authorize and then revoke the key
        vm.startPrank(publisher);
        if (!registry.isKeyAuthorized(TEST_DOMAIN, keyToRevoke)) {
            registry.authorizeKey(TEST_DOMAIN, keyToRevoke);
        }
        registry.revokeKey(TEST_DOMAIN, keyToRevoke);

        // Invariant check: Any attempt to re-authorize must revert
        vm.expectRevert(IPublisherRegistry.KeyAlreadyRevoked.selector);
        registry.authorizeKey(TEST_DOMAIN, keyToRevoke);

        // Any attempt to rotate to it must also revert
        address tempKey = makeAddr("tempKey");
        registry.authorizeKey(TEST_DOMAIN, tempKey);
        vm.expectRevert(IPublisherRegistry.KeyAlreadyRevoked.selector);
        registry.rotateKey(TEST_DOMAIN, tempKey, keyToRevoke);

        // Key must remain unauthorized
        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, keyToRevoke));
        vm.stopPrank();
    }

    /// @notice Invariant 2: When suspended, no key can ever evaluate to true.
    function testFuzz_Invariant_SuspendedDomainBlocksAllKeys(address randomQueryKey) public {
        vm.prank(publisher);
        registry.suspendPublisher(TEST_DOMAIN);

        assertTrue(registry.isPublisherSuspended(TEST_DOMAIN));
        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, initialKey));
        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, randomQueryKey));
        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, publisher));
    }

    /// @notice Invariant 3: Domain ownership cannot be overwritten or changed.
    function testFuzz_Invariant_DomainOwnerImmutable(address randomClaimant, uint256 randomKey) public {
        vm.assume(randomClaimant != address(0));
        vm.assume(randomKey > 0 && randomKey < type(uint128).max);

        uint64 deadline = uint64(block.timestamp + 1000);
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTRATION_AUTHORIZATION_TYPEHASH(),
                keccak256(bytes(TEST_DOMAIN)),
                randomClaimant,
                vm.addr(randomKey),
                0,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(randomKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Registrar attempts to overwrite existing domain
        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.DomainAlreadyRegistered.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, randomClaimant, vm.addr(randomKey), deadline, sig);

        // Owner remains original publisher
        assertEq(registry.getDomainOwner(TEST_DOMAIN), publisher);
    }
}

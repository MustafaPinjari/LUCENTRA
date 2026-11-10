// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PublisherRegistry} from "../src/PublisherRegistry.sol";
import {IPublisherRegistry} from "../src/interfaces/IPublisherRegistry.sol";

contract PublisherRegistryTest is Test {
    PublisherRegistry public registry;

    address public governance = makeAddr("governance");
    address public registrar = makeAddr("registrar");

    uint256 public publisherKey = 0xA11CE;
    address public publisher;

    uint256 public signingKey1Key = 0xB0B;
    address public signingKey1;

    uint256 public signingKey2Key = 0xCAFE;
    address public signingKey2;

    address public attacker = makeAddr("attacker");

    string public constant TEST_DOMAIN = "app.uniswap.org";
    bytes32 public testDomainHash;

    event DomainRegisteredByRegistrar(
        bytes32 indexed domainHash,
        string domain,
        address indexed owner,
        address indexed initialSigningKey,
        uint64 timestamp
    );
    event KeyAuthorized(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event KeyRevoked(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event KeyRotated(
        bytes32 indexed domainHash, address indexed oldSigningKey, address indexed newSigningKey, uint64 timestamp
    );
    event PublisherSuspended(bytes32 indexed domainHash, uint64 timestamp);
    event PublisherReactivated(bytes32 indexed domainHash, uint64 timestamp);
    event RegistrarUpdated(address indexed oldRegistrar, address indexed newRegistrar, uint64 timestamp);

    function setUp() public {
        publisher = vm.addr(publisherKey);
        signingKey1 = vm.addr(signingKey1Key);
        signingKey2 = vm.addr(signingKey2Key);
        testDomainHash = keccak256(bytes(TEST_DOMAIN));

        vm.prank(governance);
        registry = new PublisherRegistry(registrar);
    }

    function _signRegistration(
        uint256 privKey,
        string memory domain,
        address pub,
        address initialKey,
        uint256 nonce,
        uint64 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTRATION_AUTHORIZATION_TYPEHASH(),
                keccak256(bytes(domain)),
                pub,
                initialKey,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // =========================================================================
    // 1. DUAL-AUTHORIZATION REGISTRATION TESTS
    // =========================================================================

    function test_RegisterDomain_Success() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRegistration(publisherKey, TEST_DOMAIN, publisher, signingKey1, 0, deadline);

        vm.prank(registrar);
        vm.expectEmit(true, true, true, true);
        emit DomainRegisteredByRegistrar(testDomainHash, TEST_DOMAIN, publisher, signingKey1, uint64(block.timestamp));
        vm.expectEmit(true, true, true, true);
        emit KeyAuthorized(testDomainHash, signingKey1, uint64(block.timestamp));

        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, sig);

        assertEq(registry.getDomainOwner(TEST_DOMAIN), publisher);
        assertEq(registry.getDomainOwnerByHash(testDomainHash), publisher);
        assertTrue(registry.isKeyAuthorized(TEST_DOMAIN, signingKey1));
        assertTrue(registry.isKeyAuthorizedByHash(testDomainHash, signingKey1));
        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, signingKey2));
        assertEq(registry.nonces(publisher), 1);

        IPublisherRegistry.DomainInfo memory info = registry.getDomainInfo(TEST_DOMAIN);
        assertEq(info.owner, publisher);
        assertEq(info.registeredAt, uint64(block.timestamp));
        assertFalse(info.isSuspended);
        assertEq(info.domain, TEST_DOMAIN);
    }

    function test_RevertIf_NotRegistrar() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRegistration(publisherKey, TEST_DOMAIN, publisher, signingKey1, 0, deadline);

        vm.prank(attacker);
        vm.expectRevert(IPublisherRegistry.NotRegistrar.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, sig);
    }

    function test_RevertIf_InvalidPublisherSignature() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        // Attacker signs instead of genuine publisher
        bytes memory badSig = _signRegistration(0xBAD, TEST_DOMAIN, publisher, signingKey1, 0, deadline);

        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.InvalidSignature.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, badSig);
    }

    function test_RevertIf_RegistrationSignatureExpired() public {
        uint64 deadline = uint64(block.timestamp - 1);
        bytes memory sig = _signRegistration(publisherKey, TEST_DOMAIN, publisher, signingKey1, 0, deadline);

        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.SignatureExpired.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, sig);
    }

    function test_RevertIf_RegistrationReplay() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRegistration(publisherKey, TEST_DOMAIN, publisher, signingKey1, 0, deadline);

        vm.prank(registrar);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, sig);

        // Attempting to reuse the exact same signature
        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.DomainAlreadyRegistered.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, sig);
    }

    function test_RevertIf_DuplicateDomain() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig1 = _signRegistration(publisherKey, TEST_DOMAIN, publisher, signingKey1, 0, deadline);

        vm.prank(registrar);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, sig1);

        // Another publisher tries to claim the same domain
        uint256 otherPublisherKey = 0x999;
        address otherPublisher = vm.addr(otherPublisherKey);
        bytes memory sig2 = _signRegistration(otherPublisherKey, TEST_DOMAIN, otherPublisher, signingKey2, 0, deadline);

        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.DomainAlreadyRegistered.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, otherPublisher, signingKey2, deadline, sig2);
    }

    function test_RevertIf_EmptyDomain() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRegistration(publisherKey, "", publisher, signingKey1, 0, deadline);

        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.EmptyDomainString.selector);
        registry.registerPublisherDomainWithAuth("", publisher, signingKey1, deadline, sig);
    }

    function test_RevertIf_ZeroAddressInput() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRegistration(publisherKey, TEST_DOMAIN, publisher, signingKey1, 0, deadline);

        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.ZeroAddress.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, address(0), signingKey1, deadline, sig);

        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.ZeroAddress.selector);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, address(0), deadline, sig);
    }

    // =========================================================================
    // 2. SIGNING-KEY LIFECYCLE MANAGEMENT TESTS
    // =========================================================================

    function _registerTestDomain() internal {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRegistration(publisherKey, TEST_DOMAIN, publisher, signingKey1, 0, deadline);
        vm.prank(registrar);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey1, deadline, sig);
    }

    function test_AuthorizeKey_Success() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectEmit(true, true, true, true);
        emit KeyAuthorized(testDomainHash, signingKey2, uint64(block.timestamp));
        registry.authorizeKey(TEST_DOMAIN, signingKey2);

        assertTrue(registry.isKeyAuthorized(TEST_DOMAIN, signingKey2));
    }

    function test_RevertIf_AuthorizeKey_NotOwner() public {
        _registerTestDomain();

        vm.prank(attacker);
        vm.expectRevert(IPublisherRegistry.NotDomainOwner.selector);
        registry.authorizeKey(TEST_DOMAIN, signingKey2);

        // Registrar cannot authorize keys either!
        vm.prank(registrar);
        vm.expectRevert(IPublisherRegistry.NotDomainOwner.selector);
        registry.authorizeKey(TEST_DOMAIN, signingKey2);
    }

    function test_RevertIf_AuthorizeKey_AlreadyActive() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectRevert(IPublisherRegistry.KeyAlreadyActive.selector);
        registry.authorizeKey(TEST_DOMAIN, signingKey1);
    }

    function test_RevertIf_AuthorizeKey_ZeroAddress() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectRevert(IPublisherRegistry.ZeroAddress.selector);
        registry.authorizeKey(TEST_DOMAIN, address(0));
    }

    function test_RotateKey_Success() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectEmit(true, true, true, true);
        emit KeyRevoked(testDomainHash, signingKey1, uint64(block.timestamp));
        vm.expectEmit(true, true, true, true);
        emit KeyAuthorized(testDomainHash, signingKey2, uint64(block.timestamp));
        vm.expectEmit(true, true, true, true);
        emit KeyRotated(testDomainHash, signingKey1, signingKey2, uint64(block.timestamp));

        registry.rotateKey(TEST_DOMAIN, signingKey1, signingKey2);

        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, signingKey1));
        assertTrue(registry.isKeyAuthorized(TEST_DOMAIN, signingKey2));
    }

    function test_RevertIf_RotateKey_OldKeyNotActive() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectRevert(IPublisherRegistry.KeyNotActive.selector);
        registry.rotateKey(TEST_DOMAIN, signingKey2, makeAddr("key3"));
    }

    function test_RevokeKey_Success() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectEmit(true, true, true, true);
        emit KeyRevoked(testDomainHash, signingKey1, uint64(block.timestamp));
        registry.revokeKey(TEST_DOMAIN, signingKey1);

        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, signingKey1));
    }

    function test_RevertIf_RevokeKey_NotActive() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectRevert(IPublisherRegistry.KeyNotActive.selector);
        registry.revokeKey(TEST_DOMAIN, signingKey2);
    }

    function test_RevertIf_ReauthorizeRevokedKey() public {
        _registerTestDomain();

        vm.prank(publisher);
        registry.revokeKey(TEST_DOMAIN, signingKey1);

        // Attempting to re-authorize a permanently revoked key must fail!
        vm.prank(publisher);
        vm.expectRevert(IPublisherRegistry.KeyAlreadyRevoked.selector);
        registry.authorizeKey(TEST_DOMAIN, signingKey1);
    }

    // =========================================================================
    // 3. PUBLISHER LIFECYCLE & SUSPENSION TESTS
    // =========================================================================

    function test_SuspendPublisher_ByOwner() public {
        _registerTestDomain();

        vm.prank(publisher);
        vm.expectEmit(true, false, false, true);
        emit PublisherSuspended(testDomainHash, uint64(block.timestamp));
        registry.suspendPublisher(TEST_DOMAIN);

        assertTrue(registry.isPublisherSuspended(TEST_DOMAIN));
        // All keys are immediately unauthorized when suspended!
        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, signingKey1));
    }

    function test_SuspendPublisher_ByRegistrar() public {
        _registerTestDomain();

        // Registrar can suspend if DNS ownership is lost off-chain
        vm.prank(registrar);
        registry.suspendPublisher(TEST_DOMAIN);

        assertTrue(registry.isPublisherSuspended(TEST_DOMAIN));
        assertFalse(registry.isKeyAuthorized(TEST_DOMAIN, signingKey1));
    }

    function test_SuspendPublisher_ByGovernance() public {
        _registerTestDomain();

        vm.prank(governance);
        registry.suspendPublisher(TEST_DOMAIN);

        assertTrue(registry.isPublisherSuspended(TEST_DOMAIN));
    }

    function test_RevertIf_SuspendPublisher_Unauthorized() public {
        _registerTestDomain();

        vm.prank(attacker);
        vm.expectRevert(IPublisherRegistry.NotDomainOwner.selector);
        registry.suspendPublisher(TEST_DOMAIN);
    }

    function test_ReactivatePublisher_Success() public {
        _registerTestDomain();

        vm.prank(publisher);
        registry.suspendPublisher(TEST_DOMAIN);

        vm.prank(publisher);
        vm.expectEmit(true, false, false, true);
        emit PublisherReactivated(testDomainHash, uint64(block.timestamp));
        registry.reactivatePublisher(TEST_DOMAIN);

        assertFalse(registry.isPublisherSuspended(TEST_DOMAIN));
        assertTrue(registry.isKeyAuthorized(TEST_DOMAIN, signingKey1));
    }

    function test_RevertIf_ActionOnSuspendedDomain() public {
        _registerTestDomain();

        vm.prank(publisher);
        registry.suspendPublisher(TEST_DOMAIN);

        vm.prank(publisher);
        vm.expectRevert(IPublisherRegistry.PublisherIsSuspended.selector);
        registry.authorizeKey(TEST_DOMAIN, signingKey2);

        vm.prank(publisher);
        vm.expectRevert(IPublisherRegistry.PublisherIsSuspended.selector);
        registry.rotateKey(TEST_DOMAIN, signingKey1, signingKey2);
    }

    // =========================================================================
    // 4. REGISTRAR GOVERNANCE ROTATION TESTS
    // =========================================================================

    function test_SetRegistrar_Success() public {
        address newRegistrar = makeAddr("newRegistrar");

        vm.prank(governance);
        vm.expectEmit(true, true, false, true);
        emit RegistrarUpdated(registrar, newRegistrar, uint64(block.timestamp));
        registry.setRegistrar(newRegistrar);

        assertEq(registry.registrar(), newRegistrar);
    }

    function test_RevertIf_SetRegistrar_NotGovernance() public {
        address newRegistrar = makeAddr("newRegistrar");

        vm.prank(attacker);
        vm.expectRevert();
        registry.setRegistrar(newRegistrar);
    }

    function test_RevertIf_SetRegistrar_ZeroAddress() public {
        vm.prank(governance);
        vm.expectRevert(IPublisherRegistry.ZeroAddress.selector);
        registry.setRegistrar(address(0));
    }

    // =========================================================================
    // 5. FUZZ TESTING
    // =========================================================================

    function testFuzz_RegisterDomain(string calldata domain, uint256 randomPublisherKey, uint256 randomSigningKey)
        public
    {
        vm.assume(bytes(domain).length > 0 && bytes(domain).length < 100);
        vm.assume(randomPublisherKey > 0 && randomPublisherKey < type(uint128).max);
        vm.assume(randomSigningKey > 0 && randomSigningKey < type(uint128).max);

        address fuzzPublisher = vm.addr(randomPublisherKey);
        address fuzzKey = vm.addr(randomSigningKey);
        uint64 deadline = uint64(block.timestamp + 1000);

        bytes memory sig = _signRegistration(randomPublisherKey, domain, fuzzPublisher, fuzzKey, 0, deadline);

        vm.prank(registrar);
        registry.registerPublisherDomainWithAuth(domain, fuzzPublisher, fuzzKey, deadline, sig);

        assertEq(registry.getDomainOwner(domain), fuzzPublisher);
        assertTrue(registry.isKeyAuthorized(domain, fuzzKey));
    }
}

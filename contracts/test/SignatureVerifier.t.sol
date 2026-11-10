// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignatureVerifier} from "src/SignatureVerifier.sol";
import {PublisherRegistry} from "src/PublisherRegistry.sol";
import {ISignatureVerifier} from "src/interfaces/ISignatureVerifier.sol";

contract SignatureVerifierTest is Test {
    SignatureVerifier public verifier;
    PublisherRegistry public registry;

    address public governance = makeAddr("governance");
    address public registrar = makeAddr("registrar");

    uint256 public publisherPrivKey = 0xA11CE;
    address public publisher;

    uint256 public authorizedKeyPriv = 0xB0B;
    address public authorizedKey;

    uint256 public unauthorizedKeyPriv = 0xBAD;
    address public unauthorizedKey;

    string public constant TEST_DOMAIN = "example.com";
    string public constant TEST_VERSION = "0.1.0";
    bytes32 public constant TEST_MANIFEST_HASH = 0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4;
    uint64 public constant TEST_TIMESTAMP = 1700000000;
    uint64 public constant TEST_EXPIRES_AT = 1799999999;

    function setUp() public {
        publisher = vm.addr(publisherPrivKey);
        authorizedKey = vm.addr(authorizedKeyPriv);
        unauthorizedKey = vm.addr(unauthorizedKeyPriv);

        vm.startPrank(governance);
        registry = new PublisherRegistry(registrar);
        verifier = new SignatureVerifier();
        vm.stopPrank();

        // Register publisher domain with authorizedKey
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTRATION_AUTHORIZATION_TYPEHASH(),
                keccak256(bytes(TEST_DOMAIN)),
                publisher,
                authorizedKey,
                0,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(publisherPrivKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(registrar);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, authorizedKey, deadline, sig);
    }

    function _signManifest(uint256 privKey, ISignatureVerifier.ReleaseManifest memory manifest, bytes32 domainSeparator)
        internal
        pure
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ReleaseManifest(string domain,string version,bytes32 manifestHash,uint64 timestamp,uint64 expiresAt)"
                ),
                keccak256(bytes(manifest.domain)),
                keccak256(bytes(manifest.version)),
                manifest.manifestHash,
                manifest.timestamp,
                manifest.expiresAt
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // =========================================================================
    // 1. SPRINT 1 TEST VECTOR 3 CROSS-LANGUAGE VERIFICATION
    // =========================================================================

    function test_CrossLanguage_TestVector3_Verification() public pure {
        // Exact vector from packages/core/test/signature.test.ts
        // Private Key: 0x4c0883a69102937d6231471b5dbb6204db7e716b78ac5c7827453b4112f46973
        // Expected Signer: 0x93309a65fb019f6b9ea203b5f90d47ad9f88c3c6 (lower)
        // Expected Sig: 0xdebe38b2c5399315ce7083f0e46f43ce6e45dd1351325b11ef1f88e734178a974e0f49fa9a7373d854b93c12f348546278579fa41638720f1553ea0b7a7a495f1c
        // Domain: name="LUCENTRA", version="1", chainId=11155111, verifyingContract=0x1111111111111111111111111111111111111111

        uint256 tv3PrivKey = 0x4c0883a69102937d6231471b5dbb6204db7e716b78ac5c7827453b4112f46973;
        address expectedSigner = vm.addr(tv3PrivKey);

        bytes32 tv3DomainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("LUCENTRA")),
                keccak256(bytes("1")),
                11155111,
                0x1111111111111111111111111111111111111111
            )
        );

        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: "example.com",
            version: "0.1.0",
            manifestHash: 0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4,
            timestamp: 1700000000,
            expiresAt: 1799999999
        });

        bytes memory sig = _signManifest(tv3PrivKey, manifest, tv3DomainSeparator);
        bytes memory expectedSig =
            hex"debe38b2c5399315ce7083f0e46f43ce6e45dd1351325b11ef1f88e734178a974e0f49fa9a7373d854b93c12f348546278579fa41638720f1553ea0b7a7a495f1c";

        assertEq(sig, expectedSig);

        // Verify recovery with custom domain separator
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ReleaseManifest(string domain,string version,bytes32 manifestHash,uint64 timestamp,uint64 expiresAt)"
                ),
                keccak256(bytes(manifest.domain)),
                keccak256(bytes(manifest.version)),
                manifest.manifestHash,
                manifest.timestamp,
                manifest.expiresAt
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", tv3DomainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(tv3PrivKey, digest);
        address recovered = ecrecover(digest, v, r, s);
        assertEq(recovered, expectedSigner);
    }

    // =========================================================================
    // 2. SIGNATURE RECOVERY & INTEGRITY TESTS
    // =========================================================================

    function test_VerifyRelease_Success() public view {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, verifier.DOMAIN_SEPARATOR());

        (bool valid, address recoveredSigner) =
            verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
        assertTrue(valid);
        assertEq(recoveredSigner, authorizedKey);
    }

    function test_RevertIf_ManifestTampered_Domain() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, verifier.DOMAIN_SEPARATOR());

        // Alter domain in evaluated manifest
        manifest.domain = "malicious.org";

        // Unregistered domain must revert UnregisteredPublisher
        vm.expectRevert(ISignatureVerifier.UnregisteredPublisher.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
    }

    function test_RevertIf_ManifestTampered_ManifestHash() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, verifier.DOMAIN_SEPARATOR());

        // Alter 1 byte in manifestHash
        manifest.manifestHash = bytes32(uint256(TEST_MANIFEST_HASH) ^ 1);

        vm.expectRevert(ISignatureVerifier.UnauthorizedSigner.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
    }

    function test_RevertIf_SignatureExpired() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, verifier.DOMAIN_SEPARATOR());

        // Boundary: exactly at expiration passes
        (bool validExact,) = verifier.verifyRelease(manifest, sig, address(registry), TEST_EXPIRES_AT);
        assertTrue(validExact);

        // Boundary: 1 second past expiration reverts
        vm.expectRevert(ISignatureVerifier.SignatureExpired.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_EXPIRES_AT + 1);
    }

    function test_RevertIf_WrongChainId() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        // Signed for chain ID 1 (Mainnet) instead of current test chainId (31337)
        bytes32 wrongChainDomainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("LUCENTRA")),
                keccak256(bytes("1")),
                1,
                address(verifier)
            )
        );

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, wrongChainDomainSeparator);

        vm.expectRevert(ISignatureVerifier.UnauthorizedSigner.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
    }

    function test_RevertIf_WrongVerifyingContract() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        // Signed for another contract address
        bytes32 wrongContractDomainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("LUCENTRA")),
                keccak256(bytes("1")),
                block.chainid,
                makeAddr("differentContract")
            )
        );

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, wrongContractDomainSeparator);

        vm.expectRevert(ISignatureVerifier.UnauthorizedSigner.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
    }

    function test_RevertIf_UnauthorizedSigningKey() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        // Signed by an unauthorized key
        bytes memory sig = _signManifest(unauthorizedKeyPriv, manifest, verifier.DOMAIN_SEPARATOR());

        vm.expectRevert(ISignatureVerifier.UnauthorizedSigner.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
    }

    function test_RevertIf_RevokedSigningKey() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, verifier.DOMAIN_SEPARATOR());

        // Revoke the key in the registry
        vm.prank(publisher);
        registry.revokeKey(TEST_DOMAIN, authorizedKey);

        vm.expectRevert(ISignatureVerifier.UnauthorizedSigner.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
    }

    function test_RevertIf_SuspendedPublisher() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        bytes memory sig = _signManifest(authorizedKeyPriv, manifest, verifier.DOMAIN_SEPARATOR());

        // Suspend the publisher domain
        vm.prank(publisher);
        registry.suspendPublisher(TEST_DOMAIN);

        vm.expectRevert(ISignatureVerifier.PublisherSuspended.selector);
        verifier.verifyRelease(manifest, sig, address(registry), TEST_TIMESTAMP + 100);
    }

    function test_RevertIf_MalformedSignature() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: TEST_TIMESTAMP,
            expiresAt: TEST_EXPIRES_AT
        });

        // 64-byte truncated signature
        bytes memory shortSig = new bytes(64);
        vm.expectRevert(ISignatureVerifier.InvalidSignature.selector);
        verifier.verifyRelease(manifest, shortSig, address(registry), TEST_TIMESTAMP + 100);

        // Corrupted v value
        bytes memory badVSig = new bytes(65);
        badVSig[64] = bytes1(uint8(4)); // v must be 27 or 28
        vm.expectRevert(ISignatureVerifier.InvalidSignature.selector);
        verifier.verifyRelease(manifest, badVSig, address(registry), TEST_TIMESTAMP + 100);
    }

    // =========================================================================
    // 3. FUZZ TESTING
    // =========================================================================

    function testFuzz_SignAndVerify(uint256 randomKey, bytes32 manifestHash, uint64 timestamp, uint64 duration) public {
        vm.assume(randomKey > 0 && randomKey < type(uint128).max);
        vm.assume(randomKey != authorizedKeyPriv && randomKey != publisherPrivKey);
        vm.assume(duration > 0 && duration < 365 days);
        vm.assume(timestamp < type(uint64).max - duration);

        address fuzzSigner = vm.addr(randomKey);

        // Authorize fuzzSigner in registry
        vm.prank(publisher);
        registry.authorizeKey(TEST_DOMAIN, fuzzSigner);

        uint64 expiresAt = timestamp + duration;
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "fuzz-v1",
            manifestHash: manifestHash,
            timestamp: timestamp,
            expiresAt: expiresAt
        });

        bytes memory sig = _signManifest(randomKey, manifest, verifier.DOMAIN_SEPARATOR());

        (bool valid, address recovered) = verifier.verifyRelease(manifest, sig, address(registry), timestamp);
        assertTrue(valid);
        assertEq(recovered, fuzzSigner);
    }
}

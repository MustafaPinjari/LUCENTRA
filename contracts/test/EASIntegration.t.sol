// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {
    IEAS,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {MockEAS} from "./mocks/MockEAS.sol";
import {PublisherRegistry} from "../src/PublisherRegistry.sol";
import {SignatureVerifier} from "../src/SignatureVerifier.sol";
import {ReleaseAttestationVerifier} from "../src/ReleaseAttestationVerifier.sol";
import {IReleaseAttestationVerifier} from "../src/interfaces/IReleaseAttestationVerifier.sol";
import {ISignatureVerifier} from "../src/interfaces/ISignatureVerifier.sol";

contract EASIntegrationTest is Test {
    MockEAS public eas;

    PublisherRegistry public registry;
    SignatureVerifier public signatureVerifier;
    ReleaseAttestationVerifier public releaseVerifier;

    bytes32 public releaseSchemaId;

    address public governance = makeAddr("governance");
    address public registrar = makeAddr("registrar");
    address public relayer = makeAddr("relayer");
    address public attacker = makeAddr("attacker");

    uint256 public publisherPrivKey = 0xA11CE;
    address public publisher;

    uint256 public signingKeyPriv = 0xB0B;
    address public signingKey;

    string public constant TEST_DOMAIN = "app.uniswap.org";
    string public constant TEST_VERSION = "1.0.0";
    bytes32 public constant TEST_MANIFEST_HASH = 0x15f0e33b6dd78d0187b5f716002f249207670eddfa0a83b3dc910533ef5bddcf;
    uint64 public constant TEST_TIMESTAMP = 1700000000;
    uint64 public constant TEST_EXPIRES_AT = 1750000000;

    function setUp() public {
        publisher = vm.addr(publisherPrivKey);
        signingKey = vm.addr(signingKeyPriv);

        vm.startPrank(governance);
        eas = new MockEAS();

        // Register Release Schema ID
        string memory schemaString =
            "bytes32 manifestHash,string domain,string version,uint64 sequence,bytes32 previousManifestHash,address signingKey,bytes signature";
        releaseSchemaId = keccak256(bytes(schemaString));

        registry = new PublisherRegistry(registrar);
        signatureVerifier = new SignatureVerifier();

        releaseVerifier = new ReleaseAttestationVerifier(
            address(eas), address(registry), address(signatureVerifier), releaseSchemaId
        );
        vm.stopPrank();

        // Register publisher domain with signingKey
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTRATION_AUTHORIZATION_TYPEHASH(),
                keccak256(bytes(TEST_DOMAIN)),
                publisher,
                signingKey,
                0,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(publisherPrivKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(registrar);
        registry.registerPublisherDomainWithAuth(TEST_DOMAIN, publisher, signingKey, deadline, sig);
    }

    function _signManifest(uint256 privKey, ISignatureVerifier.ReleaseManifest memory manifest)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                signatureVerifier.RELEASE_MANIFEST_TYPEHASH(),
                keccak256(bytes(manifest.domain)),
                keccak256(bytes(manifest.version)),
                manifest.manifestHash,
                manifest.timestamp,
                manifest.expiresAt
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", signatureVerifier.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _createAttestation(
        address attesterAccount,
        uint64 time,
        uint64 expirationTime,
        bytes32 previousHash,
        uint64 sequence
    ) internal returns (bytes32) {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: time,
            expiresAt: expirationTime
        });

        bytes memory signature = _signManifest(signingKeyPriv, manifest);

        bytes memory payload =
            abi.encode(TEST_MANIFEST_HASH, TEST_DOMAIN, TEST_VERSION, sequence, previousHash, signingKey, signature);

        vm.warp(time);

        vm.prank(attesterAccount);
        bytes32 uid = eas.attest(
            AttestationRequest({
                schema: releaseSchemaId,
                data: AttestationRequestData({
                    recipient: publisher,
                    expirationTime: expirationTime,
                    revocable: true,
                    refUID: bytes32(0),
                    data: payload,
                    value: 0
                })
            })
        );

        return uid;
    }

    // =========================================================================
    // 1. EAS ATTESTATION LIFECYCLE TESTS (TV-EAS-001 TO TV-EAS-008)
    // =========================================================================

    function test_TV_EAS_001_ValidBoundedRelease() public {
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, TEST_EXPIRES_AT, bytes32(0), 1);

        // Evaluation time: 1,715,000,000 (valid bounded release)
        IReleaseAttestationVerifier.VerificationResult memory res = releaseVerifier.verifyAttestation(uid, 1715000000);

        assertTrue(res.isValid);
        assertEq(res.manifestHash, TEST_MANIFEST_HASH);
        assertEq(res.domain, TEST_DOMAIN);
        assertEq(res.version, TEST_VERSION);
        assertEq(res.sequence, 1);
        assertEq(res.signingKey, signingKey);
        assertEq(res.publisher, publisher);
    }

    function test_TV_EAS_002_ExpiredRelease() public {
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, 1710000000, bytes32(0), 1);

        // Evaluation time: 1,715,000,000 (past expiration)
        vm.expectRevert(IReleaseAttestationVerifier.AttestationExpired.selector);
        releaseVerifier.verifyAttestation(uid, 1715000000);
    }

    function test_TV_EAS_003_RevokedRelease() public {
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, TEST_EXPIRES_AT, bytes32(0), 1);

        // Revoke attestation in EAS by attester
        vm.prank(relayer);
        eas.revoke(RevocationRequest({schema: releaseSchemaId, data: RevocationRequestData({uid: uid, value: 0})}));

        vm.expectRevert(IReleaseAttestationVerifier.AttestationRevoked.selector);
        releaseVerifier.verifyAttestation(uid, 1715000000);
    }

    function test_TV_EAS_004_ValidIndefiniteRelease() public {
        // Expiration = 0 (indefinite release)
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, 0, bytes32(0), 1);

        IReleaseAttestationVerifier.VerificationResult memory res = releaseVerifier.verifyAttestation(uid, 1800000000);
        assertTrue(res.isValid);
    }

    function test_TV_EAS_005_RevokedPublisherSigningKey() public {
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, TEST_EXPIRES_AT, bytes32(0), 1);

        // Revoke signing key in registry
        vm.prank(publisher);
        registry.revokeKey(TEST_DOMAIN, signingKey);

        vm.expectRevert(IReleaseAttestationVerifier.UnauthorizedSigningKey.selector);
        releaseVerifier.verifyAttestation(uid, 1715000000);
    }

    function test_TV_EAS_006_NonExistentAttestationUID() public {
        vm.expectRevert(IReleaseAttestationVerifier.AttestationNotFound.selector);
        releaseVerifier.verifyAttestation(bytes32(0), 1715000000);

        vm.expectRevert(IReleaseAttestationVerifier.AttestationNotFound.selector);
        releaseVerifier.verifyAttestation(keccak256("nonexistent"), 1715000000);
    }

    function test_TV_EAS_007_Boundary_ExactExpiration() public {
        uint64 expiry = 1715000000;
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, expiry, bytes32(0), 1);

        // Exactly at expiration passes
        IReleaseAttestationVerifier.VerificationResult memory res = releaseVerifier.verifyAttestation(uid, expiry);
        assertTrue(res.isValid);
    }

    function test_TV_EAS_008_Boundary_OneSecondPastExpiration() public {
        uint64 expiry = 1715000000;
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, expiry, bytes32(0), 1);

        // Exactly 1 second past expiration reverts
        vm.expectRevert(IReleaseAttestationVerifier.AttestationExpired.selector);
        releaseVerifier.verifyAttestation(uid, expiry + 1);
    }

    // =========================================================================
    // 2. CRITICAL ROLE SEPARATION & AUTHORIZATION
    // =========================================================================

    function test_RoleSeparation_AttesterIsNotSigningKey() public {
        // Attester is a backend relayer account, NOT the publisher or signing key
        address backendRelayer = makeAddr("backendRelayer");
        assertTrue(backendRelayer != signingKey);
        assertTrue(backendRelayer != publisher);

        bytes32 uid = _createAttestation(backendRelayer, TEST_TIMESTAMP, TEST_EXPIRES_AT, bytes32(0), 1);

        // Verification checks signing key authorization, not msg.sender/attester
        IReleaseAttestationVerifier.VerificationResult memory res =
            releaseVerifier.verifyAttestation(uid, TEST_TIMESTAMP + 1000);
        assertTrue(res.isValid);
        assertEq(res.signingKey, signingKey);
    }

    function test_RevertIf_SuspendedPublisher() public {
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, TEST_EXPIRES_AT, bytes32(0), 1);

        vm.prank(publisher);
        registry.suspendPublisher(TEST_DOMAIN);

        vm.expectRevert(IReleaseAttestationVerifier.PublisherSuspended.selector);
        releaseVerifier.verifyAttestation(uid, TEST_TIMESTAMP + 1000);
    }

    // =========================================================================
    // 3. RELEASE ATTESTATION & REVOCATION HELPERS
    // =========================================================================

    function test_AttestRelease_ViaHelper() public {
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: uint64(block.timestamp),
            expiresAt: TEST_EXPIRES_AT
        });

        bytes memory signature = _signManifest(signingKeyPriv, manifest);

        IReleaseAttestationVerifier.ReleaseAttestationData memory data =
            IReleaseAttestationVerifier.ReleaseAttestationData({
                manifestHash: TEST_MANIFEST_HASH,
                domain: TEST_DOMAIN,
                version: TEST_VERSION,
                sequence: 1,
                previousManifestHash: bytes32(0),
                signingKey: signingKey,
                signature: signature
            });

        vm.prank(publisher);
        bytes32 uid = releaseVerifier.attestRelease(data, TEST_EXPIRES_AT);
        assertTrue(uid != bytes32(0));

        IReleaseAttestationVerifier.VerificationResult memory res =
            releaseVerifier.verifyAttestation(uid, uint64(block.timestamp));
        assertTrue(res.isValid);
    }

    function test_RevokeRelease_ViaHelper_Success() public {
        // Publisher attests release through helper
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: uint64(block.timestamp),
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory signature = _signManifest(signingKeyPriv, manifest);

        IReleaseAttestationVerifier.ReleaseAttestationData memory data =
            IReleaseAttestationVerifier.ReleaseAttestationData({
                manifestHash: TEST_MANIFEST_HASH,
                domain: TEST_DOMAIN,
                version: TEST_VERSION,
                sequence: 1,
                previousManifestHash: bytes32(0),
                signingKey: signingKey,
                signature: signature
            });

        bytes32 uid = releaseVerifier.attestRelease(data, TEST_EXPIRES_AT);

        // Only the genuine domain owner can revoke
        vm.prank(publisher);
        releaseVerifier.revokeRelease(uid);

        // Subsequent verification must revert AttestationRevoked
        vm.expectRevert(IReleaseAttestationVerifier.AttestationRevoked.selector);
        releaseVerifier.verifyAttestation(uid, uint64(block.timestamp));
    }

    function test_RevertIf_RevokeRelease_UnauthorizedAttacker() public {
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, TEST_EXPIRES_AT, bytes32(0), 1);

        vm.prank(attacker);
        vm.expectRevert(IReleaseAttestationVerifier.NotDomainOwner.selector);
        releaseVerifier.revokeRelease(uid);
    }
}

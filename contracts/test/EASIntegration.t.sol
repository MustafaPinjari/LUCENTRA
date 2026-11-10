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
import {MockEAS} from "test/mocks/MockEAS.sol";
import {PublisherRegistry} from "src/PublisherRegistry.sol";
import {SignatureVerifier} from "src/SignatureVerifier.sol";
import {ReleaseAttestationVerifier} from "src/ReleaseAttestationVerifier.sol";
import {IReleaseAttestationVerifier} from "src/interfaces/IReleaseAttestationVerifier.sol";
import {ISignatureVerifier} from "src/interfaces/ISignatureVerifier.sol";

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

        // Register Release Schema ID (Sprint 2.1: 9 fields including sequence, previousManifestHash, timestamp, expiresAt)
        string memory schemaString =
            "bytes32 manifestHash,string domain,string version,uint64 sequence,bytes32 previousManifestHash,uint64 timestamp,uint64 expiresAt,address signingKey,bytes signature";
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
                manifest.sequence,
                manifest.previousManifestHash,
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
            sequence: sequence,
            previousManifestHash: previousHash,
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: time,
            expiresAt: expirationTime
        });

        bytes memory signature = _signManifest(signingKeyPriv, manifest);

        bytes memory payload = abi.encode(
            TEST_MANIFEST_HASH,
            TEST_DOMAIN,
            TEST_VERSION,
            sequence,
            previousHash,
            time,
            expirationTime,
            signingKey,
            signature
        );

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
        uint64 curTime = uint64(block.timestamp);
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: curTime,
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
                timestamp: curTime,
                expiresAt: TEST_EXPIRES_AT,
                signingKey: signingKey,
                signature: signature
            });

        vm.prank(publisher);
        bytes32 uid = releaseVerifier.attestRelease(data);
        assertTrue(uid != bytes32(0));

        IReleaseAttestationVerifier.VerificationResult memory res = releaseVerifier.verifyAttestation(uid, curTime);
        assertTrue(res.isValid);
        assertEq(res.sequence, 1);
        assertEq(res.manifestHash, TEST_MANIFEST_HASH);
    }

    function test_RevokeRelease_ViaHelper_Success() public {
        // Publisher attests release through helper
        uint64 curTime = uint64(block.timestamp);
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: curTime,
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
                timestamp: curTime,
                expiresAt: TEST_EXPIRES_AT,
                signingKey: signingKey,
                signature: signature
            });

        vm.prank(publisher);
        bytes32 uid = releaseVerifier.attestRelease(data);

        // Only the genuine domain owner can revoke
        vm.prank(publisher);
        releaseVerifier.revokeRelease(uid);

        // Subsequent verification must revert AttestationRevoked
        vm.expectRevert(IReleaseAttestationVerifier.AttestationRevoked.selector);
        releaseVerifier.verifyAttestation(uid, curTime);
    }

    function test_RevertIf_RevokeRelease_UnauthorizedAttacker() public {
        bytes32 uid = _createAttestation(relayer, TEST_TIMESTAMP, TEST_EXPIRES_AT, bytes32(0), 1);

        vm.prank(attacker);
        vm.expectRevert(IReleaseAttestationVerifier.NotDomainOwner.selector);
        releaseVerifier.revokeRelease(uid);
    }

    // =========================================================================
    // 4. SPRINT 2.1 SECURITY REMEDIATION TESTS
    // =========================================================================

    function test_RevertIf_AttestRelease_SequenceRollback() public {
        uint64 curTime = uint64(block.timestamp);
        // Release 1 (seq = 2)
        ISignatureVerifier.ReleaseManifest memory m1 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "2.0.0",
            sequence: 2,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s1 = _signManifest(signingKeyPriv, m1);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d1 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: TEST_MANIFEST_HASH,
            domain: TEST_DOMAIN,
            version: "2.0.0",
            sequence: 2,
            previousManifestHash: bytes32(0),
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s1
        });
        vm.prank(publisher);
        releaseVerifier.attestRelease(d1);

        // Release 2 attempts sequence rollback (seq = 1)
        bytes32 newHash = keccak256("manifest2");
        ISignatureVerifier.ReleaseManifest memory m2 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: TEST_MANIFEST_HASH,
            manifestHash: newHash,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s2 = _signManifest(signingKeyPriv, m2);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d2 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: newHash,
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: TEST_MANIFEST_HASH,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s2
        });

        vm.prank(publisher);
        vm.expectRevert(IReleaseAttestationVerifier.SequenceRollback.selector);
        releaseVerifier.attestRelease(d2);
    }

    function test_RevertIf_AttestRelease_DuplicateSequence() public {
        uint64 curTime = uint64(block.timestamp);
        // Release 1 (seq = 1)
        ISignatureVerifier.ReleaseManifest memory m1 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s1 = _signManifest(signingKeyPriv, m1);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d1 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: TEST_MANIFEST_HASH,
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: bytes32(0),
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s1
        });
        vm.prank(publisher);
        releaseVerifier.attestRelease(d1);

        // Attempt second release with duplicate sequence 1
        bytes32 newHash = keccak256("manifest2");
        ISignatureVerifier.ReleaseManifest memory m2 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "1.0.1",
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: newHash,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s2 = _signManifest(signingKeyPriv, m2);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d2 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: newHash,
            domain: TEST_DOMAIN,
            version: "1.0.1",
            sequence: 1,
            previousManifestHash: bytes32(0),
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s2
        });

        vm.prank(publisher);
        vm.expectRevert(IReleaseAttestationVerifier.SequenceRollback.selector);
        releaseVerifier.attestRelease(d2);
    }

    function test_RevertIf_AttestRelease_BrokenContinuity() public {
        uint64 curTime = uint64(block.timestamp);
        // Release 1 (seq = 1, hash = TEST_MANIFEST_HASH)
        ISignatureVerifier.ReleaseManifest memory m1 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s1 = _signManifest(signingKeyPriv, m1);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d1 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: TEST_MANIFEST_HASH,
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: bytes32(0),
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s1
        });
        vm.prank(publisher);
        releaseVerifier.attestRelease(d1);

        // Release 2 (seq = 2) provides incorrect previousManifestHash
        bytes32 wrongPreviousHash = keccak256("tampered_previous_hash");
        bytes32 newHash = keccak256("manifest2");
        ISignatureVerifier.ReleaseManifest memory m2 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "2.0.0",
            sequence: 2,
            previousManifestHash: wrongPreviousHash,
            manifestHash: newHash,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s2 = _signManifest(signingKeyPriv, m2);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d2 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: newHash,
            domain: TEST_DOMAIN,
            version: "2.0.0",
            sequence: 2,
            previousManifestHash: wrongPreviousHash,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s2
        });

        vm.prank(publisher);
        vm.expectRevert(IReleaseAttestationVerifier.BrokenContinuity.selector);
        releaseVerifier.attestRelease(d2);
    }

    function test_RevertIf_AttestRelease_FutureTimestamp() public {
        // Publisher signs with timestamp > block.timestamp + 1 hours
        uint64 futureTime = uint64(block.timestamp + 3601);
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: futureTime,
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
                timestamp: futureTime,
                expiresAt: TEST_EXPIRES_AT,
                signingKey: signingKey,
                signature: signature
            });

        vm.prank(publisher);
        vm.expectRevert(IReleaseAttestationVerifier.FutureTimestamp.selector);
        releaseVerifier.attestRelease(data);
    }

    function test_RevertIf_AttestRelease_InvalidExpirationRange() public {
        uint64 curTime = uint64(block.timestamp);
        // expiresAt == timestamp
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: curTime,
            expiresAt: curTime
        });
        bytes memory signature = _signManifest(signingKeyPriv, manifest);

        IReleaseAttestationVerifier.ReleaseAttestationData memory data =
            IReleaseAttestationVerifier.ReleaseAttestationData({
                manifestHash: TEST_MANIFEST_HASH,
                domain: TEST_DOMAIN,
                version: TEST_VERSION,
                sequence: 1,
                previousManifestHash: bytes32(0),
                timestamp: curTime,
                expiresAt: curTime,
                signingKey: signingKey,
                signature: signature
            });

        vm.prank(publisher);
        vm.expectRevert(IReleaseAttestationVerifier.InvalidExpirationRange.selector);
        releaseVerifier.attestRelease(data);
    }

    function test_RevertIf_AttestRelease_AlreadyExpired() public {
        // Warp forward so past timestamp does not underflow
        vm.warp(1000);
        uint64 pastTime = 800;
        uint64 expiredTime = 900;
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: pastTime,
            expiresAt: expiredTime
        });
        bytes memory signature = _signManifest(signingKeyPriv, manifest);

        IReleaseAttestationVerifier.ReleaseAttestationData memory data =
            IReleaseAttestationVerifier.ReleaseAttestationData({
                manifestHash: TEST_MANIFEST_HASH,
                domain: TEST_DOMAIN,
                version: TEST_VERSION,
                sequence: 1,
                previousManifestHash: bytes32(0),
                timestamp: pastTime,
                expiresAt: expiredTime,
                signingKey: signingKey,
                signature: signature
            });

        vm.prank(publisher);
        vm.expectRevert(IReleaseAttestationVerifier.AttestationExpired.selector);
        releaseVerifier.attestRelease(data);
    }

    function test_AttestRelease_PreservesPublisherSignedTimestamps() public {
        // Publisher creates and signs manifest 10 minutes ago
        uint64 publisherSignedTime = uint64(vm.getBlockTimestamp());
        uint64 publisherExpiresAt = publisherSignedTime + 30 days;

        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: TEST_VERSION,
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: TEST_MANIFEST_HASH,
            timestamp: publisherSignedTime,
            expiresAt: publisherExpiresAt
        });
        bytes memory signature = _signManifest(signingKeyPriv, manifest);

        // Time elapses before on-chain submission (e.g. 15 minutes of queuing/relaying)
        vm.warp(vm.getBlockTimestamp() + 15 minutes);

        IReleaseAttestationVerifier.ReleaseAttestationData memory data =
            IReleaseAttestationVerifier.ReleaseAttestationData({
                manifestHash: TEST_MANIFEST_HASH,
                domain: TEST_DOMAIN,
                version: TEST_VERSION,
                sequence: 1,
                previousManifestHash: bytes32(0),
                timestamp: publisherSignedTime,
                expiresAt: publisherExpiresAt,
                signingKey: signingKey,
                signature: signature
            });

        vm.prank(publisher);
        bytes32 uid = releaseVerifier.attestRelease(data);

        // Decode stored attestation data directly from EAS
        (,,,,, uint64 storedTime, uint64 storedExpiry,,) = abi.decode(
            eas.getAttestation(uid).data, (bytes32, string, string, uint64, bytes32, uint64, uint64, address, bytes)
        );

        // Stored timestamp matches the original publisher-signed timestamp, NOT block.timestamp
        assertEq(storedTime, publisherSignedTime);
        assertEq(storedExpiry, publisherExpiresAt);
        assertTrue(storedTime != uint64(block.timestamp));
    }

    function test_AttestRelease_SequenceProgression_MultipleReleases() public {
        uint64 curTime = uint64(block.timestamp);
        bytes32 h1 = TEST_MANIFEST_HASH;
        bytes32 h2 = keccak256("v2_manifest");
        bytes32 h3 = keccak256("v3_manifest");

        // Release 1 (seq = 1, prev = 0)
        ISignatureVerifier.ReleaseManifest memory m1 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: bytes32(0),
            manifestHash: h1,
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s1 = _signManifest(signingKeyPriv, m1);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d1 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: h1,
            domain: TEST_DOMAIN,
            version: "1.0.0",
            sequence: 1,
            previousManifestHash: bytes32(0),
            timestamp: curTime,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s1
        });
        vm.prank(publisher);
        releaseVerifier.attestRelease(d1);

        // Release 2 (seq = 2, prev = h1)
        ISignatureVerifier.ReleaseManifest memory m2 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "2.0.0",
            sequence: 2,
            previousManifestHash: h1,
            manifestHash: h2,
            timestamp: curTime + 10,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s2 = _signManifest(signingKeyPriv, m2);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d2 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: h2,
            domain: TEST_DOMAIN,
            version: "2.0.0",
            sequence: 2,
            previousManifestHash: h1,
            timestamp: curTime + 10,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s2
        });
        vm.prank(publisher);
        releaseVerifier.attestRelease(d2);

        // Release 3 (seq = 3, prev = h2)
        ISignatureVerifier.ReleaseManifest memory m3 = ISignatureVerifier.ReleaseManifest({
            domain: TEST_DOMAIN,
            version: "3.0.0",
            sequence: 3,
            previousManifestHash: h2,
            manifestHash: h3,
            timestamp: curTime + 20,
            expiresAt: TEST_EXPIRES_AT
        });
        bytes memory s3 = _signManifest(signingKeyPriv, m3);
        IReleaseAttestationVerifier.ReleaseAttestationData memory d3 = IReleaseAttestationVerifier.ReleaseAttestationData({
            manifestHash: h3,
            domain: TEST_DOMAIN,
            version: "3.0.0",
            sequence: 3,
            previousManifestHash: h2,
            timestamp: curTime + 20,
            expiresAt: TEST_EXPIRES_AT,
            signingKey: signingKey,
            signature: s3
        });
        vm.prank(publisher);
        bytes32 uid3 = releaseVerifier.attestRelease(d3);

        bytes32 dHash = keccak256(bytes(TEST_DOMAIN));
        assertEq(releaseVerifier.latestSequence(dHash), 3);
        assertEq(releaseVerifier.latestManifestHash(dHash), h3);

        IReleaseAttestationVerifier.VerificationResult memory res3 =
            releaseVerifier.verifyAttestation(uid3, curTime + 25);
        assertTrue(res3.isValid);
        assertEq(res3.sequence, 3);
        assertEq(res3.manifestHash, h3);
    }
}

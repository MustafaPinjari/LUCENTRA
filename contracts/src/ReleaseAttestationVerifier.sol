// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {
    IEAS,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";
import {IPublisherRegistry} from "src/interfaces/IPublisherRegistry.sol";
import {ISignatureVerifier} from "src/interfaces/ISignatureVerifier.sol";
import {IReleaseAttestationVerifier} from "src/interfaces/IReleaseAttestationVerifier.sol";

/**
 * @title ReleaseAttestationVerifier
 * @notice Bridges the Ethereum Attestation Service (EAS) with LUCENTRA's PublisherRegistry and SignatureVerifier.
 * @dev Enforces multi-tier evaluation of EAS release attestations:
 * 1. Existence: Attestation UID is non-zero
 * 2. Revocation: Attestation revocationTime is zero
 * 3. Expiration: Evaluation timestamp does not exceed attestation expirationTime
 * 4. Schema: Attestation schema strictly matches release schema
 * 5. Signature: Cryptographic manifest signature is valid for manifestHash, domain, and version
 * 6. Authorization: Signing key is registered and actively authorized in PublisherRegistry
 * 7. Publisher Status: Target domain publisher is not suspended
 */
contract ReleaseAttestationVerifier is IReleaseAttestationVerifier, ReentrancyGuard {
    /// @notice Ethereum Attestation Service core contract
    IEAS public immutable eas;

    /// @notice Authoritative PublisherRegistry contract
    IPublisherRegistry public immutable publisherRegistry;

    /// @notice Cryptographic EIP-712 SignatureVerifier contract
    ISignatureVerifier public immutable signatureVerifier;

    /// @notice Approved EAS Schema UID for release attestations
    bytes32 public immutable releaseSchemaId;

    /// @notice Tracks the highest attested release sequence per domain
    mapping(bytes32 => uint64) public latestSequence;

    /// @notice Tracks the latest manifest hash per domain for release sequence continuity
    mapping(bytes32 => bytes32) public latestManifestHash;

    /**
     * @notice Initializes the verifier with core protocol contracts.
     * @param _eas Address of deployed EAS contract.
     * @param _publisherRegistry Address of deployed PublisherRegistry.
     * @param _signatureVerifier Address of deployed SignatureVerifier.
     * @param _releaseSchemaId Registered EAS schema UID for release attestations.
     */
    constructor(address _eas, address _publisherRegistry, address _signatureVerifier, bytes32 _releaseSchemaId) {
        if (_eas == address(0) || _publisherRegistry == address(0) || _signatureVerifier == address(0)) {
            revert ZeroAddress();
        }
        eas = IEAS(_eas);
        publisherRegistry = IPublisherRegistry(_publisherRegistry);
        signatureVerifier = ISignatureVerifier(_signatureVerifier);
        releaseSchemaId = _releaseSchemaId;
    }

    /**
     * @notice Evaluates an EAS attestation against all five verification tiers and cryptographic invariants.
     * @param attestationUid The UID of the EAS attestation to verify.
     * @param evaluationTime Unix timestamp for expiration evaluation (0 to use block.timestamp).
     * @return res The detailed verification result struct.
     */
    function verifyAttestation(bytes32 attestationUid, uint64 evaluationTime)
        public
        view
        returns (VerificationResult memory res)
    {
        if (attestationUid == bytes32(0)) revert AttestationNotFound();

        Attestation memory attestation = eas.getAttestation(attestationUid);
        if (attestation.uid == bytes32(0)) revert AttestationNotFound();

        // Tier 2: Revocation Check
        if (attestation.revocationTime != 0) revert AttestationRevoked();

        // Tier 3: Dynamic Expiration Check
        uint64 evalTime = evaluationTime == 0 ? SafeCast.toUint64(block.timestamp) : evaluationTime;
        if (attestation.expirationTime != 0 && evalTime > attestation.expirationTime) {
            revert AttestationExpired();
        }

        // Schema Check
        if (attestation.schema != releaseSchemaId) revert InvalidAttestationSchema();

        // Decode attestation payload
        (
            bytes32 manifestHash,
            string memory domain,
            string memory version,
            uint64 sequence,
            bytes32 previousManifestHash,
            uint64 timestamp,
            uint64 expiresAt,
            address claimedSigningKey,
            bytes memory signature
        ) = abi.decode(attestation.data, (bytes32, string, string, uint64, bytes32, uint64, uint64, address, bytes));

        // Evaluate manifest expiration against evaluation time
        if (expiresAt != 0 && evalTime > expiresAt) {
            revert AttestationExpired();
        }

        // Publisher suspension check
        if (publisherRegistry.isPublisherSuspended(domain)) {
            revert PublisherSuspended();
        }

        // Signing key authorization check
        if (!publisherRegistry.isKeyAuthorized(domain, claimedSigningKey)) {
            revert UnauthorizedSigningKey();
        }

        // Cryptographic EIP-712 signature verification
        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: domain,
            version: version,
            sequence: sequence,
            previousManifestHash: previousManifestHash,
            manifestHash: manifestHash,
            timestamp: timestamp,
            expiresAt: expiresAt
        });

        address recoveredSigner = signatureVerifier.recoverSigner(manifest, signature);
        if (recoveredSigner != claimedSigningKey) {
            revert InvalidReleaseSignature();
        }

        address publisher = publisherRegistry.getDomainOwner(domain);

        return VerificationResult({
            isValid: true,
            manifestHash: manifestHash,
            domain: domain,
            version: version,
            sequence: sequence,
            signingKey: claimedSigningKey,
            publisher: publisher
        });
    }

    /**
     * @notice Helper to submit an attested release directly to EAS with pre-flight protocol validation.
     * @dev Validates signing key authorization, temporal range, sequence continuity, and EIP-712 signature.
     * Preserves publisher-signed timestamp without replacing it with block.timestamp.
     * @param data Release attestation parameters.
     * @return uid The newly created EAS attestation UID.
     */
    function attestRelease(ReleaseAttestationData calldata data) external payable nonReentrant returns (bytes32 uid) {
        if (publisherRegistry.isPublisherSuspended(data.domain)) revert PublisherSuspended();
        if (!publisherRegistry.isKeyAuthorized(data.domain, data.signingKey)) revert UnauthorizedSigningKey();

        // Enforce temporal validity
        if (data.expiresAt <= data.timestamp) revert InvalidExpirationRange();
        if (data.expiresAt <= block.timestamp) revert AttestationExpired();
        if (data.timestamp > block.timestamp + 3600) revert FutureTimestamp();

        // Enforce sequence progression and continuity
        bytes32 dHash = keccak256(bytes(data.domain));
        if (data.sequence == 0) revert InvalidParameters();
        uint64 currentSeq = latestSequence[dHash];
        if (currentSeq != 0 && data.sequence <= currentSeq) revert SequenceRollback();
        if (currentSeq != 0 && data.previousManifestHash != latestManifestHash[dHash]) revert BrokenContinuity();

        ISignatureVerifier.ReleaseManifest memory manifest = ISignatureVerifier.ReleaseManifest({
            domain: data.domain,
            version: data.version,
            sequence: data.sequence,
            previousManifestHash: data.previousManifestHash,
            manifestHash: data.manifestHash,
            timestamp: data.timestamp,
            expiresAt: data.expiresAt
        });

        address recovered = signatureVerifier.recoverSigner(manifest, data.signature);
        if (recovered != data.signingKey) revert InvalidReleaseSignature();

        bytes memory encodedData = abi.encode(
            data.manifestHash,
            data.domain,
            data.version,
            data.sequence,
            data.previousManifestHash,
            data.timestamp,
            data.expiresAt,
            data.signingKey,
            data.signature
        );

        AttestationRequest memory req = AttestationRequest({
            schema: releaseSchemaId,
            data: AttestationRequestData({
                recipient: publisherRegistry.getDomainOwner(data.domain),
                expirationTime: data.expiresAt,
                revocable: true,
                refUID: bytes32(0),
                data: encodedData,
                value: msg.value
            })
        });

        latestSequence[dHash] = data.sequence;
        latestManifestHash[dHash] = data.manifestHash;

        uid = eas.attest{value: msg.value}(req);
        emit ReleaseAttested(uid, data.manifestHash, data.domain, data.version, data.sequence);
    }

    /**
     * @notice Revokes an active release attestation.
     * @dev Restricted strictly to the registered domain owner in PublisherRegistry.
     * @param attestationUid The UID of the attestation to revoke.
     */
    function revokeRelease(bytes32 attestationUid) external nonReentrant {
        if (attestationUid == bytes32(0)) revert AttestationNotFound();

        Attestation memory attestation = eas.getAttestation(attestationUid);
        if (attestation.uid == bytes32(0)) revert AttestationNotFound();

        // Decode domain from payload
        (, string memory domain,,,,,,,) =
            abi.decode(attestation.data, (bytes32, string, string, uint64, bytes32, uint64, uint64, address, bytes));

        address domainOwner = publisherRegistry.getDomainOwner(domain);
        if (msg.sender != domainOwner) revert NotDomainOwner();

        RevocationRequest memory req =
            RevocationRequest({schema: releaseSchemaId, data: RevocationRequestData({uid: attestationUid, value: 0})});

        emit ReleaseRevoked(attestationUid, domain, msg.sender);
        eas.revoke(req);
    }
}

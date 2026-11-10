// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IReleaseAttestationVerifier
 * @notice Interface for EAS release attestation validation and lifecycle management.
 */
interface IReleaseAttestationVerifier {
    struct ReleaseAttestationData {
        bytes32 manifestHash;
        string domain;
        string version;
        uint64 sequence;
        bytes32 previousManifestHash;
        address signingKey;
        bytes signature;
    }

    struct VerificationResult {
        bool isValid;
        bytes32 manifestHash;
        string domain;
        string version;
        uint64 sequence;
        address signingKey;
        address publisher;
    }

    // Custom Errors
    error AttestationNotFound();
    error AttestationRevoked();
    error AttestationExpired();
    error InvalidAttestationSchema();
    error InvalidReleaseSignature();
    error UnauthorizedSigningKey();
    error PublisherSuspended();
    error SequenceRollback();
    error BrokenContinuity();
    error NotDomainOwner();
    error ZeroAddress();

    event ReleaseAttested(
        bytes32 indexed uid, bytes32 indexed manifestHash, string domain, string version, uint64 sequence
    );
    event ReleaseRevoked(bytes32 indexed uid, string domain, address indexed revoker);

    function verifyAttestation(bytes32 attestationUid, uint64 evaluationTime)
        external
        view
        returns (VerificationResult memory);

    function attestRelease(ReleaseAttestationData calldata data, uint64 expirationTime)
        external
        payable
        returns (bytes32 uid);

    function revokeRelease(bytes32 attestationUid) external;
}

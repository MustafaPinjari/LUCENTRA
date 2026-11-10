// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ISignatureVerifier
 * @notice Formal interface for LUCENTRA EIP-712 release signature verification.
 */
interface ISignatureVerifier {
    struct ReleaseManifest {
        string domain;
        string version;
        uint64 sequence;
        bytes32 previousManifestHash;
        bytes32 manifestHash;
        uint64 timestamp;
        uint64 expiresAt;
    }

    // Custom Errors
    error InvalidSignature();
    error SignatureExpired();
    error UnauthorizedSigner();
    error PublisherSuspended();
    error UnregisteredPublisher();
    error InvalidParameters();
    error InvalidExpirationRange();

    function hashReleaseManifest(ReleaseManifest calldata manifest) external view returns (bytes32);

    function recoverSigner(ReleaseManifest calldata manifest, bytes calldata signature) external view returns (address);

    function verifyRelease(
        ReleaseManifest calldata manifest,
        bytes calldata signature,
        address publisherRegistry,
        uint64 evaluationTime
    ) external view returns (bool, address);
}

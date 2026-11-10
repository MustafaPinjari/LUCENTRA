// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ISignatureVerifier} from "./interfaces/ISignatureVerifier.sol";
import {IPublisherRegistry} from "./interfaces/IPublisherRegistry.sol";

/**
 * @title SignatureVerifier
 * @notice Reusable EIP-712 structured data signature verification component for LUCENTRA release manifests.
 * @dev Validates release manifest integrity, evaluates expiration boundaries, recovers signing keys,
 * and checks authorization against PublisherRegistry.sol.
 */
contract SignatureVerifier is ISignatureVerifier, EIP712 {
    using ECDSA for bytes32;

    /// @notice Approved EIP-712 typehash for ReleaseManifest structured messages
    bytes32 public constant RELEASE_MANIFEST_TYPEHASH = keccak256(
        "ReleaseManifest(string domain,string version,bytes32 manifestHash,uint64 timestamp,uint64 expiresAt)"
    );

    constructor() EIP712("LUCENTRA", "1") {}

    /**
     * @notice Computes the EIP-712 typed data hash for a given ReleaseManifest message.
     * @param manifest The structured release manifest payload.
     * @return digest The 32-byte EIP-712 signing digest.
     */
    function hashReleaseManifest(ReleaseManifest calldata manifest) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                RELEASE_MANIFEST_TYPEHASH,
                keccak256(bytes(manifest.domain)),
                keccak256(bytes(manifest.version)),
                manifest.manifestHash,
                manifest.timestamp,
                manifest.expiresAt
            )
        );
        return _hashTypedDataV4(structHash);
    }

    /**
     * @notice Recovers the secp256k1 signing key address from a release manifest signature.
     * @param manifest The structured release manifest payload.
     * @param signature The 65-byte ECDSA signature (r, s, v).
     * @return signer The recovered Ethereum address.
     */
    function recoverSigner(ReleaseManifest calldata manifest, bytes calldata signature) public view returns (address) {
        bytes32 digest = hashReleaseManifest(manifest);
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || signer == address(0)) {
            revert InvalidSignature();
        }
        return signer;
    }

    /**
     * @notice Comprehensive release verification checking signature validity, temporal boundaries,
     * and signing key authorization in the PublisherRegistry.
     * @param manifest The structured release manifest payload.
     * @param signature The 65-byte ECDSA signature.
     * @param publisherRegistry Address of the authoritative PublisherRegistry contract.
     * @param evaluationTime Evaluation timestamp in seconds (pass 0 to use block.timestamp).
     * @return isValid True if signature is valid, unexpired, and key is actively authorized.
     * @return signer Address of the verified signing key.
     */
    function verifyRelease(
        ReleaseManifest calldata manifest,
        bytes calldata signature,
        address publisherRegistry,
        uint64 evaluationTime
    ) external view returns (bool isValid, address signer) {
        if (publisherRegistry == address(0)) revert InvalidParameters();

        uint64 evalTime = evaluationTime == 0 ? SafeCast.toUint64(block.timestamp) : evaluationTime;
        if (evalTime > manifest.expiresAt) {
            revert SignatureExpired();
        }

        signer = recoverSigner(manifest, signature);

        IPublisherRegistry registry = IPublisherRegistry(publisherRegistry);
        address owner = registry.getDomainOwner(manifest.domain);
        if (owner == address(0)) {
            revert UnregisteredPublisher();
        }

        if (registry.isPublisherSuspended(manifest.domain)) {
            revert PublisherSuspended();
        }

        if (!registry.isKeyAuthorized(manifest.domain, signer)) {
            revert UnauthorizedSigner();
        }

        return (true, signer);
    }

    /**
     * @notice Returns the EIP-712 domain separator for this contract.
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}

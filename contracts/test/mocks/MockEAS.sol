// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {
    IEAS,
    AttestationRequest,
    RevocationRequest
} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {Attestation, EMPTY_UID} from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";

/**
 * @title MockEAS
 * @notice Realistic in-memory implementation of official IEAS for local testing.
 */
contract MockEAS {
    uint256 private _uidNonce;
    mapping(bytes32 => Attestation) private _attestations;

    event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID);
    event Revoked(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID);

    function attest(AttestationRequest calldata request) external payable returns (bytes32) {
        _uidNonce++;
        bytes32 uid = keccak256(abi.encodePacked(_uidNonce, block.timestamp, msg.sender, request.schema));

        Attestation memory attestation = Attestation({
            uid: uid,
            schema: request.schema,
            time: uint64(block.timestamp),
            expirationTime: request.data.expirationTime,
            revocationTime: 0,
            refUID: request.data.refUID,
            recipient: request.data.recipient,
            attester: msg.sender,
            revocable: request.data.revocable,
            data: request.data.data
        });

        _attestations[uid] = attestation;
        emit Attested(request.data.recipient, msg.sender, uid, request.schema);
        return uid;
    }

    function revoke(RevocationRequest calldata request) external payable {
        Attestation storage attestation = _attestations[request.data.uid];
        require(attestation.uid != EMPTY_UID, "Attestation not found");
        require(attestation.revocable, "Attestation not revocable");
        require(attestation.revocationTime == 0, "Already revoked");

        attestation.revocationTime = uint64(block.timestamp);
        emit Revoked(attestation.recipient, attestation.attester, request.data.uid, request.schema);
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _attestations[uid];
    }

    function isAttestationValid(bytes32 uid) external view returns (bool) {
        Attestation memory attestation = _attestations[uid];
        if (attestation.uid == EMPTY_UID) return false;
        if (attestation.revocationTime != 0) return false;
        if (attestation.expirationTime != 0 && block.timestamp > attestation.expirationTime) return false;
        return true;
    }
}

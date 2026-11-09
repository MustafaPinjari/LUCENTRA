# Publisher Registry Specification (`PublisherRegistry.sol`) — LUCENTRA

**Document ID:** LUC-BC-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the complete technical specification and Solidity reference implementation for `PublisherRegistry.sol`.

---

## 2. Complete Solidity Reference Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PublisherRegistry is Ownable2Step, EIP712, ReentrancyGuard {
    enum KeyStatus { UNAUTHORIZED, ACTIVE, REVOKED }

    struct DomainRecord {
        address owner;
        uint64 registeredAt;
        bool isRevoked;
        string domain;
        mapping(address => KeyStatus) authorizedKeys;
    }

    bytes32 public constant DOMAIN_AUTH_TYPEHASH = keccak256(
        "DomainAuthorization(string domain,address owner,uint256 nonce,uint256 deadline)"
    );

    address public dnsVerifierSigner;
    mapping(bytes32 => DomainRecord) private _domains;
    mapping(address => uint256) public nonces;

    event DomainRegistered(bytes32 indexed domainHash, string domain, address indexed owner, uint64 timestamp);
    event KeyAuthorized(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event KeyRevoked(bytes32 indexed domainHash, address indexed signingKey, uint64 timestamp);
    event DomainRevoked(bytes32 indexed domainHash, uint64 timestamp);
    event VerifierSignerUpdated(address indexed oldSigner, address indexed newSigner);

    error DomainAlreadyRegistered();
    error DomainNotRegistered();
    error NotDomainOwner();
    error InvalidVerifierSignature();
    error SignatureExpired();
    error ZeroAddress();
    error KeyAlreadyRevoked();

    modifier onlyDomainOwner(string calldata domain) {
        bytes32 dHash = keccak256(bytes(domain));
        if (_domains[dHash].owner != msg.sender) revert NotDomainOwner();
        _;
    }

    constructor(address initialVerifier) Ownable(msg.sender) EIP712("LUCENTRA", "1") {
        if (initialVerifier == address(0)) revert ZeroAddress();
        dnsVerifierSigner = initialVerifier;
    }

    function registerDomain(
        string calldata domain,
        address owner,
        uint256 deadline,
        bytes calldata verifierSignature
    ) external nonReentrant {
        if (block.timestamp > deadline) revert SignatureExpired();
        if (owner == address(0)) revert ZeroAddress();
        
        bytes32 dHash = keccak256(bytes(domain));
        if (_domains[dHash].owner != address(0)) revert DomainAlreadyRegistered();

        // Verify DNS proof signed by backend verifier
        bytes32 structHash = keccak256(
            abi.encode(DOMAIN_AUTH_TYPEHASH, keccak256(bytes(domain)), owner, nonces[owner]++, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, verifierSignature);
        if (recovered != dnsVerifierSigner) revert InvalidVerifierSignature();

        DomainRecord storage rec = _domains[dHash];
        rec.owner = owner;
        rec.registeredAt = uint64(block.timestamp);
        rec.domain = domain;
        rec.authorizedKeys[owner] = KeyStatus.ACTIVE;

        emit DomainRegistered(dHash, domain, owner, uint64(block.timestamp));
        emit KeyAuthorized(dHash, owner, uint64(block.timestamp));
    }

    function authorizeKey(string calldata domain, address signingKey) external onlyDomainOwner(domain) {
        if (signingKey == address(0)) revert ZeroAddress();
        bytes32 dHash = keccak256(bytes(domain));
        if (_domains[dHash].authorizedKeys[signingKey] == KeyStatus.REVOKED) revert KeyAlreadyRevoked();

        _domains[dHash].authorizedKeys[signingKey] = KeyStatus.ACTIVE;
        emit KeyAuthorized(dHash, signingKey, uint64(block.timestamp));
    }

    function revokeKey(string calldata domain, address signingKey) external onlyDomainOwner(domain) {
        bytes32 dHash = keccak256(bytes(domain));
        _domains[dHash].authorizedKeys[signingKey] = KeyStatus.REVOKED;
        emit KeyRevoked(dHash, signingKey, uint64(block.timestamp));
    }

    function isKeyAuthorized(string calldata domain, address signingKey) external view returns (bool) {
        bytes32 dHash = keccak256(bytes(domain));
        DomainRecord storage rec = _domains[dHash];
        if (rec.isRevoked) return false;
        return rec.authorizedKeys[signingKey] == KeyStatus.ACTIVE;
    }

    function getDomainOwner(string calldata domain) external view returns (address) {
        return _domains[keccak256(bytes(domain))].owner;
    }

    function setVerifierSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit VerifierSignerUpdated(dnsVerifierSigner, newSigner);
        dnsVerifierSigner = newSigner;
    }
}
```

---

## 3. Related Documents

- [docs/06-blockchain/SMART_CONTRACT_DESIGN.md](SMART_CONTRACT_DESIGN.md)
- [docs/06-blockchain/EVENTS_AND_ERRORS.md](EVENTS_AND_ERRORS.md)

---

## 4. References

- [OpenZeppelin Contracts v5.x](https://docs.openzeppelin.com/contracts/5.x/)

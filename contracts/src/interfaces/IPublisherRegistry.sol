// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IPublisherRegistry
 * @notice Formal interface for the LUCENTRA Publisher Registry.
 * @dev Governs domain-to-publisher identity bindings, EIP-712 registration intents,
 * and publisher-controlled release signing-key lifecycles.
 */
interface IPublisherRegistry {
    enum KeyStatus {
        UNAUTHORIZED,
        ACTIVE,
        REVOKED
    }

    struct DomainInfo {
        address owner;
        uint64 registeredAt;
        bool isSuspended;
        string domain;
    }

    // Events
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

    // Custom Errors
    error DomainAlreadyRegistered();
    error DomainNotRegistered();
    error NotDomainOwner();
    error NotRegistrar();
    error ZeroAddress();
    error EmptyDomainString();
    error KeyAlreadyRevoked();
    error KeyAlreadyActive();
    error KeyNotActive();
    error PublisherIsSuspended();
    error PublisherNotSuspended();
    error SignatureExpired();
    error InvalidSignature();
    error InvalidNonce();

    // Registration (Dual-Authorization)
    function registerPublisherDomainWithAuth(
        string calldata domain,
        address publisher,
        address initialSigningKey,
        uint64 deadline,
        bytes calldata publisherSignature
    ) external;

    // Key Lifecycle Management
    function authorizeKey(string calldata domain, address signingKey) external;
    function rotateKey(string calldata domain, address oldKey, address newKey) external;
    function revokeKey(string calldata domain, address signingKey) external;

    // Suspension & Status
    function suspendPublisher(string calldata domain) external;
    function reactivatePublisher(string calldata domain) external;

    // View Functions
    function isKeyAuthorized(string calldata domain, address signingKey) external view returns (bool);
    function isKeyAuthorizedByHash(bytes32 domainHash, address signingKey) external view returns (bool);
    function getDomainOwner(string calldata domain) external view returns (address);
    function getDomainOwnerByHash(bytes32 domainHash) external view returns (address);
    function isPublisherSuspended(string calldata domain) external view returns (bool);
    function getDomainInfo(string calldata domain) external view returns (DomainInfo memory);
    function nonces(address publisher) external view returns (uint256);
    function registrar() external view returns (address);
}

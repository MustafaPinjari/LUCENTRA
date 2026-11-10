/**
 * @file types.ts
 * @package @lucentra/core
 * @description Core TypeScript type definitions for the LUCENTRA Protocol (v0.1).
 * Formalizes Release Manifests, EIP-712 typed data, verification states, and error codes.
 */

export type Hex = `0x${string}`;
export type Address = `0x${string}`;

/**
 * Standard resource asset types approved in Protocol v0.1
 */
export type ResourceType = "script" | "module" | "worker";

/**
 * An individual JavaScript asset declared within a Release Manifest.
 */
export interface ReleaseResource {
  /**
   * Root-relative URL path to the resource (e.g. "/static/js/main.b8f41a.js").
   * Must begin with a leading forward slash ('/').
   */
  readonly path: string;

  /**
   * Exact resource file size in bytes (must be an integer >= 0).
   */
  readonly size: number;

  /**
   * FIPS 180-4 SHA-256 digest of the resource bytes, in lowercase hex prefixed with 'sha256:'.
   * Format: `sha256:${64-hex-characters}`.
   */
  readonly sha256: `sha256:${string}`;

  /**
   * Role of the JavaScript resource in the application runtime.
   */
  readonly type: ResourceType;
}

/**
 * Canonical Release Manifest (LUCENTRA-Manifest-v0.1)
 * Represents an authorized snapshot of all JavaScript resources for a domain.
 */
export interface ReleaseManifest {
  /**
   * Protocol schema version identifier. Must strictly match "LUCENTRA-Manifest-v0.1".
   */
  readonly schemaVersion: "LUCENTRA-Manifest-v0.1";

  /**
   * Canonical UTS #46 / IDNA 2008 lowercase ASCII domain name (e.g. "app.uniswap.org").
   */
  readonly domain: string;

  /**
   * Publisher release version string (1 to 64 ASCII characters).
   */
  readonly version: string;

  /**
   * Unix timestamp in seconds when the manifest was compiled.
   */
  readonly createdAt: number;

  /**
   * Unix timestamp in seconds after which this manifest is considered expired.
   * Must be strictly greater than createdAt.
   */
  readonly expiresAt: number;

  /**
   * Optional SHA-256 hash of the immediately preceding release manifest for release sequence continuity.
   */
  readonly previousManifestHash?: Hex;

  /**
   * Lexicographically ordered or unordered collection of release assets.
   * Will be deterministically sorted during RFC 8785 canonicalization.
   */
  readonly resources: readonly ReleaseResource[];
}

/**
 * EIP-712 Domain Separator parameters for release signing.
 */
export interface LucentraEip712Domain {
  readonly name: "LUCENTRA";
  readonly version: "1";
  readonly chainId: number;
  readonly verifyingContract: Address;
}

/**
 * EIP-712 Structured Message fields for ReleaseManifest.
 */
export interface ReleaseManifestMessage {
  readonly domain: string;
  readonly version: string;
  readonly manifestHash: Hex;
  readonly timestamp: bigint;
  readonly expiresAt: bigint;
}

/**
 * Complete signed release envelope carrying manifest metadata and on-chain evidence.
 */
export interface SignedReleaseEnvelope {
  readonly manifest: ReleaseManifest;
  readonly manifestHash: Hex;
  readonly signature: Hex;
  readonly signer: Address;
  readonly chainId: number;
  readonly verifyingContract: Address;
  readonly attestationUid?: Hex;
}

/**
 * The six formal protocol verification states evaluated by the verification engine.
 */
export type VerificationState =
  | "VERIFIED_RELEASE_MATCH"
  | "UNVERIFIED_RESOURCE_DETECTED"
  | "UNREGISTERED_PUBLISHER"
  | "UNATTESTED_RELEASE"
  | "REVOKED_RELEASE"
  | "INDETERMINATE";

/**
 * Structured, machine-readable error codes for verification failures.
 */
export type VerificationErrorCode =
  | "INVALID_MANIFEST_SCHEMA"
  | "INVALID_DOMAIN_FORMAT"
  | "INVALID_RESOURCE_PATH"
  | "INVALID_HASH_FORMAT"
  | "INVALID_TEMPORAL_RANGE"
  | "MANIFEST_SIZE_EXCEEDED"
  | "RESOURCE_COUNT_EXCEEDED"
  | "RESOURCE_HASH_MISMATCH"
  | "UNEXPECTED_RESOURCE_DETECTED"
  | "MISSING_RESOURCE_DETECTED"
  | "INVALID_EIP712_SIGNATURE"
  | "SIGNER_NOT_AUTHORIZED"
  | "RELEASE_EXPIRED"
  | "RELEASE_REVOKED"
  | "RELEASE_SEQUENCE_ROLLBACK"
  | "INVALID_PREVIOUS_MANIFEST_HASH"
  | "REPLAY_ATTEMPT_DETECTED"
  | "RESOURCE_RETRIEVAL_FAILED"
  | "CANONICALIZATION_FAILED"
  | "RPC_EVALUATION_ERROR";

/**
 * Per-resource verification result detail.
 */
export interface ResourceVerificationDetail {
  readonly path: string;
  readonly expectedHash: string;
  readonly observedHash: string | null;
  readonly status: "MATCH" | "MISMATCH" | "MISSING" | "UNEXPECTED" | "FAILED";
  readonly size: number;
}

/**
 * Observed resource input for the verifier engine.
 */
export interface ObservedResource {
  readonly path: string;
  readonly bytes?: Uint8Array | ArrayBuffer | string;
  readonly hash?: string;
  readonly retrievalFailed?: boolean;
  readonly retrievalError?: string;
}

/**
 * Input configuration passed into verifyRelease().
 */
export interface VerifyReleaseInput {
  /**
   * The release manifest object (parsed or raw).
   */
  readonly manifest: unknown;

  /**
   * 65-byte secp256k1 EIP-712 signature in hex.
   */
  readonly signature: Hex;

  /**
   * Expected publisher address or primary registry owner.
   */
  readonly expectedPublisher: Address;

  /**
   * List of currently authorized signing keys for the domain in PublisherRegistry.sol.
   */
  readonly authorizedSigningKeys?: readonly Address[];

  /**
   * Optional observed scripts intercepted in the browser DOM or fetched by witness daemon.
   */
  readonly observedResources?: readonly ObservedResource[];

  /**
   * Target blockchain chain ID (e.g. 11155111 for Sepolia, 421614 for Arbitrum Sepolia).
   * Defaults to 11155111.
   */
  readonly chainId?: number;

  /**
   * Verifying contract address (PublisherRegistry.sol).
   */
  readonly verifyingContract?: Address;

  /**
   * Evaluation timestamp in Unix seconds. Defaults to current wall-clock time.
   */
  readonly evaluationTime?: number;

  /**
   * On-chain revocation status flag (true if revoked in EAS or PublisherRegistry).
   */
  readonly isRevoked?: boolean;

  /**
   * Optional EAS on-chain attestation UID.
   */
  readonly attestationUid?: Hex;

  /**
   * Optional previous release information for sequence and replay validation.
   */
  readonly previousRelease?: {
    readonly version: string;
    readonly manifestHash: Hex;
    readonly createdAt?: number;
  };
}

/**
 * Comprehensive verification output returned by verifyRelease().
 */
export interface VerifyReleaseResult {
  /**
   * Primary formal verification state.
   */
  readonly state: VerificationState;

  /**
   * Boolean flag indicating complete success (true only for VERIFIED_RELEASE_MATCH).
   */
  readonly isValid: boolean;

  /**
   * Computed SHA-256 digest of RFC 8785 canonical manifest JSON.
   */
  readonly manifestHash: Hex;

  /**
   * Byte-exact canonicalized JSON string.
   */
  readonly canonicalJson: string;

  /**
   * Ethereum address recovered from the EIP-712 signature.
   */
  readonly recoveredSigner: Address;

  /**
   * Whether the recovered signer is authorized for this domain.
   */
  readonly isSignerAuthorized: boolean;

  /**
   * Whether the signature itself is mathematically valid.
   */
  readonly isSignatureValid: boolean;

  /**
   * Whether the release is expired at evaluationTime.
   */
  readonly isExpired: boolean;

  /**
   * Whether the release or key is flagged as revoked on-chain.
   */
  readonly isRevoked: boolean;

  /**
   * Detailed breakdown for each verified resource.
   */
  readonly resourceDetails: readonly ResourceVerificationDetail[];

  /**
   * Structured error list if verification failed or degraded.
   */
  readonly errors: ReadonlyArray<{
    readonly code: VerificationErrorCode;
    readonly message: string;
    readonly details?: unknown;
  }>;

  /**
   * Advisory warnings (e.g. expiring soon, cached RPC state).
   */
  readonly warnings: readonly string[];

  /**
   * Wall-clock Unix timestamp at which this verification was evaluated.
   */
  readonly evaluationTime: number;

  /**
   * Non-misleading security boundary statement.
   */
  readonly securityDisclosure: string;
}


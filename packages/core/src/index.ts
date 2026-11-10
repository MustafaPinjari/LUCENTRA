/**
 * @file index.ts
 * @package @lucentra/core
 * @description Public entry point for the LUCENTRA Cryptographic Core Engine.
 */

// Types & Interfaces
export type {
  Address,
  Hex,
  ResourceType,
  ReleaseResource,
  ReleaseManifest,
  LucentraEip712Domain,
  ReleaseManifestMessage,
  SignedReleaseEnvelope,
  VerificationState,
  VerificationErrorCode,
  ResourceVerificationDetail,
  ObservedResource,
  VerifyReleaseInput,
  VerifyReleaseResult,
} from "./types.js";

// Custom Errors
export { LucentraError, isLucentraError } from "./errors.js";

// Validation & Bounds
export {
  MAX_MANIFEST_RESOURCE_COUNT,
  MAX_MANIFEST_BYTE_SIZE,
  APPROVED_SCHEMA_VERSION,
  DOMAIN_REGEX,
  SHA256_PREFIXED_REGEX,
  normalizeDomain,
  validateResourcePath,
  validateResource,
  validateReleaseManifest,
} from "./validation.js";

// Canonicalization (RFC 8785)
export { canonicalizeManifest } from "./canonical.js";

// Cryptographic Hashing (FIPS 180-4 SHA-256)
export {
  hashManifest,
  hashResourceBytes,
  formatResourceHash,
  hashAndFormatResource,
} from "./hash.js";

// EIP-712 Structured Data Signing & Recovery
export {
  LUCENTRA_DOMAIN_NAME,
  LUCENTRA_DOMAIN_VERSION,
  DEFAULT_CHAIN_ID,
  DEFAULT_VERIFYING_CONTRACT,
  RELEASE_MANIFEST_PRIMARY_TYPE,
  RELEASE_MANIFEST_EIP712_TYPES,
  createLucentraDomain,
  buildReleaseManifestMessage,
  signReleaseManifestWithAccount,
  recoverReleaseSigner,
  verifyReleaseSignature,
  type SignReleaseOptions,
  type RecoverReleaseSignerParams,
  type VerifyReleaseSignatureParams,
} from "./signature.js";

// High-Level Verification Pipeline
export {
  verifyRelease,
  ZERO_ADDRESS,
  HONEST_VERIFICATION_SECURITY_DISCLOSURE,
} from "./verifier.js";

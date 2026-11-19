/**
 * @file verifier.ts
 * @package @lucentra/core
 * @description Comprehensive release verification pipeline evaluating the 6 formal protocol states.
 * Enforces strict complete-verification invariants: missing or failed observations yield INDETERMINATE;
 * mismatches yield UNVERIFIED_RESOURCE_DETECTED; and VERIFIED_RELEASE_MATCH is permitted only
 * when 100% of declared manifest resources are observed, retrieved, and matched.
 */

import { getAddress, isAddressEqual } from "viem";
import { canonicalizeManifest } from "./canonical.js";
import { isLucentraError } from "./errors.js";
import { formatResourceHash, hashAndFormatResource, hashManifest } from "./hash.js";
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_VERIFYING_CONTRACT,
  recoverReleaseSigner,
} from "./signature.js";
import type {
  Address,
  Hex,
  ReleaseManifest,
  ReleaseResource,
  ResourceVerificationDetail,
  VerificationErrorCode,
  VerificationState,
  VerifyReleaseInput,
  VerifyReleaseResult,
} from "./types.js";
import { validateReleaseManifest } from "./validation.js";

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
export const ZERO_BYTES32: Hex =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const HONEST_VERIFICATION_SECURITY_DISCLOSURE =
  "Verification reflects cryptographic cross-referencing between out-of-band retrieved resource hashes and publisher-attested manifests. The Chrome Extension operates within the browser extension sandbox and does not verify exact in-memory JIT bytes executed inside the V8 engine." as const;

interface ObservedEntry {
  readonly hash: string | null;
  readonly size: number;
  readonly retrievalFailed: boolean;
  readonly retrievalError?: string;
}

/**
 * Executes full end-to-end cryptographic and structural verification of a release.
 *
 * Evaluates the 6 formal protocol states:
 * - VERIFIED_RELEASE_MATCH: All declared resources observed, retrieved, and matched byte-for-byte.
 * - UNVERIFIED_RESOURCE_DETECTED: Any integrity mismatch or undeclared external script detected in DOM.
 * - UNREGISTERED_PUBLISHER: Domain not registered or signing key unauthorized.
 * - UNATTESTED_RELEASE: Release unsigned, expired, rolled back, or broken continuity.
 * - REVOKED_RELEASE: Attestation or key flagged as revoked.
 * - INDETERMINATE: Missing observations, failed retrieval, or malformed inputs.
 */
export async function verifyRelease(
  input: VerifyReleaseInput
): Promise<VerifyReleaseResult> {
  const evaluationTime = input.evaluationTime ?? Math.floor(Date.now() / 1000);
  const chainId = input.chainId ?? DEFAULT_CHAIN_ID;
  const verifyingContract = input.verifyingContract ?? DEFAULT_VERIFYING_CONTRACT;

  const errors: Array<{
    code: VerificationErrorCode;
    message: string;
    details?: unknown;
  }> = [];
  const warnings: string[] = [];
  const resourceDetails: ResourceVerificationDetail[] = [];

  let canonicalJson = "";
  let manifestHash: Hex = ZERO_BYTES32;
  let validatedManifest: ReleaseManifest | null = null;
  let recoveredSigner: Address = ZERO_ADDRESS;
  let isSignatureValid = false;
  let isSignerAuthorized = false;
  let isExpired = false;
  let isRevoked = Boolean(input.isRevoked);

  // Check 1: Registry existence
  const expectedPublisherNormalized = getAddress(input.expectedPublisher);
  if (expectedPublisherNormalized === ZERO_ADDRESS) {
    errors.push({
      code: "SIGNER_NOT_AUTHORIZED",
      message: "Publisher domain is not registered in PublisherRegistry",
    });
    return {
      state: "UNREGISTERED_PUBLISHER",
      isValid: false,
      manifestHash,
      canonicalJson,
      recoveredSigner,
      isSignerAuthorized: false,
      isSignatureValid: false,
      isExpired: false,
      isRevoked: false,
      resourceDetails: [],
      errors,
      warnings,
      evaluationTime,
      securityDisclosure: HONEST_VERIFICATION_SECURITY_DISCLOSURE,
    };
  }

  // Check 2: Revocation flag
  if (isRevoked) {
    errors.push({
      code: "RELEASE_REVOKED",
      message: "Release or signing key has been revoked on-chain",
    });
  }

  // Check 3: Schema validation
  try {
    validatedManifest = validateReleaseManifest(input.manifest);
  } catch (err: unknown) {
    const code = isLucentraError(err) ? err.code : "INVALID_MANIFEST_SCHEMA";
    errors.push({
      code,
      message: `Manifest validation failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      state: "INDETERMINATE",
      isValid: false,
      manifestHash,
      canonicalJson,
      recoveredSigner,
      isSignerAuthorized: false,
      isSignatureValid: false,
      isExpired: false,
      isRevoked,
      resourceDetails: [],
      errors,
      warnings,
      evaluationTime,
      securityDisclosure: HONEST_VERIFICATION_SECURITY_DISCLOSURE,
    };
  }

  // Check 4: Canonicalization and Hashing
  try {
    canonicalJson = canonicalizeManifest(validatedManifest);
    manifestHash = hashManifest(canonicalJson);
  } catch (err: unknown) {
    errors.push({
      code: "CANONICALIZATION_FAILED",
      message: `Failed to canonicalize manifest: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      state: "INDETERMINATE",
      isValid: false,
      manifestHash,
      canonicalJson,
      recoveredSigner,
      isSignerAuthorized: false,
      isSignatureValid: false,
      isExpired: false,
      isRevoked,
      resourceDetails: [],
      errors,
      warnings,
      evaluationTime,
      securityDisclosure: HONEST_VERIFICATION_SECURITY_DISCLOSURE,
    };
  }

  // Check 5: Release Sequence & Replay Protection against previousRelease
  let hasSequenceRollback = false;
  let hasBrokenContinuity = false;

  if (input.previousRelease) {
    // Check replay of identical release
    if (manifestHash.toLowerCase() === input.previousRelease.manifestHash.toLowerCase()) {
      warnings.push(
        `Identical release re-evaluated: manifestHash matches previous release (${manifestHash})`
      );
    }

    // Check sequence rollback (createdAt or explicit sequence)
    if (
      input.previousRelease.sequence !== undefined &&
      validatedManifest.sequence !== undefined &&
      validatedManifest.sequence <= input.previousRelease.sequence
    ) {
      hasSequenceRollback = true;
      errors.push({
        code: "RELEASE_SEQUENCE_ROLLBACK",
        message: `Release sequence rollback detected: manifest sequence (${validatedManifest.sequence}) is not strictly greater than previous release (${input.previousRelease.sequence})`,
        details: {
          manifestSequence: validatedManifest.sequence,
          previousReleaseSequence: input.previousRelease.sequence,
        },
      });
    } else if (
      input.previousRelease.createdAt !== undefined &&
      validatedManifest.createdAt < input.previousRelease.createdAt
    ) {
      hasSequenceRollback = true;
      errors.push({
        code: "RELEASE_SEQUENCE_ROLLBACK",
        message: `Release sequence rollback detected: manifest createdAt (${validatedManifest.createdAt}) is older than previous release (${input.previousRelease.createdAt})`,
        details: {
          manifestCreatedAt: validatedManifest.createdAt,
          previousReleaseCreatedAt: input.previousRelease.createdAt,
        },
      });
    }

    // Check previous manifest hash continuity
    if (validatedManifest.previousManifestHash !== undefined) {
      if (
        validatedManifest.previousManifestHash.toLowerCase() !==
        input.previousRelease.manifestHash.toLowerCase()
      ) {
        hasBrokenContinuity = true;
        errors.push({
          code: "INVALID_PREVIOUS_MANIFEST_HASH",
          message: `Release continuity broken: manifest previousManifestHash (${validatedManifest.previousManifestHash}) does not match previous release hash (${input.previousRelease.manifestHash})`,
          details: {
            declaredPreviousHash: validatedManifest.previousManifestHash,
            expectedPreviousHash: input.previousRelease.manifestHash,
          },
        });
      }
    }
  }

  // Check 6: Temporal Expiration against evaluationTime
  if (validatedManifest.expiresAt > 0 && evaluationTime > validatedManifest.expiresAt) {
    isExpired = true;
    errors.push({
      code: "RELEASE_EXPIRED",
      message: `Release expired at ${validatedManifest.expiresAt} (evaluation time: ${evaluationTime})`,
      details: {
        expiresAt: validatedManifest.expiresAt,
        evaluationTime,
      },
    });
  }

  // Check 7: EAS Attestation UID validation (if supplied)
  if (input.attestationUid != null) {
    if (input.attestationUid.toLowerCase() === ZERO_BYTES32) {
      errors.push({
        code: "INVALID_HASH_FORMAT",
        message: "EAS Attestation UID is zero: attestation does not exist on-chain",
      });
    }
  }

  // Check 8: EIP-712 Signature Recovery
  try {
    recoveredSigner = await recoverReleaseSigner({
      domain: validatedManifest.domain,
      version: validatedManifest.version,
      sequence: validatedManifest.sequence,
      previousManifestHash: validatedManifest.previousManifestHash,
      manifestHash,
      timestamp: BigInt(validatedManifest.createdAt),
      expiresAt: BigInt(validatedManifest.expiresAt),
      signature: input.signature,
      chainId,
      verifyingContract,
    });
    isSignatureValid = true;
  } catch (err: unknown) {
    isSignatureValid = false;
    errors.push({
      code: "INVALID_EIP712_SIGNATURE",
      message: `EIP-712 signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Check 9: Signer Authorization
  if (isSignatureValid) {
    const isPrimaryPublisher = isAddressEqual(
      recoveredSigner,
      expectedPublisherNormalized
    );

    const isAuthorizedDelegate =
      input.authorizedSigningKeys &&
      input.authorizedSigningKeys.some((k) =>
        isAddressEqual(getAddress(k), recoveredSigner)
      );

    isSignerAuthorized = Boolean(isPrimaryPublisher || isAuthorizedDelegate);

    if (!isSignerAuthorized) {
      errors.push({
        code: "SIGNER_NOT_AUTHORIZED",
        message: `Signer ${recoveredSigner} is not authorized for domain "${validatedManifest.domain}"`,
        details: {
          recoveredSigner,
          expectedPublisher: expectedPublisherNormalized,
          authorizedSigningKeys: input.authorizedSigningKeys,
        },
      });
    }
  }

  // Check 10: Resource Matching and Integrity Evaluation
  let hasTamperedResource = false;
  let hasUnexpectedResource = false;
  let hasMissingResource = false;
  let hasFailedRetrieval = false;
  let matchCount = 0;

  const manifestResourceMap = new Map<string, ReleaseResource>();
  for (const res of validatedManifest.resources) {
    manifestResourceMap.set(res.path, res);
  }
  const declaredCount = manifestResourceMap.size;

  const observedResourceMap = new Map<string, ObservedEntry>();

  if (input.observedResources && input.observedResources.length > 0) {
    for (const obs of input.observedResources) {
      if (!obs || typeof obs !== "object" || typeof obs.path !== "string") {
        errors.push({
          code: "INVALID_RESOURCE_PATH",
          message: "Observed resource entry must be an object with a string path",
        });
        hasFailedRetrieval = true;
        continue;
      }

      // Check if retrieval explicitly failed
      if (obs.retrievalFailed) {
        hasFailedRetrieval = true;
        observedResourceMap.set(obs.path, {
          hash: null,
          size: 0,
          retrievalFailed: true,
          retrievalError: obs.retrievalError ?? "Out-of-band resource retrieval failed",
        });
        errors.push({
          code: "RESOURCE_RETRIEVAL_FAILED",
          message: `Resource retrieval failed for "${obs.path}": ${obs.retrievalError ?? "Network/HTTP error"}`,
          details: { path: obs.path, error: obs.retrievalError },
        });
        continue;
      }

      // Compute or format hash
      let computedHash: string;
      let size = 0;

      try {
        if (obs.bytes !== undefined) {
          computedHash = hashAndFormatResource(obs.bytes);
          if (typeof obs.bytes === "string") {
            size = Buffer.byteLength(obs.bytes, "utf8");
          } else if (obs.bytes instanceof Uint8Array) {
            size = obs.bytes.byteLength;
          } else if (obs.bytes instanceof ArrayBuffer) {
            size = obs.bytes.byteLength;
          }
        } else if (obs.hash !== undefined) {
          computedHash = formatResourceHash(obs.hash);
        } else {
          // Missing bytes and missing hash -> retrieval failure
          hasFailedRetrieval = true;
          observedResourceMap.set(obs.path, {
            hash: null,
            size: 0,
            retrievalFailed: true,
            retrievalError: "Observed resource contains neither bytes nor digest",
          });
          errors.push({
            code: "RESOURCE_RETRIEVAL_FAILED",
            message: `Observed resource at "${obs.path}" contains neither bytes nor hash`,
            details: { path: obs.path },
          });
          continue;
        }
      } catch (err: unknown) {
        errors.push({
          code: "INVALID_HASH_FORMAT",
          message: `Failed to format/compute hash for "${obs.path}": ${err instanceof Error ? err.message : String(err)}`,
        });
        hasFailedRetrieval = true;
        continue;
      }

      // Check for duplicate observations for the same path
      const existing = observedResourceMap.get(obs.path);
      if (existing) {
        if (existing.hash && existing.hash.toLowerCase() !== computedHash.toLowerCase()) {
          // Conflicting digests observed for same path! Critical tampering/split-view indicator!
          hasTamperedResource = true;
          errors.push({
            code: "RESOURCE_HASH_MISMATCH",
            message: `Conflicting digest observations detected for "${obs.path}": observed ${existing.hash} and ${computedHash}`,
            details: { path: obs.path, firstHash: existing.hash, secondHash: computedHash },
          });
        } else {
          warnings.push(`Duplicate observation for "${obs.path}" with identical digest`);
        }
      } else {
        observedResourceMap.set(obs.path, {
          hash: computedHash,
          size,
          retrievalFailed: false,
        });
      }
    }
  }

  // A. Check each declared resource in manifest against observations
  for (const [path, declared] of manifestResourceMap.entries()) {
    const observed = observedResourceMap.get(path);
    if (!observed) {
      hasMissingResource = true;
      resourceDetails.push({
        path,
        expectedHash: declared.sha256,
        observedHash: null,
        status: "MISSING",
        size: declared.size,
      });
      errors.push({
        code: "MISSING_RESOURCE_DETECTED",
        message: `Declared manifest resource was not observed in runtime environment: "${path}"`,
        details: { path, expectedHash: declared.sha256 },
      });
    } else if (observed.retrievalFailed) {
      hasFailedRetrieval = true;
      resourceDetails.push({
        path,
        expectedHash: declared.sha256,
        observedHash: null,
        status: "FAILED",
        size: declared.size,
      });
    } else if (observed.hash) {
      if (observed.hash.toLowerCase() === declared.sha256.toLowerCase()) {
        matchCount++;
        resourceDetails.push({
          path,
          expectedHash: declared.sha256,
          observedHash: observed.hash,
          status: "MATCH",
          size: observed.size || declared.size,
        });
      } else {
        hasTamperedResource = true;
        resourceDetails.push({
          path,
          expectedHash: declared.sha256,
          observedHash: observed.hash,
          status: "MISMATCH",
          size: observed.size || declared.size,
        });
        errors.push({
          code: "RESOURCE_HASH_MISMATCH",
          message: `Integrity check failed for script "${path}": expected ${declared.sha256}, got ${observed.hash}`,
          details: {
            path,
            expectedHash: declared.sha256,
            observedHash: observed.hash,
          },
        });
      }
    }
  }

  // B. Check for unexpected external scripts loaded into the DOM
  for (const [path, observed] of observedResourceMap.entries()) {
    if (!manifestResourceMap.has(path)) {
      hasUnexpectedResource = true;
      resourceDetails.push({
        path,
        expectedHash: "NONE_DECLARED",
        observedHash: observed.hash,
        status: "UNEXPECTED",
        size: observed.size,
      });
      errors.push({
        code: "UNEXPECTED_RESOURCE_DETECTED",
        message: `Undeclared external script detected in DOM: "${path}" (${observed.hash ?? "failed"})`,
        details: { path, observedHash: observed.hash },
      });
    }
  }

  // Determine Final Verification State
  let state: VerificationState;

  if (hasTamperedResource || hasUnexpectedResource) {
    // Rule 6 & 7: Any observed integrity mismatch or unexpected resource MUST produce UNVERIFIED_RESOURCE_DETECTED
    state = "UNVERIFIED_RESOURCE_DETECTED";
  } else if (isRevoked) {
    state = "REVOKED_RELEASE";
  } else if (hasSequenceRollback || hasBrokenContinuity) {
    state = "UNATTESTED_RELEASE";
  } else if (!isSignerAuthorized) {
    state = "UNREGISTERED_PUBLISHER";
  } else if (!isSignatureValid || isExpired) {
    state = "UNATTESTED_RELEASE";
  } else if (
    hasMissingResource ||
    hasFailedRetrieval ||
    !input.observedResources ||
    input.observedResources.length === 0 ||
    matchCount < declaredCount
  ) {
    // Rule 4 & 5: Missing observations or failed retrieval MUST produce INDETERMINATE!
    state = "INDETERMINATE";
  } else {
    // Rule 8: VERIFIED_RELEASE_MATCH is permitted ONLY when all required checks have completed successfully
    state = "VERIFIED_RELEASE_MATCH";
  }

  const isValid = state === "VERIFIED_RELEASE_MATCH";

  return {
    state,
    isValid,
    manifestHash,
    canonicalJson,
    recoveredSigner,
    isSignerAuthorized,
    isSignatureValid,
    isExpired,
    isRevoked,
    resourceDetails,
    errors,
    warnings,
    evaluationTime,
    securityDisclosure: HONEST_VERIFICATION_SECURITY_DISCLOSURE,
  };
}

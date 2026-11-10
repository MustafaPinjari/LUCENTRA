/**
 * @file verifier.ts
 * @package @lucentra/core
 * @description Comprehensive release verification pipeline evaluating the 6 formal protocol states.
 */

import { getAddress, isAddressEqual } from "viem";
import { canonicalizeManifest } from "./canonical.js";
import { LucentraError, isLucentraError } from "./errors.js";
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

export const HONEST_VERIFICATION_SECURITY_DISCLOSURE =
  "Verification reflects cryptographic cross-referencing between out-of-band retrieved resource hashes and publisher-attested manifests. The Chrome Extension operates within the browser extension sandbox and does not verify exact in-memory JIT bytes executed inside the V8 engine." as const;

/**
 * Executes full end-to-end cryptographic and structural verification of a release.
 *
 * Evaluates the 6 formal protocol states:
 * - VERIFIED_RELEASE_MATCH
 * - UNVERIFIED_RESOURCE_DETECTED
 * - UNREGISTERED_PUBLISHER
 * - UNATTESTED_RELEASE
 * - REVOKED_RELEASE
 * - INDETERMINATE
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
  let manifestHash: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
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

  // Check 5: Temporal Expiration against evaluationTime
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

  // Check 6: EIP-712 Signature Recovery
  try {
    recoveredSigner = await recoverReleaseSigner({
      domain: validatedManifest.domain,
      version: validatedManifest.version,
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

  // Check 7: Signer Authorization
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

  // Check 8: Resource Matching and Integrity Evaluation
  let hasTamperedResource = false;
  let hasUnexpectedResource = false;

  const manifestResourceMap = new Map<string, ReleaseResource>();
  for (const res of validatedManifest.resources) {
    manifestResourceMap.set(res.path, res);
  }

  const observedResourceMap = new Map<string, { hash: string; size: number }>();
  if (input.observedResources && input.observedResources.length > 0) {
    for (const obs of input.observedResources) {
      let computedHash: string;
      let size = 0;

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
        throw new LucentraError(
          "INVALID_HASH_FORMAT",
          `Observed resource at "${obs.path}" must supply either bytes or hash`
        );
      }

      observedResourceMap.set(obs.path, { hash: computedHash, size });
    }
  }

  // A. Check each declared resource against observed
  for (const [path, declared] of manifestResourceMap.entries()) {
    const observed = observedResourceMap.get(path);
    if (!observed) {
      resourceDetails.push({
        path,
        expectedHash: declared.sha256,
        observedHash: null,
        status: "MISSING",
        size: declared.size,
      });
    } else {
      if (observed.hash.toLowerCase() === declared.sha256.toLowerCase()) {
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
        message: `Undeclared external script detected in DOM: "${path}" (${observed.hash})`,
        details: { path, observedHash: observed.hash },
      });
    }
  }

  // Determine Final Verification State
  let state: VerificationState;

  if (hasTamperedResource || hasUnexpectedResource) {
    state = "UNVERIFIED_RESOURCE_DETECTED";
  } else if (isRevoked) {
    state = "REVOKED_RELEASE";
  } else if (!isSignerAuthorized) {
    state = "UNREGISTERED_PUBLISHER";
  } else if (!isSignatureValid || isExpired) {
    state = "UNATTESTED_RELEASE";
  } else {
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

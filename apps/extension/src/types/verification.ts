/**
 * @file types/verification.ts
 * @package @lucentra/extension
 * @description Types representing verification results, status progression, and badge display.
 */

import type {
  VerificationState,
  ResourceVerificationDetail,
  ReleaseManifest,
  Address,
  Hex,
} from "@lucentra/core";

export type { VerificationState, ResourceVerificationDetail };

export type VerificationStage =
  | "IDLE"
  | "DISCOVERING_RESOURCES"
  | "QUERYING_BACKEND"
  | "FETCHING_AND_HASHING"
  | "VERIFYING_CRYPTO"
  | "CHECKING_ATTESTATION"
  | "COMPLETE"
  | "ERROR";

export interface TabVerificationState {
  tabId: number;
  url: string;
  domain: string;
  stage: VerificationStage;
  verificationState: VerificationState;
  isRegisteredPublisher: boolean;
  publisherAddress?: Address;
  releaseVersion?: string;
  releaseDigest?: Hex;
  attestationUid?: Hex;
  isAttestedOnChain?: boolean;
  isRevokedOnChain?: boolean;
  signerRecoveredAddress?: Address;
  details: readonly ResourceVerificationDetail[];
  observedResources: Array<{
    path: string;
    url: string;
    digest: string;
    byteLength: number;
  }>;
  unobservedManifestPaths: string[];
  unverifiedObservedPaths: string[];
  hasInlineScripts: boolean;
  inlineScriptCount: number;
  manifest?: ReleaseManifest;
  summary: string;
  evaluatedAt: number;
  errorMessage?: string;
}

export interface BadgeInfo {
  text: string;
  color: string;
  title: string;
}

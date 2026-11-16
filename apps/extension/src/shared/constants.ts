/**
 * @file shared/constants.ts
 * @package @lucentra/extension
 * @description System-wide constants, honest disclosures, and UI status metadata.
 */

import { HONEST_VERIFICATION_SECURITY_DISCLOSURE } from "@lucentra/core";
import type { VerificationState } from "@lucentra/core";
import type { BadgeInfo } from "../types/verification.js";

export { HONEST_VERIFICATION_SECURITY_DISCLOSURE };

export const EXTENSION_NAME = "LUCENTRA";
export const EXTENSION_TAGLINE = "Trust, made verifiable.";

export const STORAGE_KEYS = {
  CONFIG: "lucentra_config",
  TAB_CACHE_PREFIX: "lucentra_tab_",
  LAST_SEEN_DOMAIN: "lucentra_last_domain",
} as const;

export const BADGE_CONFIG: Record<VerificationState, BadgeInfo> = {
  VERIFIED_RELEASE_MATCH: {
    text: "✓",
    color: "#10B981", // Emerald green
    title: "LUCENTRA: Cryptographically Verified Release",
  },
  UNVERIFIED_RESOURCE_DETECTED: {
    text: "!",
    color: "#EF4444", // Bright red
    title: "LUCENTRA: Unverified Resource Detected",
  },
  INDETERMINATE: {
    text: "?",
    color: "#F59E0B", // Amber yellow
    title: "LUCENTRA: Indeterminate Verification State",
  },
  REVOKED_RELEASE: {
    text: "✕",
    color: "#DC2626", // Crimson red
    title: "LUCENTRA: Revoked Release",
  },
  UNREGISTERED_PUBLISHER: {
    text: "○",
    color: "#6B7280", // Slate gray
    title: "LUCENTRA: Unregistered Domain",
  },
  UNATTESTED_RELEASE: {
    text: "△",
    color: "#D97706", // Dark amber
    title: "LUCENTRA: Unattested Release",
  },
};

export const STATUS_DESCRIPTIONS: Record<VerificationState, { label: string; explanation: string }> = {
  VERIFIED_RELEASE_MATCH: {
    label: "Cryptographically Verified Release",
    explanation:
      "All observed JavaScript resources match the cryptographically signed release manifest, the publisher domain ownership is registered, the signature is valid, and an on-chain EAS attestation is confirmed.",
  },
  UNVERIFIED_RESOURCE_DETECTED: {
    label: "Unverified Resource Detected",
    explanation:
      "One or more JavaScript resources loaded on this page do not match the expected cryptographic digest in the declared release manifest, or were not declared in the manifest.",
  },
  INDETERMINATE: {
    label: "Indeterminate Verification State",
    explanation:
      "Verification could not be conclusively completed. This occurs when only a subset of declared manifest resources were observed (partial observation invariant), network timeouts occurred, or resources could not be retrieved out-of-band.",
  },
  REVOKED_RELEASE: {
    label: "Revoked Release",
    explanation:
      "The cryptographic attestation for this release has been explicitly revoked on the Ethereum Attestation Service registry.",
  },
  UNREGISTERED_PUBLISHER: {
    label: "Unregistered Domain",
    explanation:
      "This domain has not registered a verified publisher identity or published cryptographic releases on the LUCENTRA protocol.",
  },
  UNATTESTED_RELEASE: {
    label: "Unattested Release",
    explanation:
      "The publisher signature is valid, but no matching on-chain EAS attestation was found for this release manifest digest.",
  },
};

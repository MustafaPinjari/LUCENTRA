/**
 * @file services/verifier-engine.ts
 * @package @lucentra/extension
 * @description Comprehensive verification coordinator integrating DOM observations, backend state, and @lucentra/core.
 */

import {
  verifyRelease,
  type Address,
  type Hex,
  type ObservedResource,
  DEFAULT_VERIFYING_CONTRACT,
} from "@lucentra/core";
import type { DiscoveredScript } from "../types/resources.js";
import type { TabVerificationState, VerificationStage } from "../types/verification.js";
import type { ExtensionConfig } from "../types/config.js";
import { STATUS_DESCRIPTIONS } from "../shared/constants.js";
import { extractDomainFromUrl } from "../utils/url.js";
import { LucentraApiClient, type BackendReleaseRecord } from "./api-client.js";
import { ResourceFetcher } from "./resource-fetcher.js";

export class VerifierEngine {
  public config: ExtensionConfig;
  private apiClient: LucentraApiClient;
  private resourceFetcher: ResourceFetcher;

  constructor(config: ExtensionConfig) {
    this.config = config;
    this.apiClient = new LucentraApiClient({
      baseUrl: config.backendApiUrl,
      timeoutMs: config.fetchTimeoutMs,
    });
    this.resourceFetcher = new ResourceFetcher({
      maxByteSize: config.maxResourceByteSize,
      timeoutMs: config.fetchTimeoutMs,
      allowLocalhost: config.allowLocalhost,
    });
  }

  public updateConfig(newConfig: ExtensionConfig): void {
    this.config = newConfig;
    this.apiClient = new LucentraApiClient({
      baseUrl: newConfig.backendApiUrl,
      timeoutMs: newConfig.fetchTimeoutMs,
    });
    this.resourceFetcher = new ResourceFetcher({
      maxByteSize: newConfig.maxResourceByteSize,
      timeoutMs: newConfig.fetchTimeoutMs,
      allowLocalhost: newConfig.allowLocalhost,
    });
  }

  /**
   * Executes the full 6-state verification workflow for an active tab.
   */
  public async verifyTab(
    tabId: number,
    url: string,
    discoveredScripts: DiscoveredScript[],
    onStageChange?: (stage: VerificationStage) => void
  ): Promise<TabVerificationState> {
    const domain = extractDomainFromUrl(url);

    // Initial check: is it a valid web URL with a domain?
    if (!domain) {
      return {
        tabId,
        url,
        domain: "",
        stage: "COMPLETE",
        verificationState: "INDETERMINATE",
        isRegisteredPublisher: false,
        details: [],
        observedResources: [],
        unobservedManifestPaths: [],
        unverifiedObservedPaths: [],
        summary: "Verification not applicable: URL is not a standard web resource.",
        evaluatedAt: Date.now(),
      };
    }

    // Stage 1: Query backend for domain status
    onStageChange?.("QUERYING_BACKEND");
    let domainStatus;
    try {
      domainStatus = await this.apiClient.getDomainVerificationStatus(domain);
    } catch (err) {
      return {
        tabId,
        url,
        domain,
        stage: "ERROR",
        verificationState: "INDETERMINATE",
        isRegisteredPublisher: false,
        details: [],
        observedResources: [],
        unobservedManifestPaths: [],
        unverifiedObservedPaths: [],
        summary: `Backend connection failure: ${err instanceof Error ? err.message : String(err)}`,
        evaluatedAt: Date.now(),
        errorMessage: String(err),
      };
    }

    // Check if domain is registered on-chain
    if (!domainStatus || domainStatus.registration_status !== "REGISTERED_ONCHAIN") {
      return {
        tabId,
        url,
        domain,
        stage: "COMPLETE",
        verificationState: "UNREGISTERED_PUBLISHER",
        isRegisteredPublisher: false,
        details: [],
        observedResources: [],
        unobservedManifestPaths: [],
        unverifiedObservedPaths: [],
        summary: STATUS_DESCRIPTIONS.UNREGISTERED_PUBLISHER.explanation,
        evaluatedAt: Date.now(),
      };
    }

    // Fetch latest release for domain
    let releases: BackendReleaseRecord[];
    try {
      releases = await this.apiClient.getDomainReleases(domain);
    } catch {
      releases = [];
    }

    if (!releases || releases.length === 0) {
      return {
        tabId,
        url,
        domain,
        stage: "COMPLETE",
        verificationState: "UNATTESTED_RELEASE",
        isRegisteredPublisher: true,
        publisherAddress: domainStatus.publisher_wallet,
        details: [],
        observedResources: [],
        unobservedManifestPaths: [],
        unverifiedObservedPaths: [],
        summary: "Domain is registered, but no release manifests have been published or attested.",
        evaluatedAt: Date.now(),
      };
    }

    // Select latest release (highest sequence)
    const latestRelease = releases.sort((a, b) => b.sequence - a.sequence)[0];

    // Stage 2: Fetch and hash discovered resources out-of-band
    onStageChange?.("FETCHING_AND_HASHING");
    const externalScripts = discoveredScripts.filter((s) => !s.isInline);
    const digests = await this.resourceFetcher.fetchAll(externalScripts);

    const observedResources: ObservedResource[] = digests.map((d) => ({
      path: d.path,
      hash: d.status === "FETCHED" ? d.digest : undefined,
      retrievalFailed: d.status !== "FETCHED",
      retrievalError: d.errorMessage,
    }));

    // Stage 3: Check EAS Attestation status
    onStageChange?.("CHECKING_ATTESTATION");
    let isRevoked = false;
    let isAttested = false;

    if (latestRelease.attestation_uid) {
      isAttested = true;
      try {
        const attestation = await this.apiClient.getAttestation(latestRelease.attestation_uid);
        if (attestation && attestation.revoked) {
          isRevoked = true;
        }
      } catch {
        // If attestation query fails, don't assume revoked
      }
    }

    // Stage 4: Run @lucentra/core Cryptographic & Protocol Verification
    onStageChange?.("VERIFYING_CRYPTO");

    const publisherAddr = (domainStatus.publisher_wallet ||
      domainStatus.onchain_info?.publisherAddress ||
      "0x0000000000000000000000000000000000000000") as Address;

    const authorizedSigningKeys =
      domainStatus.onchain_info?.activeSigningKeys &&
      domainStatus.onchain_info.activeSigningKeys.length > 0
        ? (domainStatus.onchain_info.activeSigningKeys as Address[])
        : latestRelease.signing_key
          ? [latestRelease.signing_key as Address]
          : [publisherAddr];

    const coreResult = await verifyRelease({
      manifest: latestRelease.manifest_json,
      signature: latestRelease.signature as Hex,
      expectedPublisher: publisherAddr,
      authorizedSigningKeys,
      observedResources,
      chainId: domainStatus.chain_id ?? 31337,
      verifyingContract: DEFAULT_VERIFYING_CONTRACT,
      attestationUid: latestRelease.attestation_uid as Hex | undefined,
      isRevoked,
    });

    // Derive unobserved manifest paths and unverified observed paths
    const unobservedManifestPaths = coreResult.resourceDetails
      .filter((d) => d.status === "MISSING" || d.status === "FAILED")
      .map((d) => d.path);

    const unverifiedObservedPaths = coreResult.resourceDetails
      .filter((d) => d.status === "MISMATCH" || d.status === "UNEXPECTED")
      .map((d) => d.path);

    onStageChange?.("COMPLETE");

    return {
      tabId,
      url,
      domain,
      stage: "COMPLETE",
      verificationState: coreResult.state,
      isRegisteredPublisher: true,
      publisherAddress: publisherAddr,
      releaseVersion: latestRelease.version,
      releaseDigest: coreResult.manifestHash,
      attestationUid: latestRelease.attestation_uid as Hex | undefined,
      isAttestedOnChain: isAttested,
      isRevokedOnChain: isRevoked,
      signerRecoveredAddress: coreResult.recoveredSigner,
      details: coreResult.resourceDetails,
      observedResources: digests
        .filter((d) => d.status === "FETCHED")
        .map((d) => ({
          path: d.path,
          url: d.url,
          digest: d.digest,
          byteLength: d.byteLength,
        })),
      unobservedManifestPaths,
      unverifiedObservedPaths,
      manifest: latestRelease.manifest_json,
      summary:
        coreResult.errors.length > 0
          ? coreResult.errors[0].message
          : STATUS_DESCRIPTIONS[coreResult.state].explanation,
      evaluatedAt: Date.now(),
    };
  }
}

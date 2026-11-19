/**
 * @file services/api-client.ts
 * @package @lucentra/extension
 * @description Typed HTTP client for the LUCENTRA Django REST Framework backend.
 */

import type { ReleaseManifest, Address, Hex } from "@lucentra/core";

export interface DomainVerificationStatusResponse {
  domain: string;
  registration_status: string;
  publisher_wallet?: Address;
  chain_id?: number;
  onchain_registration_transaction?: Hex;
  onchain_info?: {
    isRegistered?: boolean;
    publisherAddress?: Address;
    activeSigningKeys?: Address[];
    verifyingContract?: string;
  };
  contracts?: {
    SignatureVerifier?: string;
    PublisherRegistry?: string;
    ReleaseAttestationVerifier?: string;
  };
  verifying_contract?: string;
  latest_release?: {
    sequence?: number;
    version?: string;
    manifestHash?: Hex;
    attestationUid?: Hex;
  };
  last_verified_at?: string;
}

export interface BackendReleaseRecord {
  id: number;
  domain: string;
  sequence: number;
  version: string;
  manifest_hash: Hex;
  previous_manifest_hash: Hex;
  signing_key: string;
  timestamp: number;
  expires_at: number;
  signature: Hex;
  manifest_json: ReleaseManifest;
  attestation_uid?: Hex;
  transaction_hash?: Hex;
  status: string;
  created_at: string;
}

export interface BackendAttestationRecord {
  uid: Hex;
  schema_uid: Hex;
  attester_address: Address;
  recipient_address: Address;
  revocation_time: number;
  revoked: boolean;
  transaction_hash: Hex;
}

export interface SecurityExplanationResponse {
  headline: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  detailed_explanation: string;
  technical_discrepancy_summary: string;
  recommended_action: string;
  evidence_references: string[];
  limitations: string;
  model_id: string;
  generated_at: string;
  deterministic_state: string;
}

export interface BackendApiOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export class LucentraApiClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: BackendApiOptions) {
    // Strip trailing slashes
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        credentials: "omit",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const body = await res.json();
          if (body?.error?.message) {
            errMessage = body.error.message;
          } else if (body?.detail) {
            errMessage = body.detail;
          }
        } catch {
          // Keep generic HTTP error
        }
        const error = new Error(errMessage);
        (error as { status?: number }).status = res.status;
        throw error;
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  public async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/api/v1/health/");
  }

  public async getReadiness(): Promise<{ status: string; checks?: Record<string, unknown> }> {
    return this.request<{ status: string; checks?: Record<string, unknown> }>("/api/v1/readiness/");
  }

  public async getDomainVerificationStatus(
    domain: string
  ): Promise<DomainVerificationStatusResponse | null> {
    try {
      return await this.request<DomainVerificationStatusResponse>(
        `/api/v1/domains/${encodeURIComponent(domain)}/verification-status/`
      );
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  public async getDomainReleases(domain: string): Promise<BackendReleaseRecord[]> {
    try {
      return await this.request<BackendReleaseRecord[]>(
        `/api/v1/domains/${encodeURIComponent(domain)}/releases/`
      );
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 404) {
        return [];
      }
      throw err;
    }
  }

  public async getAttestation(uid: string): Promise<BackendAttestationRecord | null> {
    try {
      return await this.request<BackendAttestationRecord>(
        `/api/v1/attestations/${encodeURIComponent(uid)}/`
      );
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  public async verifyReleaseViaBackend(payload: {
    manifest: ReleaseManifest;
    signature: Hex;
    observed_resources?: Record<string, string>;
    attestation_uid?: Hex;
  }): Promise<unknown> {
    return this.request<unknown>("/api/v1/releases/verify/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  public async getAiExplanation(payload: {
    domain: string;
    verification_state?: string;
    publisher_registered?: boolean;
    publisher_address?: string;
    release_version?: string;
    sequence?: number;
    manifest_digest?: string;
    attestation_uid?: string;
    is_attested?: boolean;
    is_revoked?: boolean;
    resource_discrepancies?: Array<{
      path: string;
      status: string;
      expected_hash?: string | null;
      observed_hash?: string | null;
    }>;
    inline_script_count?: number;
    has_inline_scripts?: boolean;
    observation_completeness?: string;
  }): Promise<SecurityExplanationResponse> {
    return this.request<SecurityExplanationResponse>("/api/v1/ai/explanations/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

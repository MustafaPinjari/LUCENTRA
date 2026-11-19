/**
 * @file lib/api.ts
 * @package @lucentra/dashboard
 * @description Typed HTTP client for the LUCENTRA Django REST Framework backend.
 */

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface DomainRecord {
  id: number;
  canonical_domain: string;
  registration_status: "PENDING_DNS" | "DNS_VERIFIED" | "REGISTERED_ONCHAIN" | "SUSPENDED" | "EXPIRED";
  publisher: {
    wallet_address: string;
    display_name?: string;
  };
  chain_id: number;
  onchain_registration_transaction?: string;
  created_at: string;
  registered_at?: string;
  last_verified_at?: string;
}

export interface DNSChallengeRecord {
  id: number;
  domain: string;
  challenge_value: string;
  nonce: string;
  record_name: string;
  record_value: string;
  expires_at: string;
  created_at: string;
}

export interface SigningKeyRecord {
  id: number;
  domain: string;
  public_address: string;
  status: "ACTIVE" | "REVOKED";
  authorized_at: string;
  revoked_at?: string;
}

export interface ReleaseRecord {
  id: number;
  domain: string;
  version: string;
  sequence: number;
  manifest_hash: string;
  previous_manifest_hash: string;
  signing_key: string;
  timestamp: number;
  expires_at: number;
  signature: string;
  manifest_json: any;
  attestation_uid?: string;
  transaction_hash?: string;
  status: "SUBMITTED" | "ATTESTED" | "VERIFIED" | "REVOKED" | "FAILED";
  created_at: string;
}

export interface AIExplanationResult {
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

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string = "api_error", status: number = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_LUCENTRA_API_URL || "http://127.0.0.1:8000";

export class LucentraApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}: ${res.statusText}`;
        let errCode = "http_error";
        let errDetails: unknown = undefined;

        try {
          const body = await res.json();
          if (body?.error) {
            errMessage = body.error.message || errMessage;
            errCode = body.error.code || errCode;
            errDetails = body.error.details;
          } else if (body?.detail) {
            errMessage = body.detail;
          }
        } catch {
          // ignore json parse error
        }

        throw new ApiError(errMessage, errCode, res.status, errDetails);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err instanceof ApiError) {
        throw err;
      }
      if (err?.name === "AbortError") {
        throw new ApiError("Backend API request timed out (12s).", "timeout", 504);
      }
      throw new ApiError(err?.message || "Network request failed.", "network_error", 0);
    }
  }

  // Health and Readiness
  async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/api/v1/health/");
  }

  async getReadiness(): Promise<{ status: string; checks?: Record<string, unknown> }> {
    return this.request<{ status: string; checks?: Record<string, unknown> }>("/api/v1/readiness/");
  }

  // Publishers
  async getPublisherNonce(walletAddress: string): Promise<{ publisher: string; nonce: number }> {
    return this.request<{ publisher: string; nonce: number }>(
      `/api/v1/publishers/${encodeURIComponent(walletAddress.toLowerCase())}/nonce/`
    );
  }

  // Domains
  async listDomains(): Promise<DomainRecord[]> {
    const res = await this.request<any>("/api/v1/domains/");
    return Array.isArray(res) ? res : res?.results || [];
  }

  async getDomain(domain: string): Promise<DomainRecord> {
    return this.request<DomainRecord>(`/api/v1/domains/${encodeURIComponent(domain)}/`);
  }

  async createDnsChallenge(domain: string, publisherWallet: string): Promise<DNSChallengeRecord> {
    return this.request<DNSChallengeRecord>("/api/v1/domains/challenges/", {
      method: "POST",
      body: JSON.stringify({
        domain,
        publisher: publisherWallet.toLowerCase(),
      }),
    });
  }

  async verifyDns(domain: string, challengeId?: number): Promise<{
    domain: string;
    verified: boolean;
    record_name: string;
    expected_value: string;
    found_records: string[];
    registration_status: string;
  }> {
    return this.request<any>("/api/v1/domains/verify-dns/", {
      method: "POST",
      body: JSON.stringify({
        domain,
        challenge_id: challengeId,
      }),
    });
  }

  async registerDomain(payload: {
    domain: string;
    publisher: string;
    initial_signing_key: string;
    deadline: number;
    signature: string;
  }): Promise<{
    domain: string;
    status: string;
    transaction_hash: string;
    registered_at: string;
    initial_signing_key: string;
  }> {
    return this.request<any>("/api/v1/domains/register/", {
      method: "POST",
      body: JSON.stringify({
        domain: payload.domain,
        publisher: payload.publisher.toLowerCase(),
        initial_signing_key: payload.initial_signing_key.toLowerCase(),
        deadline: payload.deadline,
        signature: payload.signature,
      }),
    });
  }

  async listDomainKeys(domain: string): Promise<SigningKeyRecord[]> {
    return this.request<SigningKeyRecord[]>(`/api/v1/domains/${encodeURIComponent(domain)}/keys/`);
  }

  async listDomainReleases(domain: string): Promise<ReleaseRecord[]> {
    return this.request<ReleaseRecord[]>(`/api/v1/domains/${encodeURIComponent(domain)}/releases/`);
  }

  async getDomainVerificationStatus(domain: string): Promise<any> {
    return this.request<any>(`/api/v1/domains/${encodeURIComponent(domain)}/verification-status/`);
  }

  async reconcileDomain(domain: string, signingKey?: string): Promise<DomainRecord> {
    return this.request<DomainRecord>(`/api/v1/domains/${encodeURIComponent(domain)}/reconcile/`, {
      method: "POST",
      body: JSON.stringify(signingKey ? { signing_key: signingKey.toLowerCase() } : {}),
    });
  }

  // Releases
  async listReleases(): Promise<ReleaseRecord[]> {
    const res = await this.request<any>("/api/v1/releases/");
    return Array.isArray(res) ? res : res?.results || [];
  }

  async submitRelease(payload: {
    manifest: any;
    signature: string;
    signing_key?: string;
    observed_resources?: Record<string, string>;
  }): Promise<ReleaseRecord> {
    return this.request<ReleaseRecord>("/api/v1/releases/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async verifyRelease(payload: {
    manifest: any;
    signature: string;
    observed_resources?: Record<string, string>;
    attestation_uid?: string;
  }): Promise<any> {
    return this.request<any>("/api/v1/releases/verify/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // AI Explanation
  async getAiExplanation(payload: {
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
    force_refresh?: boolean;
  }): Promise<AIExplanationResult> {
    return this.request<AIExplanationResult>("/api/v1/ai/explanations/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getDomainAiExplanation(domain: string): Promise<AIExplanationResult> {
    return this.request<AIExplanationResult>(`/api/v1/ai/domains/${encodeURIComponent(domain)}/explain/`);
  }
}

export const api = new LucentraApiClient();


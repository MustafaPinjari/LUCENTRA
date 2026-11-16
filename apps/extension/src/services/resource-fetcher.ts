/**
 * @file services/resource-fetcher.ts
 * @package @lucentra/extension
 * @description Out-of-band resource fetcher with SSRF blocking, size limits, and Web Crypto hashing.
 */

import type { DiscoveredScript, ObservedResourceDigest } from "../types/resources.js";
import { isPrivateOrBlockedHost, isWebScheme } from "../utils/url.js";
import { computeResourceHash } from "../utils/crypto.js";

export interface ResourceFetcherOptions {
  maxByteSize?: number;
  timeoutMs?: number;
  allowLocalhost?: boolean;
}

export class ResourceFetcher {
  private maxByteSize: number;
  private timeoutMs: number;
  private allowLocalhost: boolean;

  constructor(options: ResourceFetcherOptions = {}) {
    this.maxByteSize = options.maxByteSize ?? 5 * 1024 * 1024; // 5 MiB
    this.timeoutMs = options.timeoutMs ?? 10000; // 10s
    this.allowLocalhost = options.allowLocalhost ?? true;
  }

  /**
   * Fetches an individual script resource out-of-band and computes its cryptographic digest.
   */
  public async fetchAndDigestResource(script: DiscoveredScript): Promise<ObservedResourceDigest> {
    const fetchedAt = Date.now();

    // Skip inline scripts
    if (script.isInline || script.normalizedUrl === "(inline)") {
      return {
        path: script.path,
        url: script.rawUrl,
        digest: "",
        byteLength: 0,
        fetchedAt,
        status: "BLOCKED",
        errorMessage: "Inline scripts cannot be verified out-of-band",
      };
    }

    // Validate scheme
    if (!isWebScheme(script.normalizedUrl)) {
      return {
        path: script.path,
        url: script.normalizedUrl,
        digest: "",
        byteLength: 0,
        fetchedAt,
        status: "BLOCKED",
        errorMessage: "Only HTTP and HTTPS URLs are permitted",
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(script.normalizedUrl);
    } catch {
      return {
        path: script.path,
        url: script.normalizedUrl,
        digest: "",
        byteLength: 0,
        fetchedAt,
        status: "BLOCKED",
        errorMessage: "Malformed URL",
      };
    }

    // SSRF Check
    if (isPrivateOrBlockedHost(parsedUrl.hostname, this.allowLocalhost)) {
      return {
        path: script.path,
        url: script.normalizedUrl,
        digest: "",
        byteLength: 0,
        fetchedAt,
        status: "BLOCKED",
        errorMessage: `Access to private or blocked host '${parsedUrl.hostname}' is prohibited`,
      };
    }

    // Out-of-band fetch with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(script.normalizedUrl, {
        method: "GET",
        headers: {
          Accept: "*/*",
          "X-Lucentra-Verification": "1",
        },
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return {
          path: script.path,
          url: script.normalizedUrl,
          digest: "",
          byteLength: 0,
          fetchedAt,
          status: "FETCH_ERROR",
          errorMessage: `HTTP ${response.status} ${response.statusText}`,
        };
      }

      // Check Content-Length header if present
      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader) {
        const declaredLength = parseInt(contentLengthHeader, 10);
        if (declaredLength > this.maxByteSize) {
          return {
            path: script.path,
            url: script.normalizedUrl,
            digest: "",
            byteLength: declaredLength,
            fetchedAt,
            status: "OVERSIZE",
            errorMessage: `Resource size (${declaredLength} bytes) exceeds maximum limit of ${this.maxByteSize} bytes`,
          };
        }
      }

      // Read raw arrayBuffer
      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength > this.maxByteSize) {
        return {
          path: script.path,
          url: script.normalizedUrl,
          digest: "",
          byteLength: arrayBuffer.byteLength,
          fetchedAt,
          status: "OVERSIZE",
          errorMessage: `Resource size (${arrayBuffer.byteLength} bytes) exceeds maximum limit of ${this.maxByteSize} bytes`,
        };
      }

      // Hash raw buffer bytes using Web Crypto API
      const digest = await computeResourceHash(new Uint8Array(arrayBuffer));

      return {
        path: script.path,
        url: script.normalizedUrl,
        digest,
        byteLength: arrayBuffer.byteLength,
        fetchedAt,
        status: "FETCHED",
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = (err as { name?: string })?.name === "AbortError";
      return {
        path: script.path,
        url: script.normalizedUrl,
        digest: "",
        byteLength: 0,
        fetchedAt,
        status: "FETCH_ERROR",
        errorMessage: isAbort
          ? `Fetch timed out after ${this.timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : "Unknown network error",
      };
    }
  }

  /**
   * Fetches multiple discovered scripts in parallel and returns their digests.
   */
  public async fetchAll(scripts: DiscoveredScript[]): Promise<ObservedResourceDigest[]> {
    return Promise.all(scripts.map((s) => this.fetchAndDigestResource(s)));
  }
}

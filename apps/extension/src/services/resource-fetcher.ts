/**
 * @file services/resource-fetcher.ts
 * @package @lucentra/extension
 * @description Out-of-band resource fetcher with fail-closed redirect SSRF defense, streaming size limits, and Web Crypto hashing.
 */

import type { DiscoveredScript, ObservedResourceDigest } from "../types/resources.js";
import {
  isPrivateOrBlockedHost,
  isWebScheme,
  hasEmbeddedCredentials,
} from "../utils/url.js";
import { computeResourceHash } from "../utils/crypto.js";

export interface ResourceFetcherOptions {
  maxByteSize?: number;
  timeoutMs?: number;
  allowLocalhost?: boolean;
}

export class ResourceFetcher {
  public maxByteSize: number;
  public timeoutMs: number;
  public allowLocalhost: boolean;

  constructor(options: ResourceFetcherOptions = {}) {
    this.maxByteSize = options.maxByteSize ?? 5 * 1024 * 1024; // 5 MiB
    this.timeoutMs = options.timeoutMs ?? 10000; // 10s
    this.allowLocalhost = options.allowLocalhost ?? true;
  }

  /**
   * Fetches an individual script resource out-of-band and computes its cryptographic digest.
   * Enforces fail-closed redirect policy (redirect: "error") and chunked streaming byte limits.
   */
  public async fetchAndDigestResource(script: DiscoveredScript): Promise<ObservedResourceDigest> {
    const fetchedAt = Date.now();

    // 1. Skip inline scripts
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

    // 2. Validate scheme (HTTP/HTTPS only)
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

    // 3. Prohibit embedded user credentials in URL
    if (hasEmbeddedCredentials(script.normalizedUrl)) {
      return {
        path: script.path,
        url: script.normalizedUrl,
        digest: "",
        byteLength: 0,
        fetchedAt,
        status: "BLOCKED",
        errorMessage: "Embedded credentials in resource URLs are prohibited",
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

    // 4. Initial Host SSRF Check
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

    // 5. Out-of-band fetch with timeout and fail-closed redirect policy
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
        redirect: "error", // FAIL-CLOSED: HTTP redirects are strictly rejected to prevent SSRF bypass
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Verify no redirect occurred
      if (response.redirected) {
        return {
          path: script.path,
          url: script.normalizedUrl,
          digest: "",
          byteLength: 0,
          fetchedAt,
          status: "BLOCKED",
          errorMessage: "HTTP redirects are not supported for resource verification (fail-closed SSRF prevention)",
        };
      }

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

      // Check Content-Length header upfront if present
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

      // Handle empty body
      if (!response.body) {
        const emptyBytes = new Uint8Array(0);
        const digest = await computeResourceHash(emptyBytes);
        return {
          path: script.path,
          url: script.normalizedUrl,
          digest,
          byteLength: 0,
          fetchedAt,
          status: "FETCHED",
        };
      }

      // Read chunked stream using reader to enforce size boundary while streaming
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > this.maxByteSize) {
              await reader.cancel("Resource size exceeded maximum limit");
              controller.abort();
              return {
                path: script.path,
                url: script.normalizedUrl,
                digest: "",
                byteLength: totalBytes,
                fetchedAt,
                status: "OVERSIZE",
                errorMessage: `Resource size exceeded maximum limit of ${this.maxByteSize} bytes`,
              };
            }
            chunks.push(value);
          }
        }
      } catch (streamErr: unknown) {
        const isAbort = (streamErr as { name?: string })?.name === "AbortError";
        if (isAbort && totalBytes > this.maxByteSize) {
          return {
            path: script.path,
            url: script.normalizedUrl,
            digest: "",
            byteLength: totalBytes,
            fetchedAt,
            status: "OVERSIZE",
            errorMessage: `Resource size exceeded maximum limit of ${this.maxByteSize} bytes`,
          };
        }
        throw streamErr;
      }

      // Concatenate raw chunks into continuous buffer
      const completeBuffer = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        completeBuffer.set(chunk, offset);
        offset += chunk.byteLength;
      }

      // Hash raw buffer bytes using Web Crypto API without textual decoding
      const digest = await computeResourceHash(completeBuffer);

      return {
        path: script.path,
        url: script.normalizedUrl,
        digest,
        byteLength: totalBytes,
        fetchedAt,
        status: "FETCHED",
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = (err as { name?: string })?.name === "AbortError";
      const errMsg = err instanceof Error ? err.message : String(err);

      // Detect fetch redirect rejection
      const isRedirectError =
        errMsg.toLowerCase().includes("redirect") ||
        errMsg.toLowerCase().includes("uri is redirected");

      if (isRedirectError) {
        return {
          path: script.path,
          url: script.normalizedUrl,
          digest: "",
          byteLength: 0,
          fetchedAt,
          status: "BLOCKED",
          errorMessage: "HTTP redirects are not supported for resource verification (fail-closed SSRF prevention)",
        };
      }

      return {
        path: script.path,
        url: script.normalizedUrl,
        digest: "",
        byteLength: 0,
        fetchedAt,
        status: "FETCH_ERROR",
        errorMessage: isAbort
          ? `Fetch timed out after ${this.timeoutMs}ms`
          : errMsg,
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

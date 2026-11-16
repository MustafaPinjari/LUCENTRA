/**
 * @file utils/url.ts
 * @package @lucentra/extension
 * @description Safe URL handling, domain normalization, resource path mapping, and SSRF prevention.
 */

import { normalizeDomain as coreNormalizeDomain } from "@lucentra/core";

export { coreNormalizeDomain as normalizeDomain };

/**
 * Checks whether a given URL has a standard web scheme (http or https).
 */
export function isWebScheme(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Extracts a normalized hostname from a URL string.
 */
export function extractDomainFromUrl(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return coreNormalizeDomain(parsed.hostname);
  } catch {
    return null;
  }
}

/**
 * Resolves a script source attribute (which might be relative, protocol-relative, or absolute)
 * against a document base URL. Returns the clean absolute URL and the resource path.
 */
export function resolveResourcePath(
  documentBaseUrl: string,
  scriptSrc: string
): { absoluteUrl: string; path: string; isValid: boolean } {
  try {
    const resolved = new URL(scriptSrc, documentBaseUrl);

    // Only allow http/https
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return { absoluteUrl: "", path: "", isValid: false };
    }

    // Path must start with /
    let path = resolved.pathname;
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    return {
      absoluteUrl: resolved.toString(),
      path,
      isValid: true,
    };
  } catch {
    return { absoluteUrl: "", path: "", isValid: false };
  }
}

/**
 * Validates whether a hostname or IP address is safe from SSRF / Private Network attacks.
 * Blocks:
 * - IPv4 Private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - IPv4 Loopback: 127.0.0.0/8
 * - IPv4 Link-Local / Cloud Metadata: 169.254.0.0/16 (e.g. 169.254.169.254)
 * - IPv6 Loopback: ::1
 * - IPv6 Link-Local: fe80::/10
 * - IPv6 Unique Local: fc00::/7
 * 
 * When allowLocalhost is true, allows 127.0.0.1, localhost, and ::1 for local development.
 */
export function isPrivateOrBlockedHost(hostname: string, allowLocalhost: boolean = false): boolean {
  const host = hostname.toLowerCase().trim();

  // Handle localhost alias
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return !allowLocalhost;
  }

  // Check Cloud Metadata specifically
  if (host === "169.254.169.254" || host.startsWith("169.254.")) {
    return true; // NEVER allowed under any circumstances
  }

  // IPv4 patterns
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);

    if (o1 === 10) return true; // 10.0.0.0/8
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16
    if (o1 === 127) return !allowLocalhost; // 127.0.0.0/8 loopback
    if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16 link-local
    if (o1 === 0) return true; // 0.0.0.0/8
  }

  // IPv6 patterns
  if (host.startsWith("[") && host.endsWith("]")) {
    const rawIpv6 = host.slice(1, -1);
    if (rawIpv6 === "::1") return !allowLocalhost;
    if (rawIpv6.startsWith("fe80:") || rawIpv6.startsWith("fe8") || rawIpv6.startsWith("fe9") || rawIpv6.startsWith("fea") || rawIpv6.startsWith("feb")) return true;
    if (rawIpv6.startsWith("fc00:") || rawIpv6.startsWith("fd")) return true;
  }

  return false;
}

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
 * Checks whether a URL contains embedded user credentials (e.g. http://user:pass@host).
 * Embedded credentials in script resources represent a high security risk and must be rejected.
 */
export function hasEmbeddedCredentials(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return Boolean(parsed.username || parsed.password);
  } catch {
    return true; // Fail closed on malformed URLs
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
): { absoluteUrl: string; path: string; isValid: boolean; errorMessage?: string } {
  try {
    const resolved = new URL(scriptSrc, documentBaseUrl);

    // Reject non-web schemes
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return {
        absoluteUrl: "",
        path: "",
        isValid: false,
        errorMessage: "Only HTTP and HTTPS protocols are permitted",
      };
    }

    // Reject embedded credentials
    if (resolved.username || resolved.password) {
      return {
        absoluteUrl: "",
        path: "",
        isValid: false,
        errorMessage: "Embedded credentials in resource URLs are prohibited",
      };
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
    return {
      absoluteUrl: "",
      path: "",
      isValid: false,
      errorMessage: "Malformed resource URL",
    };
  }
}

/**
 * Internal helper to validate a 4-octet IPv4 string against private, loopback, and metadata ranges.
 */
function isPrivateOrBlockedIpv4(
  o1: number,
  o2: number,
  o3: number,
  o4: number,
  allowLocalhost: boolean
): boolean {
  // Validate octet bounds (0-255)
  if (
    o1 < 0 || o1 > 255 ||
    o2 < 0 || o2 > 255 ||
    o3 < 0 || o3 > 255 ||
    o4 < 0 || o4 > 255
  ) {
    return true; // Malformed octet: fail closed
  }

  // Cloud Metadata (169.254.169.254 or link-local 169.254.0.0/16)
  if (o1 === 169 && o2 === 254) {
    return true; // Always blocked
  }

  // Loopback (127.0.0.0/8)
  if (o1 === 127) {
    return !allowLocalhost;
  }

  // Current network (0.0.0.0/8)
  if (o1 === 0) {
    return true;
  }

  // RFC 1918 Private IPv4 ranges
  if (o1 === 10) return true; // 10.0.0.0/8
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
  if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16

  // Carrier-grade NAT (100.64.0.0/10: 100.64.0.0 - 100.127.255.255)
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;

  // IETF Protocol Assignments & Benchmarking (198.18.0.0/15)
  if (o1 === 198 && (o2 === 18 || o2 === 19)) return true;

  // Multicast & Reserved (224.0.0.0/4 and 240.0.0.0/4)
  if (o1 >= 224) return true;

  return false;
}

/**
 * Validates whether a hostname or IP address is safe from SSRF / Private Network attacks.
 * Blocks:
 * - IPv4 Private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - IPv4 Loopback: 127.0.0.0/8
 * - IPv4 Link-Local / Cloud Metadata: 169.254.0.0/16 (e.g. 169.254.169.254)
 * - IPv4 Carrier-grade NAT: 100.64.0.0/10
 * - IPv6 Loopback: ::1
 * - IPv6 Link-Local: fe80::/10
 * - IPv6 Unique Local: fc00::/7, fd00::/8
 * - IPv4-Mapped IPv6: ::ffff:w.x.y.z and ::ffff:hex:hex
 *
 * When allowLocalhost is true, allows 127.0.0.1, localhost, and ::1 for local development.
 * Cloud metadata (169.254.169.254) is unconditionally blocked under all configurations.
 */
export function isPrivateOrBlockedHost(hostname: string, allowLocalhost: boolean = false): boolean {
  if (!hostname || typeof hostname !== "string") {
    return true; // Fail closed on empty/non-string
  }

  const host = hostname.toLowerCase().trim();

  // Handle localhost alias
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return !allowLocalhost;
  }

  // Check Cloud Metadata specifically
  if (host === "169.254.169.254" || host.startsWith("169.254.")) {
    return true; // NEVER allowed under any circumstances
  }

  // Standard IPv4 Dotted-Decimal Matching
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);
    const o3 = parseInt(ipv4Match[3], 10);
    const o4 = parseInt(ipv4Match[4], 10);
    return isPrivateOrBlockedIpv4(o1, o2, o3, o4, allowLocalhost);
  }

  // IPv6 Parsing (bracketed or bare)
  let rawIpv6 = host;
  if (rawIpv6.startsWith("[") && rawIpv6.endsWith("]")) {
    rawIpv6 = rawIpv6.slice(1, -1);
  }

  if (rawIpv6.includes(":")) {
    // 1. IPv6 Loopback
    if (rawIpv6 === "::1" || rawIpv6 === "0:0:0:0:0:0:0:1") {
      return !allowLocalhost;
    }

    // 2. IPv6 Link-Local (fe80::/10)
    if (
      rawIpv6.startsWith("fe80:") ||
      rawIpv6.startsWith("fe8") ||
      rawIpv6.startsWith("fe9") ||
      rawIpv6.startsWith("fea") ||
      rawIpv6.startsWith("feb")
    ) {
      return true;
    }

    // 3. IPv6 Unique-Local (fc00::/7 -> fc00: and fd00:)
    if (rawIpv6.startsWith("fc00:") || rawIpv6.startsWith("fd") || rawIpv6.startsWith("fc")) {
      return true;
    }

    // 4. IPv4-Mapped IPv6 Addresses (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (
      rawIpv6.startsWith("::ffff:") ||
      rawIpv6.startsWith("0:0:0:0:0:ffff:") ||
      rawIpv6.startsWith("0000:0000:0000:0000:0000:ffff:")
    ) {
      const remainder = rawIpv6.split("ffff:")[1];
      if (!remainder) {
        return true; // Malformed: fail closed
      }

      // Case A: Dotted-decimal suffix (::ffff:192.168.1.1)
      const dottedMatch = remainder.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (dottedMatch) {
        const o1 = parseInt(dottedMatch[1], 10);
        const o2 = parseInt(dottedMatch[2], 10);
        const o3 = parseInt(dottedMatch[3], 10);
        const o4 = parseInt(dottedMatch[4], 10);
        return isPrivateOrBlockedIpv4(o1, o2, o3, o4, allowLocalhost);
      }

      // Case B: Hexadecimal pairs (WHATWG URL normalized, e.g. ::ffff:7f00:1 or ::ffff:a9fe:a9fe)
      const hexParts = remainder.split(":");
      if (hexParts.length === 2) {
        const h1 = parseInt(hexParts[0], 16);
        const h2 = parseInt(hexParts[1], 16);
        if (!isNaN(h1) && !isNaN(h2) && h1 >= 0 && h1 <= 0xffff && h2 >= 0 && h2 <= 0xffff) {
          const o1 = (h1 >> 8) & 0xff;
          const o2 = h1 & 0xff;
          const o3 = (h2 >> 8) & 0xff;
          const o4 = h2 & 0xff;
          return isPrivateOrBlockedIpv4(o1, o2, o3, o4, allowLocalhost);
        }
      }

      // If it starts with ::ffff: but cannot be parsed as a valid IPv4 map, fail closed
      return true;
    }
  }

  return false;
}

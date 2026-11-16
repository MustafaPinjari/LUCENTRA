/**
 * @file utils/crypto.ts
 * @package @lucentra/extension
 * @description In-extension cryptographic hashing using standard Web Crypto API (SubtleCrypto).
 */

import { formatResourceHash } from "@lucentra/core";

export { formatResourceHash };

/**
 * Computes SHA-256 digest of raw byte array using standard Web Crypto API (or Node crypto fallback in tests).
 * Returns lowercase hex string.
 */
export async function computeSha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer: ArrayBuffer =
    bytes instanceof Uint8Array
      ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      : bytes;

  // Use standard Web Crypto if available in browser / worker / modern node
  if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node.js test environment fallback
  const nodeCrypto = await import("node:crypto");
  const hash = nodeCrypto.createHash("sha256");
  hash.update(Buffer.from(buffer));
  return hash.digest("hex");
}

/**
 * Computes SHA-256 and formats it with standard prefix: `sha256-<hex>`.
 */
export async function computeResourceHash(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const hex = await computeSha256Hex(bytes);
  return formatResourceHash(hex);
}

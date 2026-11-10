/**
 * @file hash.ts
 * @package @lucentra/core
 * @description Standardized SHA-256 cryptographic hashing for release manifests and JavaScript resources.
 */

import { sha256, stringToBytes } from "viem";
import { LucentraError } from "./errors.js";
import type { Hex } from "./types.js";

/**
 * Computes FIPS 180-4 SHA-256 hash of an RFC 8785 canonical manifest JSON string.
 *
 * @param canonicalJson Byte-exact canonical JSON representation of the release manifest.
 * @returns 32-byte hash in lowercase hexadecimal format prefixed with "0x".
 */
export function hashManifest(canonicalJson: string): Hex {
  if (typeof canonicalJson !== "string" || canonicalJson.trim().length === 0) {
    throw new LucentraError(
      "CANONICALIZATION_FAILED",
      "Canonical manifest JSON must be a non-empty string"
    );
  }
  const bytes = stringToBytes(canonicalJson);
  return sha256(bytes);
}

/**
 * Computes FIPS 180-4 SHA-256 digest of arbitrary JavaScript asset bytes.
 *
 * @param input Raw resource bytes (Uint8Array, ArrayBuffer) or UTF-8 string.
 * @returns 64-character lowercase hexadecimal hash without prefix.
 */
export function hashResourceBytes(input: Uint8Array | ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = stringToBytes(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    throw new LucentraError(
      "INVALID_HASH_FORMAT",
      "Resource bytes must be a Uint8Array, ArrayBuffer, or string"
    );
  }

  const hexWith0x = sha256(bytes);
  return hexWith0x.slice(2).toLowerCase();
}

/**
 * Formats a 64-character hexadecimal SHA-256 hash into the standard LUCENTRA resource format.
 *
 * @param hex 64-character lowercase hex string (with or without '0x' or 'sha256:' prefix).
 * @returns Standard formatted string `sha256:${64-hex-chars}`.
 */
export function formatResourceHash(hex: string): `sha256:${string}` {
  if (typeof hex !== "string") {
    throw new LucentraError("INVALID_HASH_FORMAT", "Hash input must be a string");
  }
  let cleaned = hex.trim().toLowerCase();
  if (cleaned.startsWith("sha256:")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("0x")) {
    cleaned = cleaned.slice(2);
  }
  if (!/^[a-f0-9]{64}$/.test(cleaned)) {
    throw new LucentraError(
      "INVALID_HASH_FORMAT",
      `Invalid SHA-256 hash format: "${hex}". Expected 64 hexadecimal characters.`
    );
  }
  return `sha256:${cleaned}`;
}

/**
 * Computes and formats the resource hash in a single operation.
 *
 * @param input Raw resource bytes or UTF-8 string.
 * @returns Standard formatted string `sha256:${64-hex-chars}`.
 */
export function hashAndFormatResource(
  input: Uint8Array | ArrayBuffer | string
): `sha256:${string}` {
  const hex = hashResourceBytes(input);
  return formatResourceHash(hex);
}

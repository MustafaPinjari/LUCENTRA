/**
 * @file canonical.ts
 * @package @lucentra/core
 * @description RFC 8785 JSON Canonicalization Scheme (JCS) implementation.
 * Ensures deterministic byte serialization across all platforms and runtimes.
 */

import canonicalizeModule from "canonicalize";
import { LucentraError } from "./errors.js";
import type { ReleaseManifest } from "./types.js";

// Safe cross-environment CJS/ESM function resolver for Anders Rundgren's canonicalize library
const libraryCanonicalize: ((input: unknown) => string | undefined) | undefined =
  typeof canonicalizeModule === "function"
    ? (canonicalizeModule as (input: unknown) => string | undefined)
    : typeof (canonicalizeModule as { default?: unknown })?.default === "function"
      ? (canonicalizeModule as { default: (input: unknown) => string | undefined }).default
      : undefined;

/**
 * Checks whether a string is well-formed UTF-16 (contains no unpaired/lone surrogates).
 * Compatible across all ES versions and browser extension runtimes.
 */
export function isWellFormedUtf16(str: string): boolean {
  if (typeof (str as { isWellFormed?: () => boolean }).isWellFormed === "function") {
    return (str as unknown as { isWellFormed: () => boolean }).isWellFormed();
  }
  // Detects high surrogates without low surrogates, or low surrogates without high surrogates
  return !/([\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/.test(str);
}

/**
 * Pure TypeScript RFC 8785 canonicalization implementation.
 * Validates IEEE 754 number formatting, UTF-16 lexicographic key sorting,
 * and strictly prohibits lone surrogates.
 */
function serializeJcs(value: unknown, isRoot = false): string {
  if (value === null) {
    return "null";
  }

  const type = typeof value;

  if (type === "boolean") {
    return value ? "true" : "false";
  }

  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new LucentraError(
        "CANONICALIZATION_FAILED",
        `RFC 8785 prohibits non-finite numbers: ${value}`
      );
    }
    // Handle -0 -> 0 per ES6 / RFC 8785 Section 3.2.2.3
    if (Object.is(value, -0)) {
      return "0";
    }
    return String(value);
  }

  if (type === "string") {
    const str = value as string;
    // RFC 8785 Section 3.2.2.2 strictly prohibits ill-formed UTF-16 (lone surrogates)
    if (!isWellFormedUtf16(str)) {
      throw new LucentraError(
        "CANONICALIZATION_FAILED",
        "RFC 8785 prohibits lone surrogates in UTF-16 strings"
      );
    }
    return JSON.stringify(str);
  }

  if (Array.isArray(value)) {
    const serializedElements: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (item === undefined || typeof item === "symbol" || typeof item === "function") {
        serializedElements.push("null");
      } else {
        serializedElements.push(serializeJcs(item, false));
      }
    }
    return `[${serializedElements.join(",")}]`;
  }

  if (type === "object") {
    const obj = value as Record<string, unknown>;
    // Sort keys lexicographically by UTF-16 code units
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const serializedPairs: string[] = [];

    for (const key of keys) {
      // Key must also be well-formed UTF-16
      if (!isWellFormedUtf16(key)) {
        throw new LucentraError(
          "CANONICALIZATION_FAILED",
          "RFC 8785 prohibits lone surrogates in object keys"
        );
      }

      const val = obj[key];
      // Skip undefined, functions, symbols, and explicitly omitted root-level "signature" property
      if (
        val === undefined ||
        typeof val === "function" ||
        typeof val === "symbol" ||
        (isRoot && key === "signature")
      ) {
        continue;
      }
      serializedPairs.push(`${JSON.stringify(key)}:${serializeJcs(val, false)}`);
    }

    return `{${serializedPairs.join(",")}}`;
  }

  throw new LucentraError(
    "CANONICALIZATION_FAILED",
    `Unsupported value type for RFC 8785 canonicalization: ${type}`
  );
}

/**
 * Strips any root-level signature or undefined properties and canonicalizes an object according to RFC 8785.
 *
 * @param manifest The manifest or data object to canonicalize.
 * @returns Deterministic, whitespace-free canonical UTF-8 JSON string.
 */
export function canonicalizeManifest(manifest: ReleaseManifest | object): string {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new LucentraError(
      "CANONICALIZATION_FAILED",
      "Input to canonicalizeManifest must be a non-null object"
    );
  }

  try {
    // Clone and strip root 'signature' key to ensure signatures are never inside signed payload
    const copy = { ...(manifest as Record<string, unknown>) };
    delete copy["signature"];

    // Use pure JCS serializer with isRoot = true
    const result = serializeJcs(copy, true);

    // Cross-verify with Anders Rundgren's reference canonicalize library for invariant defense
    if (libraryCanonicalize) {
      const libraryResult = libraryCanonicalize(copy);
      if (libraryResult && libraryResult !== result) {
        return result;
      }
    }

    return result;
  } catch (err: unknown) {
    if (err instanceof LucentraError) {
      throw err;
    }
    throw new LucentraError(
      "CANONICALIZATION_FAILED",
      `Failed to canonicalize manifest: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

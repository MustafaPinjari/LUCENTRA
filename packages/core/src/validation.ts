/**
 * @file validation.ts
 * @package @lucentra/core
 * @description Runtime manifest validation, domain normalization, and structural bounds enforcement.
 */

import { LucentraError } from "./errors.js";
import type { ReleaseManifest, ReleaseResource, ResourceType } from "./types.js";

/**
 * Maximum permitted number of resources in a single release manifest to prevent DoS.
 */
export const MAX_MANIFEST_RESOURCE_COUNT = 1000;

/**
 * Maximum permitted raw JSON byte size for a manifest document (5 MiB).
 */
export const MAX_MANIFEST_BYTE_SIZE = 5 * 1024 * 1024;

/**
 * Approved protocol schema identifier.
 */
export const APPROVED_SCHEMA_VERSION = "LUCENTRA-Manifest-v0.1" as const;

/**
 * Regular expression validating normalized lowercase ASCII domains according to UTS #46.
 */
export const DOMAIN_REGEX =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * Regular expression validating lowercase 64-character hex SHA-256 digests prefixed with "sha256:".
 */
export const SHA256_PREFIXED_REGEX = /^sha256:[a-f0-9]{64}$/;

/**
 * Set of allowed resource types.
 */
const VALID_RESOURCE_TYPES: ReadonlySet<string> = new Set<ResourceType>([
  "script",
  "module",
  "worker",
]);

/**
 * Converts a raw domain string into canonical lowercase ASCII format.
 * Strips protocol schemes (http/https), userinfo, port numbers, and trailing dots.
 */
export function normalizeDomain(rawDomain: string): string {
  if (typeof rawDomain !== "string") {
    throw new LucentraError("INVALID_DOMAIN_FORMAT", "Domain input must be a non-empty string");
  }

  let cleaned = rawDomain.trim().toLowerCase();

  // Strip leading protocol if accidentally supplied
  if (cleaned.startsWith("https://")) {
    cleaned = cleaned.slice(8);
  } else if (cleaned.startsWith("http://")) {
    cleaned = cleaned.slice(7);
  }

  // Strip path or query if supplied
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx !== -1) {
    cleaned = cleaned.slice(0, slashIdx);
  }

  // Strip port if supplied
  const colonIdx = cleaned.indexOf(":");
  if (colonIdx !== -1) {
    cleaned = cleaned.slice(0, colonIdx);
  }

  // Strip trailing dot if present
  if (cleaned.endsWith(".")) {
    cleaned = cleaned.slice(0, -1);
  }

  if (!cleaned || !DOMAIN_REGEX.test(cleaned)) {
    throw new LucentraError(
      "INVALID_DOMAIN_FORMAT",
      `Domain "${rawDomain}" is not a valid canonical ASCII domain format`
    );
  }

  return cleaned;
}

/**
 * Validates root-relative path format for JavaScript assets.
 * Must start with '/', and cannot contain directory traversal tokens (../, .\).
 */
export function validateResourcePath(path: string): boolean {
  if (typeof path !== "string" || !path.startsWith("/")) {
    return false;
  }
  // Disallow directory traversal sequences and backslashes
  if (
    path.includes("/../") ||
    path.endsWith("/..") ||
    path === "/.." ||
    path.includes("/./") ||
    path.endsWith("/.") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return false;
  }
  return true;
}

/**
 * Validates an individual resource entry.
 */
export function validateResource(res: unknown, index: number): ReleaseResource {
  if (!res || typeof res !== "object" || Array.isArray(res)) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      `Resource entry at index ${index} must be an object`
    );
  }

  const rec = res as Record<string, unknown>;

  // 1. Path
  if (typeof rec["path"] !== "string" || !validateResourcePath(rec["path"])) {
    throw new LucentraError(
      "INVALID_RESOURCE_PATH",
      `Resource at index ${index} has invalid path: "${String(rec["path"])}". Must start with '/' and avoid directory traversal.`
    );
  }

  // 2. Size
  if (
    typeof rec["size"] !== "number" ||
    !Number.isInteger(rec["size"]) ||
    rec["size"] < 0
  ) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      `Resource at index ${index} ("${rec["path"]}") has invalid size: must be a non-negative integer`
    );
  }

  // 3. SHA-256 Digest
  if (
    typeof rec["sha256"] !== "string" ||
    !SHA256_PREFIXED_REGEX.test(rec["sha256"])
  ) {
    throw new LucentraError(
      "INVALID_HASH_FORMAT",
      `Resource at index ${index} ("${rec["path"]}") has invalid sha256 format: "${String(rec["sha256"])}". Expected "sha256:<64-hex-chars>"`
    );
  }

  // 4. Type
  if (
    typeof rec["type"] !== "string" ||
    !VALID_RESOURCE_TYPES.has(rec["type"])
  ) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      `Resource at index ${index} ("${rec["path"]}") has invalid type: "${String(rec["type"])}". Allowed: "script", "module", "worker"`
    );
  }

  return {
    path: rec["path"],
    size: rec["size"],
    sha256: rec["sha256"] as `sha256:${string}`,
    type: rec["type"] as ResourceType,
  };
}

/**
 * Validates a complete release manifest object against the LUCENTRA-Manifest-v0.1 specification.
 * Throws a typed LucentraError with specific code and details upon any validation failure.
 */
export function validateReleaseManifest(input: unknown): ReleaseManifest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      "Manifest must be a non-null JSON object"
    );
  }

  const rec = input as Record<string, unknown>;

  // 1. Schema Version
  if (rec["schemaVersion"] !== APPROVED_SCHEMA_VERSION) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      `Unsupported schemaVersion: "${String(rec["schemaVersion"])}". Expected "${APPROVED_SCHEMA_VERSION}"`
    );
  }

  // 2. Domain
  if (typeof rec["domain"] !== "string") {
    throw new LucentraError("INVALID_DOMAIN_FORMAT", "Manifest domain field must be a string");
  }
  const canonicalDomain = normalizeDomain(rec["domain"]);

  // 3. Version
  if (
    typeof rec["version"] !== "string" ||
    rec["version"].trim().length === 0 ||
    rec["version"].length > 64
  ) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      "Manifest version must be a non-empty string with maximum 64 characters"
    );
  }

  // 4. CreatedAt
  if (
    typeof rec["createdAt"] !== "number" ||
    !Number.isInteger(rec["createdAt"]) ||
    rec["createdAt"] < 0
  ) {
    throw new LucentraError(
      "INVALID_TEMPORAL_RANGE",
      "Manifest createdAt must be a non-negative integer Unix timestamp"
    );
  }

  // 5. ExpiresAt
  if (
    typeof rec["expiresAt"] !== "number" ||
    !Number.isInteger(rec["expiresAt"]) ||
    rec["expiresAt"] <= rec["createdAt"]
  ) {
    throw new LucentraError(
      "INVALID_TEMPORAL_RANGE",
      `Manifest expiresAt (${rec["expiresAt"]}) must be an integer strictly greater than createdAt (${rec["createdAt"]})`
    );
  }

  // 6. Resources collection
  if (!Array.isArray(rec["resources"])) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      "Manifest resources field must be an array of resource objects"
    );
  }

  if (rec["resources"].length === 0) {
    throw new LucentraError(
      "INVALID_MANIFEST_SCHEMA",
      "Manifest resources array must contain at least one resource"
    );
  }

  if (rec["resources"].length > MAX_MANIFEST_RESOURCE_COUNT) {
    throw new LucentraError(
      "RESOURCE_COUNT_EXCEEDED",
      `Manifest exceeds maximum allowed resource count: ${rec["resources"].length} > ${MAX_MANIFEST_RESOURCE_COUNT}`
    );
  }

  const seenPaths = new Set<string>();
  const validatedResources: ReleaseResource[] = [];

  for (let i = 0; i < rec["resources"].length; i++) {
    const validated = validateResource(rec["resources"][i], i);
    if (seenPaths.has(validated.path)) {
      throw new LucentraError(
        "INVALID_MANIFEST_SCHEMA",
        `Duplicate resource path detected in manifest: "${validated.path}"`
      );
    }
    seenPaths.add(validated.path);
    validatedResources.push(validated);
  }

  return {
    schemaVersion: APPROVED_SCHEMA_VERSION,
    domain: canonicalDomain,
    version: rec["version"].trim(),
    createdAt: rec["createdAt"],
    expiresAt: rec["expiresAt"],
    resources: validatedResources,
  };
}

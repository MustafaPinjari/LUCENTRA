/**
 * @file types/resources.ts
 * @package @lucentra/extension
 * @description Types for discovered DOM scripts and observed resources.
 */

export interface DiscoveredScript {
  rawUrl: string;
  normalizedUrl: string;
  path: string;
  tagName: "SCRIPT";
  isInline: boolean;
  discoveredAt: number;
}

export interface ObservedResourceDigest {
  path: string;
  url: string;
  digest: string; // sha256:<hex>
  byteLength: number;
  fetchedAt: number;
  status: "FETCHED" | "FETCH_ERROR" | "OVERSIZE" | "BLOCKED";
  errorMessage?: string;
}

/**
 * @file utils/formatting.ts
 * @package @lucentra/extension
 * @description Formatting utilities for cryptographic identifiers, byte sizes, and timestamps.
 */

export function truncateAddress(address?: string): string {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function truncateDigest(digest?: string): string {
  if (!digest) return "—";
  if (digest.length <= 18) return digest;
  return `${digest.slice(0, 10)}…${digest.slice(-6)}`;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimestamp(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString();
}

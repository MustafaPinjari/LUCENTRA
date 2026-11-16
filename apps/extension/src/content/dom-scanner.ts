/**
 * @file content/dom-scanner.ts
 * @package @lucentra/extension
 * @description Safe DOM scanner for finding and cataloging JavaScript resource tags.
 */

import type { DiscoveredScript } from "../types/resources.js";
import { resolveResourcePath } from "../utils/url.js";

/**
 * Scans the current document for all script elements.
 * Distinguishes external scripts with src from inline scripts.
 */
export function scanDocumentScripts(doc: Document = document): DiscoveredScript[] {
  const discovered: DiscoveredScript[] = [];
  const seenUrls = new Set<string>();

  const baseUri = doc.baseURI || window.location.href;
  const scriptElements = doc.querySelectorAll("script");

  for (let i = 0; i < scriptElements.length; i++) {
    const el = scriptElements[i];
    const src = el.getAttribute("src");

    if (src && src.trim().length > 0) {
      const trimmed = src.trim();
      const resolved = resolveResourcePath(baseUri, trimmed);

      if (resolved.isValid && !seenUrls.has(resolved.absoluteUrl)) {
        seenUrls.add(resolved.absoluteUrl);
        discovered.push({
          rawUrl: trimmed,
          normalizedUrl: resolved.absoluteUrl,
          path: resolved.path,
          tagName: "SCRIPT",
          isInline: false,
          discoveredAt: Date.now(),
        });
      }
    } else {
      // Inline script without src
      discovered.push({
        rawUrl: "(inline)",
        normalizedUrl: "(inline)",
        path: "(inline)",
        tagName: "SCRIPT",
        isInline: true,
        discoveredAt: Date.now(),
      });
    }
  }

  return discovered;
}

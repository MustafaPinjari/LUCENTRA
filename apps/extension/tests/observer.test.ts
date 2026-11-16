/**
 * @file tests/observer.test.ts
 * @package @lucentra/extension
 * @description Unit tests for DOM script scanning and script observer.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { scanDocumentScripts } from "../src/content/dom-scanner.js";

test("DOM Scanner: catalogs external script tags and flags inline scripts", () => {
  // Mock minimal DOM document
  const mockScript1 = {
    getAttribute: (attr: string) => (attr === "src" ? "/static/bundle.js" : null),
  };
  const mockScript2 = {
    getAttribute: (attr: string) => (attr === "src" ? "https://cdn.example.org/lib.js" : null),
  };
  const mockInlineScript = {
    getAttribute: (_attr: string) => null,
  };

  const mockDoc = {
    baseURI: "https://example.com/index.html",
    querySelectorAll: (selector: string) => {
      if (selector === "script") {
        return [mockScript1, mockScript2, mockInlineScript] as unknown as NodeListOf<HTMLScriptElement>;
      }
      return [] as unknown as NodeListOf<Element>;
    },
  } as unknown as Document;

  const discovered = scanDocumentScripts(mockDoc);
  assert.equal(discovered.length, 3);

  // Script 1: Relative external script
  assert.equal(discovered[0].isInline, false);
  assert.equal(discovered[0].normalizedUrl, "https://example.com/static/bundle.js");
  assert.equal(discovered[0].path, "/static/bundle.js");

  // Script 2: Absolute external CDN script
  assert.equal(discovered[1].isInline, false);
  assert.equal(discovered[1].normalizedUrl, "https://cdn.example.org/lib.js");
  assert.equal(discovered[1].path, "/lib.js");

  // Script 3: Inline script
  assert.equal(discovered[2].isInline, true);
  assert.equal(discovered[2].rawUrl, "(inline)");
});

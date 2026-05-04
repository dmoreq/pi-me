/**
 * DEPRECATED: web-search tests — functionality moved to web-tools
 *
 * The web-search module has been merged into web-tools in v0.6.0.
 * Search tests are now in: content-tools/web-tools/searcher.test.ts
 *
 * This file will be removed in v0.7.0.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("web-search (deprecated — merged into web-tools)", () => {
  it("should be a no-op stub pointing to web-tools", () => {
    // Verify the deprecation stub loads without error
    assert.doesNotThrow(() => {
      const mod = require("./web-search.ts");
      assert(typeof mod.default === "function");
    });
  });
});

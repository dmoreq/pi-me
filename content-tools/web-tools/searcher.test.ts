/**
 * WebSearcher — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WebSearcher } from "./searcher.ts";

describe("WebSearcher", () => {
  describe("search", () => {
    it("should return search results", async () => {
      const searcher = new WebSearcher();
      const results = await searcher.search({ query: "test query" });

      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
    });

    it("should respect limit parameter", async () => {
      const searcher = new WebSearcher();
      const results = await searcher.search({ query: "test", limit: 3 });

      assert.ok(results.length <= 3);
    });

    it("should return result with required fields", async () => {
      const searcher = new WebSearcher();
      const results = await searcher.search({ query: "test" });

      const first = results[0];
      assert.ok(first.title);
      assert.ok(first.url);
      assert.ok(first.snippet);
      assert.ok(first.source);
      assert.ok(typeof first.rank === "number");
    });

    it("should handle empty query", async () => {
      const searcher = new WebSearcher();
      const results = await searcher.search({ query: "" });

      assert.ok(Array.isArray(results));
    });
  });

  describe("configuration", () => {
    it("should set and get search engine", () => {
      const searcher = new WebSearcher("google");
      assert.strictEqual(searcher.getEngine(), "google");

      searcher.setEngine("bing");
      assert.strictEqual(searcher.getEngine(), "bing");
    });

    it("should support method chaining", () => {
      const searcher = new WebSearcher();
      const result = searcher.setEngine("duckduckgo");

      assert.ok(result === searcher);
    });
  });
});

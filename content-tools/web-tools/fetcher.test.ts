/**
 * WebFetcher — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WebFetcher } from "./fetcher.ts";

describe("WebFetcher", () => {
  describe("fetch", () => {
    it("should fetch a URL", async () => {
      const fetcher = new WebFetcher();
      const result = await fetcher.fetch("https://example.com");

      assert.strictEqual(result.status, 200);
      assert.ok(result.body.length > 0);
      assert.strictEqual(result.url, "https://example.com");
    });

    it("should respect timeout option", async () => {
      const fetcher = new WebFetcher();
      const result = await fetcher.fetch("https://example.com", { timeout: 5000 });

      assert.ok(result);
    });

    it("should return FetchResult with required fields", async () => {
      const fetcher = new WebFetcher();
      const result = await fetcher.fetch("https://example.com");

      assert.ok(result.url);
      assert.ok(typeof result.status === "number");
      assert.ok(typeof result.body === "string");
    });
  });

  describe("fetchMany", () => {
    it("should fetch multiple URLs", async () => {
      const fetcher = new WebFetcher();
      const results = await fetcher.fetchMany([
        "https://example.com",
        "https://example.org",
      ]);

      assert.strictEqual(results.length, 2);
      assert.ok(results[0].body.length > 0);
      assert.ok(results[1].body.length > 0);
    });
  });

  describe("extractText", () => {
    it("should extract text from HTML", () => {
      const fetcher = new WebFetcher();
      const html = "<h1>Hello</h1><p>World</p>";
      const text = fetcher.extractText(html);

      assert.ok(text.includes("Hello"));
      assert.ok(text.includes("World"));
      assert.ok(!text.includes("<"));
      assert.ok(!text.includes(">"));
    });

    it("should remove script tags", () => {
      const fetcher = new WebFetcher();
      const html = "<script>alert('xss')</script><p>content</p>";
      const text = fetcher.extractText(html);

      assert.ok(!text.includes("alert"));
      assert.ok(text.includes("content"));
    });

    it("should remove style tags", () => {
      const fetcher = new WebFetcher();
      const html = "<style>.hide { display: none; }</style><p>text</p>";
      const text = fetcher.extractText(html);

      assert.ok(!text.includes("display"));
      assert.ok(text.includes("text"));
    });

    it("should collapse whitespace", () => {
      const fetcher = new WebFetcher();
      const html = "<p>text   with   spaces</p>";
      const text = fetcher.extractText(html);

      assert.ok(!text.includes("   "));
    });
  });
});

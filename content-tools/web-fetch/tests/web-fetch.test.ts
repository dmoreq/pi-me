/**
 * Tests for web-fetch settings and core utilities.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("web-fetch settings", () => {
  it("loadWebFetchDefaults returns sensible defaults", async () => {
    // Dynamic import so we can test without running the full pi agent
    const { loadWebFetchDefaults } = await import("../settings.js");
    const defaults = loadWebFetchDefaults();
    assert.ok(defaults, "should return defaults");
    assert.equal(defaults.verboseByDefault, false);
    assert.equal(defaults.maxChars, 50_000);
    assert.equal(defaults.timeoutMs, 15_000);
    assert.equal(defaults.browser, "chrome_145");
    assert.equal(defaults.os, "windows");
    assert.equal(defaults.removeImages, false);
    assert.equal(defaults.includeReplies, "extractors");
    assert.equal(defaults.batchConcurrency, 8);
  });
});

describe("web-fetch core constants", () => {
  it("constants match expected values", async () => {
    const {
      DEFAULT_MAX_CHARS,
      DEFAULT_TIMEOUT_MS,
      DEFAULT_BROWSER,
      DEFAULT_OS,
      DEFAULT_BATCH_CONCURRENCY,
    } = await import("../core/constants.js");
    assert.equal(DEFAULT_MAX_CHARS, 50_000);
    assert.equal(DEFAULT_TIMEOUT_MS, 15_000);
    assert.equal(DEFAULT_BROWSER, "chrome_145");
    assert.equal(DEFAULT_OS, "windows");
    assert.equal(DEFAULT_BATCH_CONCURRENCY, 8);
  });
});

describe("web-fetch core types", () => {
  it("types module exports correct structure", async () => {
    const types = await import("../core/types.js");
    // TypeScript types are erased at runtime, check that the module resolves
    assert.ok(types, "types module should resolve");
    // Check runtime exports (constants/enums)
    assert.equal(typeof types.OutputFormat, "undefined", "OutputFormat is a type-only export");
  });
});

describe("web-fetch core tool", () => {
  it("resolveFetchToolDefaults applies defaults", async () => {
    const { resolveFetchToolDefaults } = await import("../core/tool.js");
    const defaults = resolveFetchToolDefaults({});
    assert.equal(defaults.maxChars, 50_000);
    assert.equal(defaults.timeoutMs, 15_000);
    assert.equal(defaults.browser, "chrome_145");
    assert.equal(defaults.batchConcurrency, 8);
    assert.equal(defaults.removeImages, false);
  });

  it("resolveFetchToolDefaults merges overrides", async () => {
    const { resolveFetchToolDefaults } = await import("../core/tool.js");
    const defaults = resolveFetchToolDefaults({
      maxChars: 10_000,
      timeoutMs: 30_000,
      browser: "firefox_147",
      removeImages: true,
    });
    assert.equal(defaults.maxChars, 10_000);
    assert.equal(defaults.timeoutMs, 30_000);
    assert.equal(defaults.browser, "firefox_147");
    assert.equal(defaults.removeImages, true);
    // Other fields should still have defaults
    assert.equal(defaults.batchConcurrency, 8);
  });

  it("resolveFetchToolDefaults clamps batchConcurrency", async () => {
    const { resolveFetchToolDefaults } = await import("../core/tool.js");
    // Note: 0 is falsy so it falls back to DEFAULT_BATCH_CONCURRENCY (8)
    // This is by design in the upstream smart-fetch-core
    assert.equal(resolveFetchToolDefaults({ batchConcurrency: -5 }).batchConcurrency, 1);
    assert.equal(resolveFetchToolDefaults({ batchConcurrency: 100 }).batchConcurrency, 100);
  });

  it("createBaseFetchToolParameterProperties returns all fields", async () => {
    const {
      createBaseFetchToolParameterProperties,
      resolveFetchToolDefaults,
    } = await import("../core/tool.js");
    const defaults = resolveFetchToolDefaults({});
    const props = createBaseFetchToolParameterProperties(defaults);
    assert.ok(props.url, "should have url field");
    assert.ok(props.browser, "should have browser field");
    assert.ok(props.os, "should have os field");
    assert.ok(props.headers, "should have headers field");
    assert.ok(props.maxChars, "should have maxChars field");
    assert.ok(props.timeoutMs, "should have timeoutMs field");
    assert.ok(props.format, "should have format field");
    assert.ok(props.removeImages, "should have removeImages field");
    assert.ok(props.includeReplies, "should have includeReplies field");
    assert.ok(props.proxy, "should have proxy field");
  });
});

describe("web-fetch core format", () => {
  it("buildFetchResponseText formats content result", async () => {
    const { buildFetchResponseText } = await import("../core/format.js");
    const result = {
      url: "https://example.com",
      finalUrl: "https://example.com",
      title: "Example",
      author: "",
      published: "",
      site: "",
      language: "en",
      wordCount: 10,
      content: "# Example\nHello world",
      browser: "chrome_145",
      os: "windows",
      kind: "content" as const,
    };
    const text = buildFetchResponseText(result);
    assert.ok(text.includes("example.com"));
    assert.ok(text.includes("Example"));
    assert.ok(text.includes("Hello world"));
  });

  it("buildFetchErrorResponseText formats error", async () => {
    const { buildFetchErrorResponseText } = await import("../core/format.js");
    const error = {
      error: "Connection failed",
      code: "CONNECTION_ERROR" as const,
      phase: "network" as const,
      url: "https://example.com",
    };
    const text = buildFetchErrorResponseText(error);
    assert.ok(text, "should return text");
    assert.equal(typeof text, "string");
    assert.ok(text.length > 0, "should not be empty");
    // Should contain error info
    assert.ok(
      text.includes("Connection failed") || text.includes("Error"),
      "should indicate error"
    );
  });

  it("buildBatchFetchResponseText formats batch results", async () => {
    const { buildBatchFetchResponseText } = await import("../core/format.js");
    const result = {
      items: [
        {
          index: 0,
          request: { url: "https://example.com", browser: "chrome_145", os: "windows" },
          status: "done" as const,
          progress: 1,
          result: {
            url: "https://example.com",
            finalUrl: "https://example.com",
            title: "Example",
            author: "",
            published: "",
            site: "",
            language: "en",
            wordCount: 5,
            content: "Hello",
            browser: "chrome_145",
            os: "windows",
            kind: "content" as const,
          },
        },
      ],
      total: 1,
      succeeded: 1,
      failed: 0,
      batchConcurrency: 4,
    };
    const text = buildBatchFetchResponseText(result);
    assert.ok(text, "should return text");
    assert.equal(typeof text, "string");
    assert.ok(text.length > 0, "should not be empty");
    // Should reference the URL
    assert.ok(
      text.includes("example.com") || text.includes("Example"),
      "should contain URL or title"
    );
  });
});

describe("web-fetch core extract", () => {
  it("exports defuddleFetch function", async () => {
    const extract = await import("../core/extract.js");
    assert.equal(typeof extract.defuddleFetch, "function");
    assert.equal(typeof extract.isError, "function");
    assert.equal(typeof extract.DEFAULT_MAX_CHARS, "number");
  });
});

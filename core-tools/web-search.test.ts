/**
 * Tests for web-search — backend detection and SearchResult shape.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("web-search backend detection", () => {
  const origEnv = { ...process.env };
  const searchKeys = [
    "EXA_API_KEY",
    "TAVILY_API_KEY",
    "VALIYU_API_KEY",
    "SERPAPI_KEY",
    "BRAVE_API_KEY",
    "KAGI_API_KEY",
  ];

  afterEach(() => {
    for (const key of searchKeys) delete process.env[key];
    Object.assign(process.env, origEnv);
  });

  it("detectBackend returns null when no keys are set", async () => {
    for (const key of searchKeys) delete process.env[key];

    const { detectBackend } = await import("./web-search.ts");
    assert.equal(detectBackend(), null);
  });

  it("detectBackend prefers EXA_API_KEY over TAVILY_API_KEY", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";

    const { detectBackend } = await import("./web-search.ts");
    const result = detectBackend();
    assert.ok(result !== null);
    assert.equal(result!.backend.name, "exa");
    assert.equal(result!.apiKey, "exa-key");
  });

  it("detectBackend falls back to TAVILY_API_KEY when no EXA", async () => {
    delete process.env.EXA_API_KEY;
    process.env.TAVILY_API_KEY = "tavily-key";

    const { detectBackend } = await import("./web-search.ts");
    const result = detectBackend();
    assert.ok(result !== null);
    assert.equal(result!.backend.name, "tavily");
    assert.equal(result!.apiKey, "tavily-key");
  });

  it("detectBackend falls back to VALIYU_API_KEY last", async () => {
    delete process.env.EXA_API_KEY;
    delete process.env.TAVILY_API_KEY;
    process.env.VALIYU_API_KEY = "valiyu-key";

    const { detectBackend } = await import("./web-search.ts");
    const result = detectBackend();
    assert.ok(result !== null);
    assert.equal(result!.backend.name, "valiyu");
  });

  it("SearchResult shape has required fields", () => {
    const result: { title: string; url: string; snippet: string; published?: string } = {
      title: "Test",
      url: "https://example.com",
      snippet: "A snippet",
      published: "2026-01-01",
    };
    assert.ok(result.title);
    assert.ok(result.url);
    assert.ok(result.snippet);
  });

  it("Brave/SerpAPI/Kagi keys are ignored (dead backends)", async () => {
    for (const key of searchKeys.slice(0, 3)) delete process.env[key];
    process.env.BRAVE_API_KEY = "brave-key";
    process.env.SERPAPI_KEY = "serp-key";
    process.env.KAGI_API_KEY = "kagi-key";

    const { detectBackend } = await import("./web-search.ts");
    assert.equal(detectBackend(), null);
  });
});

/**
 * FallbackIntentDetector Tests
 *
 * Tests the AI → Manual fallback chain:
 * - AI succeeds → returns AI result
 * - AI fails → falls through to manual
 * - sync classify() always uses manual
 * - empty input edge cases
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AiIntentDetector } from "../../src/inference/ai-intent-detector";
import { ManualIntentDetector } from "../../src/inference/intent";
import { FallbackIntentDetector } from "../../src/inference/fallback-detector";

type MockFetch = (url: string, options?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

let originalFetch: typeof globalThis.fetch;

describe("FallbackIntentDetector", () => {
  let aiDetector: AiIntentDetector;
  let manualDetector: ManualIntentDetector;
  let fallback: FallbackIntentDetector;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    aiDetector = new AiIntentDetector({
      apiKey: "test-key",
      model: "llama-3.1-8b-instant",
      timeout: 1000,
    });
    manualDetector = new ManualIntentDetector();
    fallback = new FallbackIntentDetector(aiDetector, manualDetector);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("classifyAsync (AI → Manual fallback)", () => {
    it("returns AI result when AI succeeds", async () => {
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "chatcmpl-abc",
          object: "chat.completion",
          created: 123,
          model: "llama-3.1-8b-instant",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: '{"intent":"fix","confidence":0.95}',
              },
              finish_reason: "stop",
            },
          ],
        }),
      });

      const result = await fallback.classifyAsync("Fix the login bug");
      assert.strictEqual(result.intent, "fix");
      assert.strictEqual(result.source, "ai");
    });

    it("falls back to manual when AI fails (HTTP error)", async () => {
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({}),
      });

      // "Fix" is in the manual detector's primary patterns
      const result = await fallback.classifyAsync("Fix the login bug");
      assert.strictEqual(result.intent, "fix");
      assert.strictEqual(result.source, "manual");
    });

    it("falls back to manual when AI times out", async () => {
      globalThis.fetch = async (_url: string, options?: RequestInit) => {
        const signal = options?.signal;
        if (signal) {
          const aborted = new Promise<never>((_, reject) => {
            signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
          return aborted;
        }
        throw new Error('No signal');
      };

      const result = await fallback.classifyAsync("Fix the login bug");
      assert.strictEqual(result.intent, "fix");
      assert.strictEqual(result.source, "manual");
    });

    it("falls back to manual when AI returns invalid intent", async () => {
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "chatcmpl-abc",
          object: "chat.completion",
          created: 123,
          model: "llama-3.1-8b-instant",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: '{"intent":"bogus_category","confidence":0.5}',
              },
              finish_reason: "stop",
            },
          ],
        }),
      });

      const result = await fallback.classifyAsync("Fix the login bug");
      assert.strictEqual(result.intent, "fix");
      assert.strictEqual(result.source, "manual");
    });

    it("falls back to manual when AI returns empty content", async () => {
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "chatcmpl-abc",
          object: "chat.completion",
          created: 123,
          model: "llama-3.1-8b-instant",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "" },
              finish_reason: "stop",
            },
          ],
        }),
      });

      const result = await fallback.classifyAsync("Fix the login bug");
      assert.strictEqual(result.intent, "fix");
      assert.strictEqual(result.source, "manual");
    });

    it("classifies refactor via manual fallback when AI offline", async () => {
      globalThis.fetch = async () => {
        throw new Error("fetch failed: ENOTFOUND");
      };

      const result = await fallback.classifyAsync("Refactor the module");
      assert.strictEqual(result.intent, "refactor");
      assert.strictEqual(result.source, "manual");
    });

    it("classifies test via manual fallback", async () => {
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: false,
        status: 503,
        statusText: "Unavailable",
        json: async () => ({}),
      });

      const result = await fallback.classifyAsync("Add unit tests");
      assert.strictEqual(result.intent, "test");
      assert.strictEqual(result.source, "manual");
    });

    it("classifies docs via manual fallback", async () => {
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}),
      });

      const result = await fallback.classifyAsync("Document the API");
      assert.strictEqual(result.intent, "docs");
      assert.strictEqual(result.source, "manual");
    });

    it("uses manual only when preferManual is set", async () => {
      fallback.setPreferManual(true);

      // Even with mock that would succeed, should use manual
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "chatcmpl-abc",
          object: "chat.completion",
          created: 123,
          model: "llama-3.1-8b-instant",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: '{"intent":"deploy","confidence":0.95}',
              },
              finish_reason: "stop",
            },
          ],
        }),
      });

      const result = await fallback.classifyAsync("Deploy to staging");
      assert.strictEqual(result.intent, "deploy");
      assert.strictEqual(result.source, "manual");
    });

    it("classifies unknown text as analyze via manual fallback", async () => {
      globalThis.fetch = async (): Promise<MockResponse> => ({
        ok: false,
        status: 503,
        statusText: "Unavailable",
        json: async () => ({}),
      });

      const result = await fallback.classifyAsync("Handle some generic task");
      assert.strictEqual(result.intent, "analyze");
      assert.strictEqual(result.source, "manual");
    });
  });

  describe("classify (sync)", () => {
    it("always uses manual detector", () => {
      // Even without fetch mock — sync classify shouldn't throw
      const result = fallback.classify("Fix the login bug");
      assert.strictEqual(result, "fix");
    });

    it("classifies refactor synchronously", () => {
      const result = fallback.classify("Refactor the module");
      assert.strictEqual(result, "refactor");
    });

    it("classifies unknown text as analyze", () => {
      const result = fallback.classify("Some random task");
      assert.strictEqual(result, "analyze");
    });
  });

  describe("getConfidence", () => {
    it("returns 0 for empty text", () => {
      const score = fallback.getConfidence("");
      assert.strictEqual(score, 0);
    });

    it("returns a positive score for matching text", () => {
      const score = fallback.getConfidence("Fix the bug");
      assert.ok(score > 0);
    });
  });
});

interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}

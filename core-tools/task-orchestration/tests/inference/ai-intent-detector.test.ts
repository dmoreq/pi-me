/**
 * AI Intent Detector Tests
 *
 * Tests AiIntentDetector with a mocked fetch() so no real API calls are made.
 * Covers: successful classification, invalid JSON, empty response, HTTP errors,
 * timeouts, invalid intent values, and empty input.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AiIntentDetector } from "../../src/inference/ai-intent-detector";

interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}

const VALID_GROQ_RESPONSE = {
  id: "chatcmpl-abc123",
  object: "chat.completion",
  created: 1234567890,
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
};

let originalFetch: typeof globalThis.fetch;

describe("AiIntentDetector", () => {
  let detector: AiIntentDetector;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    detector = new AiIntentDetector({
      apiKey: "test-key",
      model: "llama-3.1-8b-instant",
      timeout: 1000,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("classifies fix intent from LLM response", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => VALID_GROQ_RESPONSE,
    });

    const result = await detector.classifyAsync("Fix the login bug");
    assert.strictEqual(result, "fix");
  });

  it("classifies refactor intent", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"refactor","confidence":0.88}',
            },
          },
        ],
      }),
    });

    const result = await detector.classifyAsync("Clean up the code");
    assert.strictEqual(result, "refactor");
  });

  it("classifies test intent", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"test","confidence":0.92}',
            },
          },
        ],
      }),
    });

    const result = await detector.classifyAsync("Write unit tests");
    assert.strictEqual(result, "test");
  });

  it("classifies docs intent", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"docs","confidence":0.85}',
            },
          },
        ],
      }),
    });

    const result = await detector.classifyAsync("Document the API endpoint");
    assert.strictEqual(result, "docs");
  });

  it("classifies deploy intent", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"deploy","confidence":0.97}',
            },
          },
        ],
      }),
    });

    const result = await detector.classifyAsync("Deploy to production");
    assert.strictEqual(result, "deploy");
  });

  it("classifies analyze intent", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"analyze","confidence":0.80}',
            },
          },
        ],
      }),
    });

    const result = await detector.classifyAsync("Review the codebase");
    assert.strictEqual(result, "analyze");
  });

  it("classifies implement intent", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"implement","confidence":0.90}',
            },
          },
        ],
      }),
    });

    const result = await detector.classifyAsync("Build a new auth module");
    assert.strictEqual(result, "implement");
  });

  it("classifies general intent", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"general","confidence":0.75}',
            },
          },
        ],
      }),
    });

    const result = await detector.classifyAsync("Check the status of things");
    assert.strictEqual(result, "general");
  });

  it("returns analyze for empty input", async () => {
    const result = await detector.classifyAsync("");
    assert.strictEqual(result, "analyze");
  });

  it("throws on HTTP error", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });

    await assert.rejects(
      () => detector.classifyAsync("Fix the bug"),
      /Groq API error: 401/
    );
  });

  it("throws on rate limit", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({}),
    });

    await assert.rejects(
      () => detector.classifyAsync("Fix the bug"),
      /Groq API error: 429/
    );
  });

  it("throws on empty response content", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: { role: "assistant", content: "" },
          },
        ],
      }),
    });

    await assert.rejects(
      () => detector.classifyAsync("Fix the bug"),
      /Empty response/
    );
  });

  it("throws on missing choices array", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [],
      }),
    });

    await assert.rejects(
      () => detector.classifyAsync("Fix the bug"),
      /Empty response/
    );
  });

  it("throws on malformed JSON in response", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: 'not json at all',
            },
          },
        ],
      }),
    });

    await assert.rejects(
      () => detector.classifyAsync("Fix the bug"),
      /No JSON object found/
    );
  });

  it("throws on invalid intent value", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"intent":"unknown_category","confidence":0.5}',
            },
          },
        ],
      }),
    });

    await assert.rejects(
      () => detector.classifyAsync("Do something"),
      /Invalid intent/
    );
  });

  it("throws on missing intent field", async () => {
    globalThis.fetch = async (): Promise<MockResponse> => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        ...VALID_GROQ_RESPONSE,
        choices: [
          {
            ...VALID_GROQ_RESPONSE.choices[0],
            message: {
              role: "assistant",
              content: '{"confidence":0.5}',
            },
          },
        ],
      }),
    });

    await assert.rejects(
      () => detector.classifyAsync("Do something"),
      /missing "intent" field/
    );
  });

  it("throws on network failure", async () => {
    globalThis.fetch = async () => {
      throw new Error("fetch failed: ENOTFOUND api.groq.com");
    };

    await assert.rejects(
      () => detector.classifyAsync("Fix the bug"),
      /fetch failed/
    );
  });

  it("throws on timeout", async () => {
    globalThis.fetch = async (_url: string, options?: RequestInit) => {
      // Simulate abort by throwing AbortError
      const signal = options?.signal;
      if (signal) {
        const aborted = new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
        // Trigger abort
        return aborted;
      }
      throw new Error('No signal provided');
    };

    await assert.rejects(
      () => detector.classifyAsync("Fix the bug"),
      /Groq API timeout/
    );
  });
});

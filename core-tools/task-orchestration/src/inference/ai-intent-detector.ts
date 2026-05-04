/**
 * AI-powered intent detector using Groq + Llama 3.1 8B Instant.
 *
 * Sends free-text to Groq's OpenAI-compatible /chat/completions endpoint
 * and classifies the intent into one of the 8 TaskIntent values.
 *
 * On any failure (network error, timeout, malformed response, invalid intent)
 * it throws, allowing a caller (e.g., FallbackIntentDetector) to fall through
 * to a manual/rule-based classifier.
 */

import type { IIntentClassifier, TaskIntent } from '../types';
import { INTENTS } from '../types';

export interface AiIntentDetectorConfig {
  /** Groq API key (required) */
  apiKey: string;
  /** Groq model name — default: "llama-3.1-8b-instant" */
  model?: string;
  /** Base URL — default: "https://api.groq.com/openai/v1" */
  baseUrl?: string;
  /** Request timeout in ms — default: 5000 */
  timeout?: number;
}

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_TIMEOUT = 5_000;

const SYSTEM_PROMPT = `\
You are an intent classifier for developer task descriptions. Your job is to classify
a single user message into exactly one of these intent categories.

Categories:
- fix: Bug fixing, debugging, repairing, patching, resolving issues
- refactor: Code cleanup, optimization, rewriting, simplifying, extracting, performance work
- test: Writing or running tests, adding specs, integration tests
- docs: Documentation, README, comments, annotating code
- deploy: Deployment, release, publishing, shipping, rolling out
- analyze: Analysis, investigation, code review, auditing, checking, profiling
- implement: Building new features, adding new functionality, new code
- general: Anything that doesn't fit the above — generic tasks, meta-work, etc.

Rules:
1. Respond ONLY with a single JSON object on one line: {"intent":"...","confidence":0.0-1.0}
2. The "intent" value must be exactly one of the category strings above (lowercase).
3. The "confidence" value is a float between 0.0 and 1.0.
4. No explanation, no markdown, no other text.`;

export class AiIntentDetector implements IIntentClassifier {
  private config: Required<AiIntentDetectorConfig>;

  constructor(config: AiIntentDetectorConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? DEFAULT_MODEL,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  classify(text: string): TaskIntent {
    // We wrap the async logic so the interface stays synchronous.
    // The actual call is delegated to the static async method.
    throw new Error(
      'AiIntentDetector.classify() is synchronous by interface contract. ' +
      'Use AiIntentDetector.classifyAsync(text) instead, or wrap with FallbackIntentDetector.'
    );
  }

  /**
   * Async variant of classify(). This is the real implementation.
   * FallbackIntentDetector calls this via Promise.resolve() chaining.
   */
  async classifyAsync(text: string): Promise<TaskIntent> {
    if (!text || text.trim().length === 0) {
      return 'analyze' as TaskIntent;
    }

    const url = `${this.config.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text.trim() },
          ],
          temperature: 0.1,       // Low temperature for deterministic classification
          max_tokens: 50,          // We only need a tiny response
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const body = await response.json() as GroqChatResponse;
      const content = body.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('Empty response from Groq API');
      }

      return this.parseResponse(content);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Groq API timeout after ${this.config.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse the JSON response from the LLM and validate against known intents.
   */
  private parseResponse(content: string): TaskIntent {
    // Try to extract JSON from the response (handles minor formatting issues)
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON object found in response: "${content.slice(0, 100)}"`);
    }

    let parsed: { intent?: string; confidence?: number };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(`Failed to parse JSON from response: "${jsonMatch[0].slice(0, 100)}"`);
    }

    if (!parsed.intent || typeof parsed.intent !== 'string') {
      throw new Error(`Response missing "intent" field: ${JSON.stringify(parsed)}`);
    }

    const intent = parsed.intent.toLowerCase().trim() as TaskIntent;
    if (!INTENTS.includes(intent as typeof INTENTS[number])) {
      throw new Error(
        `Invalid intent "${intent}" from AI. Must be one of: ${INTENTS.join(', ')}`
      );
    }

    return intent;
  }
}

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqChatChoice {
  index: number;
  message: GroqChatMessage;
  finish_reason: string;
}

interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

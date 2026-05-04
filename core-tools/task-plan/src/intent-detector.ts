/**
 * Unified Intent Detector — AI-first with manual fallback.
 *
 * Merges:
 * - task-orchestration/src/inference/ai-intent-detector.ts
 * - task-orchestration/src/inference/intent.ts (ManualIntentDetector)
 * - task-orchestration/src/inference/fallback-detector.ts
 *
 * Strategy: Try Groq/Llama AI → fallback to regex-based manual detection.
 * Fully synchronous when AI is unavailable (manual only).
 */

import type { IIntentClassifier, TaskIntent } from "./types.ts";
import { INTENTS } from "./types.ts";

// ─── AI Detector ────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_TIMEOUT = 5_000;

const SYSTEM_PROMPT = `\
You are an intent classifier for developer task descriptions. Classify each message into exactly one category.

Categories:
- fix: Bug fixing, debugging, repairing, patching, resolving issues
- refactor: Code cleanup, optimization, rewriting, simplifying, performance work
- test: Writing or running tests, adding specs, integration tests
- docs: Documentation, README, comments, annotating code
- deploy: Deployment, release, publishing, shipping, rolling out
- analyze: Analysis, investigation, code review, auditing, profiling
- implement: Building new features, adding new functionality
- general: Anything that doesn't fit above

Respond ONLY with {"intent":"...","confidence":0.0-1.0}. No other text.`;

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

  classify(_text: string): TaskIntent {
    throw new Error("Use classifyAsync() for AI-powered classification");
  }

  async classifyAsync(text: string): Promise<{ intent: TaskIntent; source: "ai" | "manual" }> {
    if (!text || text.trim().length === 0) {
      return { intent: "analyze", source: "manual" };
    }

    const url = `${this.config.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text.trim() },
          ],
          temperature: 0.1,
          max_tokens: 50,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const body = (await response.json()) as GroqResponse;
      const content = body.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("Empty response");

      return { intent: this.parseResponse(content), source: "ai" };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Groq timeout after ${this.config.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseResponse(content: string): TaskIntent {
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: "${content.slice(0, 100)}"`);

    let parsed: { intent?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(`Parse failed: "${jsonMatch[0].slice(0, 100)}"`);
    }

    if (!parsed.intent || typeof parsed.intent !== "string") {
      throw new Error(`Missing intent field: ${JSON.stringify(parsed)}`);
    }

    const intent = parsed.intent.toLowerCase().trim() as TaskIntent;
    if (!INTENTS.includes(intent as (typeof INTENTS)[number])) {
      throw new Error(`Invalid intent "${intent}"`);
    }
    return intent;
  }
}

interface GroqResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

export interface AiIntentDetectorConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeout?: number;
}

// ─── Manual Detector ────────────────────────────────────────────────────────

interface IntentPattern {
  intent: TaskIntent;
  primary: RegExp[];
  secondary: RegExp[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "fix",
    primary: [/^fix\s/i, /^resolve\s/i, /^debug\s/i, /^repair\s/i, /^hotfix\s/i, /^correct\s/i, /^patch\s/i],
    secondary: [/\bfix(ing|es)?\s/i, /\b(resolve|debug)\s/i, /\bbug(fix)?\b/i],
  },
  {
    intent: "refactor",
    primary: [/^refactor\s/i, /^clean\s(up\s)?/i, /^rewrite\s/i, /^optimize\s/i, /^improve\s/i, /^simplify\s/i, /^extract\s/i],
    secondary: [/\brefactor(ing|s)?\s/i, /\bclean(ing)?\s(up\s)?/i, /\brewrite\s/i, /\boptimize\s/i],
  },
  {
    intent: "test",
    primary: [/^test\s/i, /^add\s.*test/i, /^write\s.*test/i, /^unit\s.*test/i, /^integration\s.*test/i, /^spec\s/i],
    secondary: [/\btest(s|ing)?\s/i, /\btest(ing|ed)?\b/i, /\bspec(s)?\b/i],
  },
  {
    intent: "docs",
    primary: [/^document\s/i, /^write\s.*(doc|readme|guide)/i, /^update\s.*(doc|readme|guide)/i, /^comment\s/i, /^annotate\s/i],
    secondary: [/\bdocument(ation|ing)?\s/i, /\b(doc|docs|readme)\b/i, /\bcomment(s|ing)?\s/i],
  },
  {
    intent: "deploy",
    primary: [/^deploy\s/i, /^release\s/i, /^publish\s/i, /^ship\s/i, /^roll\s*out/i],
    secondary: [/\bdeploy(s|ing|ment)?\s/i, /\brelease(s|ing)?\s/i, /\bpublish(s|ing)?\s/i],
  },
  {
    intent: "analyze",
    primary: [/^analyze\s/i, /^investigate\s/i, /^review\s/i, /^check\s/i, /^audit\s/i, /^profile\s/i],
    secondary: [/\banalyz(e|ing|is)\s/i, /\binvestigat(e|ing)\s/i, /\breview(s|ing)?\s/i],
  },
  {
    intent: "implement",
    primary: [/^implement\s/i, /^add\s/i, /^create\s/i, /^build\s/i, /^introduce\s/i],
    secondary: [/\bimplement(s|ing)?\s/i, /\badd(s|ing)?\s/i, /\bcreate(s|ing)?\s/i],
  },
];

export class ManualIntentDetector implements IIntentClassifier {
  classify(text: string): TaskIntent {
    if (!text || text.trim().length === 0) return "analyze";

    const trimmed = text.trim();
    for (const p of INTENT_PATTERNS) {
      for (const r of p.primary) if (r.test(trimmed)) return p.intent;
    }
    for (const p of INTENT_PATTERNS) {
      for (const r of p.secondary) if (r.test(trimmed)) return p.intent;
    }

    if (/\b(error|fail|broken|crash|panic|bug)\b/i.test(trimmed)) return "fix";
    if (/\b(perf|performance|memory|speed|slow)\b/i.test(trimmed)) return "refactor";
    return "analyze";
  }
}

// ─── Fallback Chain ─────────────────────────────────────────────────────────

export class FallbackIntentDetector implements IIntentClassifier {
  private ai: AiIntentDetector;
  private manual: ManualIntentDetector;
  private preferManual = false;

  constructor(aiDetector: AiIntentDetector, manualDetector?: ManualIntentDetector) {
    this.ai = aiDetector;
    this.manual = manualDetector ?? new ManualIntentDetector();
  }

  classify(text: string): TaskIntent {
    return this.manual.classify(text);
  }

  async classifyAsync(text: string): Promise<{ intent: TaskIntent; source: "ai" | "manual" }> {
    if (this.preferManual) {
      return { intent: this.manual.classify(text), source: "manual" };
    }
    try {
      return await this.ai.classifyAsync(text);
    } catch (err) {
      console.debug("[IntentDetector] AI failed, falling back to manual:", (err as Error)?.message);
      return { intent: this.manual.classify(text), source: "manual" };
    }
  }

  setPreferManual(prefer: boolean): void {
    this.preferManual = prefer;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createIntentDetector(): { detector: FallbackIntentDetector; hasAI: boolean } {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    const ai = new AiIntentDetector({ apiKey: groqApiKey });
    return { detector: new FallbackIntentDetector(ai), hasAI: true };
  }
  const manual = new ManualIntentDetector();
  const stub = {} as AiIntentDetector;
  return { detector: new FallbackIntentDetector(stub, manual), hasAI: false };
}

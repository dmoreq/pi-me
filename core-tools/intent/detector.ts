/**
 * Centralized Intent Detector — AI-first with manual fallback.
 *
 * Single source of truth for ALL intent detection across pi-me extensions.
 * Extensions import from here instead of duplicating detection logic.
 *
 * Detector types:
 *   - TaskIntentDetector — classifies developer task descriptions (fix/refactor/test/docs/etc.)
 *   - CommandIntentDetector — classifies shell commands for subprocess orchestration
 *   - SessionIntentDetector — classifies the overall session goal from the first user message
 *
 * Strategy: Try Groq/Llama AI → fallback to regex-based manual detection.
 */

import type { IIntentClassifier, TaskIntent } from "./types.ts";
import { INTENTS, COMMAND_INTENTS, SESSION_INTENTS } from "./types.ts";

// Lazy import pi-telemetry to avoid hard dependency at parse time
let _telemetryNotified = false;
async function notifyFallback(detectorType: string, errorMsg: string): Promise<void> {
  if (_telemetryNotified) return; // Throttle: only notify once per session
  _telemetryNotified = true;
  try {
    const { getTelemetry } = await import("pi-telemetry");
    getTelemetry()?.notify(
      `🤖 ${detectorType} — AI intent detection failed, falling back to manual (${errorMsg})`,
      { severity: "warning" as const },
    );
  } catch {
    // Telemetry not available — silent
  }
}

// Reset the throttle on module reload
function resetFallbackNotified(): void {
  _telemetryNotified = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared AI infrastructure
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_TIMEOUT = 5_000;

interface GroqAiConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeout?: number;
}

interface GroqResponse {
  choices: Array<{ message: { content: string } }>;
}

/**
 * Make a Groq API call with the given system prompt and user text.
 * Returns the raw response content.
 */
async function callGroq(
  config: Required<GroqAiConfig>,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const url = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText.trim() },
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
    if (!content) throw new Error("Empty response from Groq");
    return content;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Groq timeout after ${config.timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse a JSON intent response from Groq, validating against allowed intents.
 */
function parseIntentResponse<T extends string>(
  content: string,
  validIntents: readonly T[],
): T {
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

  const intent = parsed.intent.toLowerCase().trim() as T;
  if (!(validIntents as readonly string[]).includes(intent)) {
    throw new Error(`Invalid intent "${intent}"`);
  }
  return intent;
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK INTENT DETECTOR — fix / refactor / test / docs / deploy / analyze
// ═══════════════════════════════════════════════════════════════════════════

const TASK_SYSTEM_PROMPT = `\
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

const INTENT_PATTERNS: Array<{
  intent: TaskIntent;
  primary: RegExp[];
  secondary: RegExp[];
}> = [
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

export class AiTaskIntentDetector implements IIntentClassifier {
  private config: Required<GroqAiConfig>;

  constructor(config: GroqAiConfig) {
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
    try {
      const content = await callGroq(this.config, TASK_SYSTEM_PROMPT, text);
      return { intent: parseIntentResponse(content, INTENTS), source: "ai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notifyFallback("TaskIntentDetector", msg);
      return { intent: new ManualTaskIntentDetector().classify(text), source: "manual" };
    }
  }
}

export class ManualTaskIntentDetector implements IIntentClassifier {
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

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND INTENT DETECTOR — classify shell commands for subprocess
// ═══════════════════════════════════════════════════════════════════════════

const COMMAND_SYSTEM_PROMPT = `\
You are a command intent classifier. Given a shell command, classify its purpose.

Categories:
- build: Compilation, bundling, transpilation, code generation
- test: Testing, running specs, coverage
- deploy: Deployment, release, docker push, cloud deploy
- lint: Linting, formatting, static analysis, type-checking
- install: Package installation, dependency management, setup
- analyze: Profiling, debugging, logging, diagnostics
- file_ops: File operations, git, mv, cp, rm, search, grep
- serve: Starting servers, dev servers, watchers
- cleanup: Cleaning, pruning, removing artifacts, garbage collection
- general: Anything else

Respond ONLY with {"intent":"...","confidence":0.0-1.0}. No other text.`;

const COMMAND_PRIMARY_PATTERNS: Array<{ intent: string; patterns: RegExp[] }> = [
  { intent: "build", patterns: [/^(npm run build|tsc|webpack|vite build|esbuild|make|cmake|cargo build|go build|dotnet build)/i] },
  { intent: "test", patterns: [/^(npm test|npm run test|jest|vitest|mocha|pytest|go test|cargo test|rspec)/i] },
  { intent: "deploy", patterns: [/^(deploy|kubectl|helm|docker push|serverless|sls deploy|terraform apply|aws|gcloud)/i] },
  { intent: "lint", patterns: [/^(eslint|biome|prettier.*check|ruff|golangci-lint|clippy)/i] },
  { intent: "install", patterns: [/^(npm install|yarn add|pip install|cargo add|go get|brew install|apt)/i] },
  { intent: "analyze", patterns: [/^(perf|strace|valgrind|top|htop|profiler|dtrace|lldb|gdb)/i] },
  { intent: "file_ops", patterns: [/^(git |ls |find |grep |rg |cat |mv |cp |rm |mkdir|touch)/i] },
  { intent: "serve", patterns: [/^(npm run dev|vite|nodemon|next dev|python.*runserver|uvicorn|pm2)/i] },
  { intent: "cleanup", patterns: [/^(rm -rf|clean|prune|docker.*prune|npm cache|cargo clean)/i] },
];

export type CommandIntent = (typeof COMMAND_INTENTS)[number];

export interface CommandIntentResult {
  intent: CommandIntent;
  source: "ai" | "manual";
}

export interface ICommandIntentClassifier {
  classify(cmd: string): CommandIntentResult | Promise<CommandIntentResult>;
}

export class AiCommandIntentDetector implements ICommandIntentClassifier {
  private config: Required<GroqAiConfig>;

  constructor(config: GroqAiConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? DEFAULT_MODEL,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  async classify(cmd: string): Promise<CommandIntentResult> {
    if (!cmd || cmd.trim().length === 0) {
      return { intent: "general", source: "manual" };
    }
    try {
      const content = await callGroq(this.config, COMMAND_SYSTEM_PROMPT, cmd);
      return { intent: parseIntentResponse(content, COMMAND_INTENTS), source: "ai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notifyFallback("CommandIntentDetector", msg);
      return manualClassifyCommand(cmd);
    }
  }
}

export class ManualCommandIntentDetector implements ICommandIntentClassifier {
  classify(cmd: string): CommandIntentResult {
    return manualClassifyCommand(cmd);
  }
}

function manualClassifyCommand(cmd: string): CommandIntentResult {
  if (!cmd || cmd.trim().length === 0) return { intent: "general", source: "manual" };
  for (const { intent, patterns } of COMMAND_PRIMARY_PATTERNS) {
    for (const r of patterns) {
      if (r.test(cmd.trim())) return { intent: intent as CommandIntent, source: "manual" };
    }
  }
  return { intent: "general", source: "manual" };
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION INTENT DETECTOR — classify overall session goal from first message
// ═══════════════════════════════════════════════════════════════════════════

const SESSION_SYSTEM_PROMPT = `\
You are a session intent classifier. Given the first user message of a coding session, classify the primary goal.

Categories:
- debug: Fixing bugs, debugging issues, troubleshooting
- feature: Building new features, adding functionality
- refactor: Refactoring, cleaning up, improving code quality
- explore: Exploring codebase, understanding architecture, investigation
- review: Code review, auditing, quality assessment
- test: Writing or running tests
- learn: Learning, onboarding, asking questions about the codebase
- ops: Operations, deployment, infrastructure, CI/CD
- general: Anything else

Respond ONLY with {"intent":"...","confidence":0.0-1.0}. No other text.`;

const SESSION_PRIMARY_PATTERNS: Array<{ intent: string; patterns: RegExp[] }> = [
  { intent: "debug", patterns: [/^fix\s/i, /^bug\b/i, /^(something|this|it)\s+(is\s+)?(broken|crash|failing)/i, /why (is|does|are|can)/i] },
  { intent: "feature", patterns: [/^implement\s/i, /^add\s/i, /^create\s/i, /^build\s/i, /^make\s/i, /new (feature|function|api|endpoint)/i] },
  { intent: "refactor", patterns: [/^refactor\s/i, /^clean\s/i, /^improve\s/i, /^rewrite\s/i, /^optimize\s/i, /^extract\s/i] },
  { intent: "explore", patterns: [/^(how|what|where|who|which)\s/i, /find\s/i, /search\s/i, /show\s/i, /explain\s/i] },
  { intent: "review", patterns: [/^review\s/i, /^audit\s/i, /^check\s/i, /^inspect\s/i, /code review/i] },
  { intent: "test", patterns: [/^test\s/i, /^write tests/i, /^add tests/i] },
  { intent: "learn", patterns: [/^what is/i, /^how do/i, /^learn/i, /^understand/i, /^onboarding/i] },
  { intent: "ops", patterns: [/^deploy\s/i, /^release\s/i, /^ci\b/i, /^cd\b/i, /^docker\s/i, /^k8s\b/i, /^publish\s/i] },
];

export type SessionIntent = (typeof SESSION_INTENTS)[number];

export interface SessionIntentResult {
  intent: SessionIntent;
  source: "ai" | "manual";
}

export interface ISessionIntentClassifier {
  classify(text: string): SessionIntentResult | Promise<SessionIntentResult>;
}

export class AiSessionIntentDetector implements ISessionIntentClassifier {
  private config: Required<GroqAiConfig>;

  constructor(config: GroqAiConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? DEFAULT_MODEL,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  async classify(text: string): Promise<SessionIntentResult> {
    if (!text || text.trim().length === 0) {
      return { intent: "general", source: "manual" };
    }
    try {
      const content = await callGroq(this.config, SESSION_SYSTEM_PROMPT, text);
      return { intent: parseIntentResponse(content, SESSION_INTENTS), source: "ai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notifyFallback("SessionIntentDetector", msg);
      return manualClassifySession(text);
    }
  }
}

export class ManualSessionIntentDetector implements ISessionIntentClassifier {
  classify(text: string): SessionIntentResult {
    return manualClassifySession(text);
  }
}

function manualClassifySession(text: string): SessionIntentResult {
  if (!text || text.trim().length === 0) return { intent: "general", source: "manual" };
  const trimmed = text.trim();
  for (const { intent, patterns } of SESSION_PRIMARY_PATTERNS) {
    for (const r of patterns) {
      if (r.test(trimmed)) return { intent: intent as SessionIntent, source: "manual" };
    }
  }
  return { intent: "general", source: "manual" };
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK CHAIN — AI first, manual fallback
// ═══════════════════════════════════════════════════════════════════════════

export class FallbackTaskIntentDetector implements IIntentClassifier {
  private ai: AiTaskIntentDetector | null;
  private manual: ManualTaskIntentDetector;
  private preferManual = false;

  constructor(aiDetector: AiTaskIntentDetector | null, manualDetector?: ManualTaskIntentDetector) {
    this.ai = aiDetector;
    this.manual = manualDetector ?? new ManualTaskIntentDetector();
  }

  classify(text: string): TaskIntent {
    return this.manual.classify(text);
  }

  async classifyAsync(text: string): Promise<{ intent: TaskIntent; source: "ai" | "manual" }> {
    if (this.preferManual || !this.ai) {
      return { intent: this.manual.classify(text), source: "manual" };
    }
    try {
      return await this.ai.classifyAsync(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.debug("[TaskIntentDetector] AI failed, falling back to manual:", msg);
      await notifyFallback("FallbackTaskIntentDetector", msg);
      return { intent: this.manual.classify(text), source: "manual" };
    }
  }

  setPreferManual(prefer: boolean): void {
    this.preferManual = prefer;
  }
}

export class FallbackCommandIntentDetector implements ICommandIntentClassifier {
  private ai: AiCommandIntentDetector | null;
  private manual: ManualCommandIntentDetector;

  constructor(aiDetector: AiCommandIntentDetector | null, manualDetector?: ManualCommandIntentDetector) {
    this.ai = aiDetector;
    this.manual = manualDetector ?? new ManualCommandIntentDetector();
  }

  classify(cmd: string): CommandIntentResult | Promise<CommandIntentResult> {
    if (this.ai) {
      try {
        return this.ai.classify(cmd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        (async () => await notifyFallback("FallbackCommandIntentDetector", msg))();
        return this.manual.classify(cmd);
      }
    }
    return this.manual.classify(cmd);
  }
}

export class FallbackSessionIntentDetector implements ISessionIntentClassifier {
  private ai: AiSessionIntentDetector | null;
  private manual: ManualSessionIntentDetector;

  constructor(aiDetector: AiSessionIntentDetector | null, manualDetector?: ManualSessionIntentDetector) {
    this.ai = aiDetector;
    this.manual = manualDetector ?? new ManualSessionIntentDetector();
  }

  classify(text: string): SessionIntentResult | Promise<SessionIntentResult> {
    if (this.ai) {
      try {
        return this.ai.classify(text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        (async () => await notifyFallback("FallbackSessionIntentDetector", msg))();
        return this.manual.classify(text);
      }
    }
    return this.manual.classify(text);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

function buildGroqConfig(): { apiKey: string } | null {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) return { apiKey: groqApiKey };
  return null;
}

// Expose reset for testing
if (typeof globalThis !== "undefined") {
  (globalThis as any).__resetIntentFallbackNotification?.();
}

/**
 * Create a task intent detector (for task-plan and code-review).
 * Tries Groq AI first, falls back to regex-based manual detection.
 */
export function createTaskIntentDetector(): {
  detector: FallbackTaskIntentDetector;
  hasAI: boolean;
} {
  const groqConfig = buildGroqConfig();
  if (groqConfig) {
    const ai = new AiTaskIntentDetector(groqConfig);
    return { detector: new FallbackTaskIntentDetector(ai), hasAI: true };
  }
  return {
    detector: new FallbackTaskIntentDetector(null),
    hasAI: false,
  };
}

/**
 * Create a command intent detector (for subprocess-orchestrator).
 * Tries Groq AI first, falls back to regex-based manual detection.
 */
export function createCommandIntentDetector(): {
  detector: FallbackCommandIntentDetector;
  hasAI: boolean;
} {
  const groqConfig = buildGroqConfig();
  if (groqConfig) {
    const ai = new AiCommandIntentDetector(groqConfig);
    return { detector: new FallbackCommandIntentDetector(ai), hasAI: true };
  }
  return {
    detector: new FallbackCommandIntentDetector(null),
    hasAI: false,
  };
}

/**
 * Create a session intent detector (for welcome/session-lifecycle).
 * Tries Groq AI first, falls back to regex-based manual detection.
 */
export function createSessionIntentDetector(): {
  detector: FallbackSessionIntentDetector;
  hasAI: boolean;
} {
  const groqConfig = buildGroqConfig();
  if (groqConfig) {
    const ai = new AiSessionIntentDetector(groqConfig);
    return { detector: new FallbackSessionIntentDetector(ai), hasAI: true };
  }
  return {
    detector: new FallbackSessionIntentDetector(null),
    hasAI: false,
  };
}

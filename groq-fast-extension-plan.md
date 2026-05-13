# groq-fast Extension Plan

## Overview

A standalone pi extension that detects `GROQ_API_KEY` from the environment and
puts `llama-3.1-8b-instant` to work on low-stakes, high-frequency tasks inside
pi's agent loop. No core package changes. No interactive login. Free tier only.

---

## 1. Free-Tier Constraints for `llama-3.1-8b-instant`

Groq's published free-tier limits for this model (as of 2025):

| Limit | Value |
|---|---|
| Requests per minute (RPM) | 30 |
| Requests per day (RPD) | 14 400 |
| Tokens per minute (TPM) | 131 072 |
| Tokens per day (TPD) | ~500 000 |
| Max context window | 131 072 tokens |
| Max output tokens | 8 192 tokens |

**Design implications:**

- Every call to the small model must stay well under 8 192 output tokens.
  In practice, structured micro-tasks (classification, title generation) need
  fewer than 200 output tokens. That is fine.
- Input must be aggressively trimmed. Never forward raw session history or
  large tool outputs verbatim — always truncate or summarise to a budget before
  sending (target: ≤ 2 000 input tokens per call).
- The RPM limit of 30 means one call every 2 seconds at saturation. The
  extension must enforce a local rate-limiter so it never fires on every token
  event, only on coarse lifecycle events (agent_end, session_compact, etc.).
- All calls are fire-and-forget or best-effort: if the rate limit is hit, log
  a debug notice and skip — never block the main agent loop.

---

## 2. Key Detection

The extension reads `GROQ_API_KEY` from the environment only. No stored file,
no interactive prompt, no OAuth flow. If the key is absent, all hooks are
no-ops and the provider registration is skipped.

```ts
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) return; // extension does nothing without the key
```

This keeps the extension safe to ship globally: users without the key are
completely unaffected.

---

## 3. Provider Registration

Groq uses the `openai-completions` API. The model is already in
`packages/ai/src/models.generated.ts` under the built-in `"groq"` provider.
The extension registers a **separate named provider** (`"groq-fast"`) so its
models are isolated from any user-configured Groq models. This avoids
polluting the main model selector with the micro-task model.

```ts
pi.registerProvider("groq-fast", {
  name: "Groq Fast (extension)",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: apiKey,
  api: "openai-completions",
  models: [
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B Instant",
      reasoning: false,
      input: ["text"],
      cost: { input: 0.05, output: 0.08, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 131072,
      maxTokens: 8192,
    },
  ],
});
```

The extension never calls `ctx.setModel()`. It keeps a direct reference to the
model object and calls `completeSimple()` from `@earendil-works/pi-ai` directly,
bypassing the main agent's model selector entirely.

---

## 4. Use Cases (Ordered by Value vs. Risk)

### 4.1 Session Name Generation  ← Start here

**Event:** `session_compact`  
**Trigger:** After the agent compacts the context. The compaction summary is
available and is a tight natural-language digest — ideal input.  
**Task:** Ask the small model for a ≤ 6-word session title. Call
`pi.setSessionName(title)`.  
**Token budget:** ~400 input (compaction summary only), ~20 output.  
**Risk:** Zero. If it fails or returns garbage, the session name stays as-is.

```
System: "Return a 6-word or fewer title for this coding session. No quotes."
User:   <compaction summary text, truncated to 400 tokens>
```

### 4.2 Session Name on First Turn End  ← Easy win

**Event:** `turn_end` where `turnIndex === 0`  
**Trigger:** After the very first assistant reply. At this point the user's
opening message and the first response exist.  
**Task:** Generate a short session title from the opening exchange.  
**Token budget:** ~600 input, ~20 output.  
**Risk:** Zero. Same as 4.1.

```
System: "Return a 6-word or fewer title for this coding session. No quotes."
User:   User: <first user message>\nAssistant: <first 200 chars of reply>
```

### 4.3 Prompt Intent Classification Before Agent Start

**Event:** `before_agent_start`  
**Trigger:** After user submits input, before the main LLM is called.  
**Task:** Classify the user's prompt into one of:
`question | code_edit | research | trivial | file_op`

Use the result to:
- Set a richer working message via `ctx.ui.setWorkingMessage()` (e.g., "Editing…"
  vs "Researching…") so the spinner is informative.
- Skip tool loading hints in the system prompt for `trivial` / `question` types
  (future: could call `ctx.setActiveTools([])` for pure Q&A turns — out of
  scope for v1 but enabled by the classification).

**Token budget:** ~200 input (user prompt only, no history), ~10 output.  
**Risk:** Low. The classification result is advisory only in v1. Never block or
modify the main call based on it.

```
System: "Classify the user message as exactly one of:
         question | code_edit | research | trivial | file_op
         Reply with only the label."
User:   <user prompt, truncated to 300 chars>
```

### 4.4 Tool Output Summarization Before Main Model

**Event:** `tool_result` where `event.toolName === "bash"` or `"read"` and
`content[0].text.length > 8000`  
**Trigger:** Large bash output or file read result.  
**Task:** Summarize to ≤ 500 tokens before the main model sees it. Replace
`event.content` in the result via returning a `ToolResultEventResult`.  
**Token budget:** ~3 000 input (truncated raw output), ~500 output.  
**Risk:** Medium. Summarization can lose detail. Apply only to outputs above
a generous threshold (e.g., > 10 000 characters) to avoid degrading useful
precision. In v1, add a debug footer: `[summarized by groq-fast]` so the user
can see it happened.

> **Note:** This is the highest-impact use case for reducing primary-model
> token spend, but also the riskiest for task quality. Implement after 4.1–4.3
> are stable and tested.

---

## 5. Rate Limiter Design

A simple token-bucket limiter within the extension. Shared across all use
cases. 30 RPM = 1 request per 2 000 ms.

```ts
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  constructor(rpm: number) {
    this.maxTokens = rpm;
    this.refillIntervalMs = (60_000 / rpm);  // ms per token
    this.tokens = rpm;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refilled = Math.floor(elapsed / this.refillIntervalMs);
    if (refilled > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + refilled);
      this.lastRefill = now;
    }
    if (this.tokens <= 0) return false;
    this.tokens--;
    return true;
  }
}

const limiter = new RateLimiter(30);
```

Every use case calls `limiter.tryConsume()` before firing a request. If it
returns `false`, the use case is silently skipped for that event.

---

## 6. Token Truncation Helper

Every use case must stay inside the 2 000-input-token budget per call.
Rough rule: 1 token ≈ 4 characters.

```ts
function truncate(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[truncated]";
}
```

Use `maxChars = 800` for classification, `maxChars = 1600` for title
generation, `maxChars = 12000` for tool output summarization.

---

## 7. `completeSimple` Call Pattern

The extension uses `completeSimple` from `@earendil-works/pi-ai` directly.
This function drives a single non-streaming completion and returns the full
`AssistantMessage`. It respects `options.apiKey` and `options.signal`.

```ts
import { completeSimple } from "@earendil-works/pi-ai";

async function callFast(
  systemPrompt: string,
  userText: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!limiter.tryConsume()) return undefined;

  try {
    const message = await completeSimple(fastModel, {
      systemPrompt,
      messages: [{ role: "user", content: userText, timestamp: Date.now() }],
    }, {
      apiKey,
      maxTokens: 200,
      signal,
    });

    if (message.stopReason === "error" || message.stopReason === "aborted") {
      return undefined;
    }

    const textBlock = message.content.find(b => b.type === "text");
    return textBlock?.text?.trim();
  } catch {
    return undefined;
  }
}
```

`fastModel` is the `Model` object returned from `ctx.modelRegistry` by
looking up `provider: "groq-fast"` + `id: "llama-3.1-8b-instant"`.

---

## 8. File Layout

```
.pi/extensions/groq-fast/
  index.ts          ← single extension entry point
  package.json      ← { "name": "groq-fast", "pi": { "extensions": ["index.ts"] } }
```

The extension is loaded automatically from `.pi/extensions/` by pi's
`discoverAndLoadExtensions()`. No CLI flags needed.

### `package.json`

```json
{
  "name": "groq-fast",
  "version": "0.1.0",
  "pi": {
    "extensions": ["index.ts"]
  }
}
```

---

## 9. Full `index.ts` Skeleton

```ts
import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { completeSimple } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_NAME = "groq-fast";
const MODEL_ID      = "llama-3.1-8b-instant";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const FREE_RPM      = 30;

// ── Rate limiter ─────────────────────────────────────────────────────────────

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly max: number;
  private readonly msPerToken: number;

  constructor(rpm: number) {
    this.max = rpm;
    this.msPerToken = 60_000 / rpm;
    this.tokens = rpm;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    const now = Date.now();
    const refilled = Math.floor((now - this.lastRefill) / this.msPerToken);
    if (refilled > 0) {
      this.tokens = Math.min(this.max, this.tokens + refilled);
      this.lastRefill += refilled * this.msPerToken;
    }
    if (this.tokens <= 0) return false;
    this.tokens--;
    return true;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars) + "\n[truncated]";
}

// ── Extension factory ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return; // silent no-op when key is absent

  const limiter = new RateLimiter(FREE_RPM);
  let fastModel: Model<"openai-completions"> | undefined;

  // Register isolated provider so the main model selector is not polluted
  pi.registerProvider(PROVIDER_NAME, {
    name: "Groq Fast (extension)",
    baseUrl: GROQ_BASE_URL,
    apiKey,
    api: "openai-completions",
    models: [
      {
        id: MODEL_ID,
        name: "Llama 3.1 8B Instant",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.05, output: 0.08, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131_072,
        maxTokens: 8_192,
      },
    ],
  });

  // Resolve model ref once the registry is ready
  pi.on("session_start", (_event, ctx) => {
    const all = ctx.modelRegistry.getAll();
    fastModel = all.find(
      m => m.provider === PROVIDER_NAME && m.id === MODEL_ID,
    ) as Model<"openai-completions"> | undefined;
  });

  // ── callFast ────────────────────────────────────────────────────────────────

  async function callFast(
    system: string,
    user: string,
    maxOutputTokens = 200,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    if (!fastModel) return undefined;
    if (!limiter.tryConsume()) return undefined;

    try {
      const message = await completeSimple(
        fastModel,
        {
          systemPrompt: system,
          messages: [{ role: "user", content: user, timestamp: Date.now() }],
        },
        { apiKey, maxTokens: maxOutputTokens, signal },
      );
      if (message.stopReason === "error" || message.stopReason === "aborted") return undefined;
      const block = message.content.find(b => b.type === "text");
      return block?.text?.trim() ?? undefined;
    } catch {
      return undefined;
    }
  }

  // ── Use case 1: Session name after first turn ───────────────────────────────

  pi.on("turn_end", async (event, ctx) => {
    if (event.turnIndex !== 0) return;
    if (pi.getSessionName()) return; // already named

    const msg = event.message;
    if (msg.role !== "assistant") return;
    const replyText =
      "content" in msg && Array.isArray(msg.content)
        ? msg.content.find((b: any) => b.type === "text")?.text ?? ""
        : "";

    // Use only the first user message from session
    const entries = ctx.sessionManager.getEntries();
    const firstUser = entries
      .map((e: any) => e.message)
      .find((m: any) => m?.role === "user");
    const userText =
      firstUser && typeof firstUser.content === "string"
        ? firstUser.content
        : "";

    const input = truncate(
      `User: ${userText}\nAssistant: ${replyText}`,
      1_600,
    );

    const title = await callFast(
      "Return a 6-word or fewer title for this coding session. No punctuation, no quotes.",
      input,
      30,
      ctx.signal,
    );

    if (title && title.length < 80) {
      pi.setSessionName(title);
    }
  });

  // ── Use case 2: Session name refresh after compaction ──────────────────────

  pi.on("session_compact", async (event, ctx) => {
    const entry = event.compactionEntry;
    // Extract the compaction summary text from the entry content
    const summary =
      "message" in entry && entry.message && "content" in entry.message
        ? (Array.isArray(entry.message.content)
            ? entry.message.content.find((b: any) => b.type === "text")?.text
            : undefined) ?? ""
        : "";

    if (!summary) return;

    const title = await callFast(
      "Return a 6-word or fewer title for this coding session. No punctuation, no quotes.",
      truncate(summary, 1_600),
      30,
      ctx.signal,
    );

    if (title && title.length < 80) {
      pi.setSessionName(title);
    }
  });

  // ── Use case 3: Prompt classification → informative working message ─────────

  pi.on("before_agent_start", async (event, ctx) => {
    const label = await callFast(
      "Classify the user message as exactly one of:\n" +
        "question | code_edit | research | trivial | file_op\n" +
        "Reply with only the label, nothing else.",
      truncate(event.prompt, 800),
      10,
      ctx.signal,
    );

    if (!label) return;

    const labels: Record<string, string> = {
      question:  "Thinking…",
      code_edit: "Editing…",
      research:  "Researching…",
      trivial:   "Answering…",
      file_op:   "Working…",
    };

    const working = labels[label];
    if (working) ctx.ui.setWorkingMessage(working);
  });

  // ── Use case 4: Large tool output summarization (opt-in, behind threshold) ──

  const SUMMARIZE_THRESHOLD = 12_000; // characters

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "bash" && event.toolName !== "read") return;

    const text =
      event.content[0]?.type === "text" ? event.content[0].text : "";
    if (text.length < SUMMARIZE_THRESHOLD) return;

    const summary = await callFast(
      "Summarize the following command output concisely, preserving key facts, " +
        "file paths, error messages, and numbers. Maximum 400 words.",
      truncate(text, 12_000),
      500,
      ctx.signal,
    );

    if (!summary) return;

    return {
      content: [
        {
          type: "text" as const,
          text: `${summary}\n\n[summarized by groq-fast — original ${text.length} chars]`,
        },
      ],
    };
  });
}
```

---

## 10. Implementation Phases

### Phase 1 — Foundation (no risk to main loop)
- [ ] Create `.pi/extensions/groq-fast/` with `package.json` and `index.ts`
- [ ] Implement key detection, provider registration, `session_start` model resolve
- [ ] Implement `RateLimiter` and `callFast()` helper
- [ ] Implement use case 1 (session name on first turn)
- [ ] Implement use case 2 (session name after compaction)
- [ ] Manual test: start sessions, verify names appear in session selector

### Phase 2 — Classification
- [ ] Implement use case 3 (`before_agent_start` classification → working message)
- [ ] Test with varied prompts; verify spinner label changes
- [ ] Verify it does not add latency to the main agent call
  (classification is fire-and-forget; `setWorkingMessage` may arrive after
  the main call already started — that is acceptable)

### Phase 3 — Tool output summarization (validate carefully)
- [ ] Implement use case 4 with conservative threshold (12 000 chars)
- [ ] Add `[summarized by groq-fast]` footer so the user sees it happened
- [ ] Test with large `cat` and `bash` outputs
- [ ] Watch for cases where summarization loses critical info (error codes,
  paths, line numbers) and raise the threshold or disable per tool name if needed

---

## 11. What Stays Out of Scope

| Idea | Reason excluded |
|---|---|
| Interactive `/groq-login` command | Key comes from env only; no storage needed |
| Switching the main model to groq | Extension never calls `ctx.setModel()` |
| Using the small model for code edits | Quality too low; defeats the purpose of pi |
| Streaming output from the small model | Not needed for any micro-task |
| Adding `llama-3.1-8b-instant` to the main model selector | Handled by the built-in `groq` provider already; extension uses isolated `groq-fast` |
| Token-per-day tracking | Out of scope for v1; Groq returns 429 when exceeded |

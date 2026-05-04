# Implementation Plan — v0.3.0 Agent-Automated Extension Suite

> **Objective:** Merge 6 extension groups, remove 3 dead extensions, add agent-automation via
> pi-telemetry, refactor to DRY/SOLID, fix all tests (currently 11 failing), reach 85 %+
> coverage, and publish v0.3.0.
>
> **Current baseline:** 464 passing / 23 failing (all in task-orchestration — jest vs node:test
> runner mismatch). 239 TS files, 51 K LOC.
>
> **Owner cadence:** Each phase is a self-contained PR on a feature branch.
> Phases 0–2 are prerequisites; Phases 3–7 are parallel-safe.

---

## Guiding Principles

| Principle | How it applies |
|-----------|---------------|
| **Single Responsibility** | Each class does one thing: `TranscriptBuilder` only builds transcripts; `PlanDAG` only resolves dependencies |
| **Open/Closed** | `RunnerRegistry` accepts new formatters without touching existing runners; `ExecutorRegistry` accepts new subprocess executors |
| **Liskov Substitution** | All `CodeRunner` implementations are interchangeable; all `SubprocessExecutor` implementations honour the same contract |
| **Interface Segregation** | `ExtensionLifecycle` hooks are all optional overrides — subclasses opt in only to what they need |
| **Dependency Inversion** | Extensions depend on `ExtensionAPI` and domain interfaces, not concrete implementations |
| **DRY** | `TranscriptBuilder`, `PromptBuilder`, `HttpClient`, `FileTracker`, `PlanDAG` are single canonical implementations referenced everywhere |
| **Agent-first** | Every feature must have an automated trigger before it has a user command |

---

## Phase 0 — Shared Foundation (prerequisite for all other phases)

> Branch: `feat/shared-foundation`
> Commit: `refactor(shared): extract lifecycle base, telemetry helper, split notify-utils`

### 0-A — Split `shared/notify-utils.ts` (currently 20 K lines)

The file currently mixes four unrelated concerns. Split it surgically with
**no logic changes** — only moves.

| New file | Moves from notify-utils | Exported names |
|----------|------------------------|----------------|
| `shared/audio.ts` | `playBeep`, `speakMessage`, `checkSayAvailable`, `isSayAvailable`, `loadPronunciations`, `applyPronunciations`, `BEEP_SOUNDS`, `SAY_MESSAGES` | same |
| `shared/terminal.ts` | `detectTerminalInfo`, `bringTerminalToFront`, `displayOSXNotification`, `isTerminalInBackground`, `checkTerminalNotifierAvailable`, `isTerminalNotifierAvailable` | same |
| `shared/bg-notify-config.ts` | `getBackgroundNotifyConfig`, `getBackgroundNotifyConfigSync`, `notifyOnConfirm`, `BackgroundNotifySchema` | same |
| `shared/notify-utils.ts` | Keep only: re-export everything from the three new files + `getCurrentDirName`, `replaceMessageTemplates` | unchanged surface |

**Import update sweep** (use `search` then batch-edit):
```
shared/index.ts       → add exports from audio, terminal, bg-notify-config
foundation/safe-ops.ts → update imports (uses detectTerminalInfo, bringTerminalToFront, ...)
```

**Tests:** No new tests needed — logic unchanged. Run `npm test` to confirm green.

---

### 0-B — `shared/lifecycle.ts` — ExtensionLifecycle base class

```typescript
// shared/lifecycle.ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";

/** All pi lifecycle event hook signatures, all optional. */
export interface LifecycleHooks {
  onSessionStart?(event: any, ctx: ExtensionContext): Promise<void>;
  onSessionShutdown?(event: any, ctx: ExtensionContext): Promise<void>;
  onInput?(event: any, ctx: ExtensionContext): Promise<any>;
  onTurnStart?(event: any, ctx: ExtensionContext): Promise<void>;
  onTurnEnd?(event: any, ctx: ExtensionContext): Promise<void>;
  onAgentStart?(event: any, ctx: ExtensionContext): Promise<void>;
  onAgentEnd?(event: any, ctx: ExtensionContext): Promise<void>;
  onToolCall?(event: any, ctx: ExtensionContext): Promise<any>;
  onToolResult?(event: any, ctx: ExtensionContext): Promise<void>;
}

export abstract class ExtensionLifecycle implements LifecycleHooks {
  abstract readonly name: string;
  abstract readonly version: string;

  protected get t() { return getTelemetry(); }

  constructor(protected readonly pi: ExtensionAPI) {}

  /** Call from umbrella entry after construction. */
  register(): void {
    const t = this.t;
    if (t) {
      t.register({
        name: this.name,
        version: this.version,
        description: this.description ?? this.name,
        tools: this.tools ?? [],
        events: this.events ?? [],
      });
      t.heartbeat(this.name);
    }
    // Wire only the hooks the subclass actually defines
    const HOOKS: Array<[keyof LifecycleHooks, string]> = [
      ["onSessionStart",   "session_start"],
      ["onSessionShutdown","session_shutdown"],
      ["onInput",          "input"],
      ["onTurnStart",      "turn_start"],
      ["onTurnEnd",        "turn_end"],
      ["onAgentStart",     "agent_start"],
      ["onAgentEnd",       "agent_end"],
      ["onToolCall",       "tool_call"],
      ["onToolResult",     "tool_result"],
    ];
    for (const [method, event] of HOOKS) {
      if (typeof (this as any)[method] === "function") {
        this.pi.on(event as any, (this as any)[method].bind(this));
      }
    }
  }

  /** Override to declare registered tools for telemetry attribution. */
  protected readonly tools?: string[];
  /** Override to set description shown in telemetry dashboard. */
  protected readonly description?: string;
  /** Override to declare subscribed events. */
  protected readonly events?: string[];

  /** Send a user-visible telemetry badge notification. */
  protected notify(
    message: string,
    opts?: { severity?: "info"|"success"|"warning"|"error"; badge?: { text: string; variant?: string } }
  ): void {
    this.t?.notify(message, {
      package: this.name,
      severity: opts?.severity ?? "info",
      ...(opts?.badge ? { badge: { text: opts.badge.text, variant: (opts.badge.variant ?? "info") as any } } : {}),
    });
  }

  /** Record a domain event to telemetry collector (future dashboard use). */
  protected track(event: string, _data?: Record<string, unknown>): void {
    // pi-telemetry v0.2 does not expose a custom-event API yet.
    // Heartbeat is the best proxy: it updates lastHeartbeat + resets stale status.
    this.t?.heartbeat(this.name);
    void event; // suppress unused warning until the API is available
  }
}
```

**Test — `shared/lifecycle.test.ts`** (Node test runner, no jest):
```
describe ExtensionLifecycle
  ✔ register() wires hooks that are defined on the subclass
  ✔ register() does NOT wire hooks that are undefined
  ✔ notify() delegates to getTelemetry().notify with correct package name
  ✔ track() calls heartbeat without throwing when telemetry is null
  ✔ subclass with no hooks registers cleanly (zero hooks wired)
  ✔ multiple calls to register() are safe (idempotent check)
```

---

### 0-C — `shared/telemetry-helpers.ts`

Thin helpers that wrap the real pi-telemetry API to avoid boilerplate in every
module. Not a re-implementation — just ergonomic wrappers.

```typescript
import { getTelemetry } from "pi-telemetry";
import type { PackageRegistration } from "pi-telemetry/src/types.ts";

/** Register a package and send initial heartbeat in one call. */
export function registerPackage(reg: PackageRegistration): void {
  const t = getTelemetry();
  if (!t) return;
  t.register(reg);
  t.heartbeat(reg.name);
}

/** Send a badge notification only when telemetry is active. */
export function telemetryNotify(message: string, opts?: Parameters<ReturnType<typeof getTelemetry>["notify"]>[1]): void {
  getTelemetry()?.notify(message, opts);
}
```

**Test — `shared/telemetry-helpers.test.ts`**:
```
  ✔ registerPackage is a no-op when getTelemetry() returns null
  ✔ telemetryNotify is a no-op when getTelemetry() returns null
```

---

### 0-D — Extract inlined code from umbrella files

Three blocks of logic are currently copy-pasted inside index files. Extract
them to proper modules so they can be independently tested.

| Code block | Currently in | Move to | Lines |
|-----------|--------------|---------|-------|
| Session naming | `session-lifecycle/index.ts` (lines 32-63) | `session-lifecycle/session-name.ts` | ~51 |
| Skill args substitution | `session-lifecycle/index.ts` (lines 65-186) | `session-lifecycle/skill-args.ts` | ~120 |
| Clipboard tool | `core-tools/index.ts` (lines 44-103) | `core-tools/clipboard.ts` | ~94 |

Both umbrella index files import from the new paths; logic is unchanged.

**Tests:**
- `session-lifecycle/session-name.test.ts`: test `sessionNameFromMessage` pure fn — 6 cases
- `session-lifecycle/skill-args.test.ts`: test `parseCommandArgs` + `substituteArgs` — already
  have full coverage in the existing inlined tests; port them to the new path
- `core-tools/clipboard.test.ts`: test `copyToClipboard` (mock stdout.write) — 3 cases

---

## Phase 1 — Fix Failing Tests (prerequisite before any merge)

> Branch: `fix/test-runner-compat`
> Commit: `fix(tests): migrate task-orchestration from jest to node:test runner`

All 11 `task-orchestration` test files use `@jest/globals` (`describe`, `it`,
`expect`) but the project's test runner is `tsx --test` (Node.js built-in).
This is a pure test-file rewrite with no logic changes.

### 1-A — Convert each file

For each file in `core-tools/task-orchestration/tests/`:
1. Replace `import { describe, it, expect } from '@jest/globals'`
   with `import { describe, it } from 'node:test'; import assert from 'node:assert/strict'`
2. Replace `expect(x).toBe(y)` → `assert.strictEqual(x, y)`
3. Replace `expect(x).toEqual(y)` → `assert.deepStrictEqual(x, y)`
4. Replace `expect(x).toHaveLength(n)` → `assert.strictEqual(x.length, n)`
5. Replace `expect(x).toThrow(/pat/)` → wrap in try/catch or use `assert.throws`
6. Replace `expect(fn).not.toThrow()` → `assert.doesNotThrow(fn)`
7. Replace `expect(x).toBeTruthy()` → `assert.ok(x)`
8. Replace `expect(x).toBeUndefined()` → `assert.strictEqual(x, undefined)`
9. Replace `expect(x).toContain(y)` → `assert.ok(x.includes(y))`

Files to convert (11 total):
```
tests/core/capture.test.ts
tests/core/dependency.test.ts
tests/core/executor.test.ts
tests/core/task.test.ts
tests/inference/intent.test.ts
tests/integration/full-flow.test.ts
tests/integration/tools.test.ts
tests/persistence/state.test.ts
tests/ui/notification-inbox.test.ts
tests/ui/progress-widget.test.ts
tests/ui/renderer.test.ts
```

### 1-B — Remove task-orchestration's nested package

`core-tools/task-orchestration/` has its own `package.json` + `node_modules`
with Jest as devDep. After converting to node:test:
- Delete `core-tools/task-orchestration/package.json`
- Delete `core-tools/task-orchestration/node_modules/`
- Delete `core-tools/task-orchestration/tsconfig.json`

Root-level `npm test` will pick up the converted test files.

**Validation:** `npm test 2>&1 | grep "✖ " | wc -l` → must output `0`.

---

## Phase 2 — Context Intelligence Merge

> Branch: `feat/context-intel`
> Commit: `feat(session-lifecycle): merge handoff+auto-compact+session-recap → context-intel`
> Profile: dev, full

### Why merge

All three call an LLM on conversation transcripts, react to the same lifecycle
events, and share no code despite doing essentially the same thing.

| | handoff | auto-compact | session-recap |
|-|---------|-------------|---------------|
| Builds transcript | ✓ (full history) | ✗ | ✓ (since last user msg) |
| Calls LLM | ✓ | ✗ (uses ctx.compact) | ✓ |
| Reacts to turn_end | ✗ | ✓ | ✓ |
| Reacts to session_start | ✗ | ✓ (reset) | ✓ (attach focus, resume recap) |
| Has UI command | `/handoff` | `/compact-config` | `/recap` |
| Shared logic | — | — | — |

### 2-A — New file tree

```
session-lifecycle/context-intel/
├── index.ts              # ContextIntelExtension extends ExtensionLifecycle
├── types.ts              # ContextIntelConfig, RecapReason
├── transcript-builder.ts # TranscriptBuilder class (DRY)
├── prompt-builder.ts     # PromptBuilder class (DRY)
├── compactor.ts          # Compactor class (wraps ctx.compact logic)
├── recapper.ts           # Recapper class (focus + idle logic)
├── handoff.ts            # Handoff class (LLM + editor)
└── config.ts             # loadContextIntelConfig()
```

### 2-B — `transcript-builder.ts`

Extract from `session-recap/index.ts`:
- `extractText(content)` → private helper
- `extractToolCalls(content)` → private helper
- `buildRecentTranscript(entries, fromLastUser)` → `TranscriptBuilder.buildTranscript(entries, opts)`
- `hasMeaningfulActivity(entries)` → `TranscriptBuilder.hasMeaningfulActivity(entries)`

New methods:
- `TranscriptBuilder.extractFilePaths(entries): string[]` — scans entries for paths
  mentioned in write/edit tool calls (feeds handoff's "files involved" section)
- `TranscriptBuilder.countToolCalls(entries, name): number` — used by automation triggers

**Test — `context-intel/tests/transcript-builder.test.ts`** (12 cases):
```
buildTranscript
  ✔ empty entries → empty string
  ✔ user message → "User: <text>"
  ✔ assistant text → "Assistant: <text>"
  ✔ tool call → "- toolName({...})"
  ✔ tool result → "Result(name): <text>"
  ✔ fromLastUser=true slices from last user message
  ✔ fromLastUser=false includes full history
  ✔ maxChars truncates output
hasMeaningfulActivity
  ✔ false when no entries
  ✔ false when only user messages
  ✔ true when assistant has ≥1 tool call
  ✔ true when assistant has ≥30 words
extractFilePaths
  ✔ returns paths from write/edit tool arguments
```

### 2-C — `prompt-builder.ts`

Extract prompt strings from:
- `handoff.ts` → `SYSTEM_PROMPT` + user message builder
- `session-recap/index.ts` → recap system prompt + transcript wrapper
- `auto-compact/index.ts` → compaction `customInstructions`

```typescript
export class PromptBuilder {
  buildHandoff(transcript: string, goal: string): { system: string; user: string }
  buildRecap(transcript: string): { system: string; user: string }
  buildCompactInstructions(customInstructions?: string): string
}
```

**Test — `context-intel/tests/prompt-builder.test.ts`** (6 cases):
```
buildHandoff
  ✔ includes goal in user message
  ✔ system prompt mentions "context transfer"
buildRecap
  ✔ includes transcript in user message
  ✔ system prompt mentions "one line recap"
buildCompactInstructions
  ✔ returns custom when provided
  ✔ returns default fallback when undefined
```

### 2-D — `config.ts`

Merge `auto-compact/index.ts` config + `session-recap` flags into one typed
config object loaded from `~/.pi/agent/context-intel.jsonc`.

```typescript
export interface ContextIntelConfig {
  compact: {
    enabled: boolean;            // default true
    thresholdPercent: number;    // default 80
    minMessages: number;         // default 10
    customInstructions?: string;
    perModelThresholds: Record<string, number>; // model-key → token count
  };
  recap: {
    enabled: boolean;            // default true
    idleSeconds: number;         // default 45
    focusMinSeconds: number;     // default 3
    disableFocus: boolean;       // default false
    model?: string;              // override model
  };
  handoff: {
    enabled: boolean;            // default true
    autoSuggestAtMessages: number; // default 50, 0 = disabled
  };
}
```

**Test — `context-intel/tests/config.test.ts`** (4 cases):
```
  ✔ returns full defaults when file missing
  ✔ deep-merges partial file config with defaults
  ✔ perModelThresholds is empty map when missing
  ✔ invalid JSON falls back to defaults (no throw)
```

### 2-E — `compactor.ts`

Move compaction logic from `auto-compact/index.ts` into `Compactor` class.

```typescript
export class Compactor {
  constructor(private config: ContextIntelConfig["compact"]) {}

  shouldCompact(usage: { tokens: number; contextWindow: number }, messageCount: number): boolean
  shouldCompactForModel(modelKey: string, tokens: number): boolean
  triggerCompact(ctx: ExtensionContext): void
}
```

**Test — `context-intel/tests/compactor.test.ts`** (6 cases):
```
shouldCompact
  ✔ false when messageCount < minMessages
  ✔ false when below thresholdPercent
  ✔ true when above thresholdPercent and enough messages
shouldCompactForModel
  ✔ false when no threshold set for model
  ✔ false when tokens below model threshold
  ✔ true when tokens above model threshold
```

### 2-F — `recapper.ts` and `handoff.ts`

Direct port from existing files, importing `TranscriptBuilder` and
`PromptBuilder` instead of having their own copies.

### 2-G — `index.ts` — ContextIntelExtension

```typescript
export class ContextIntelExtension extends ExtensionLifecycle {
  readonly name = "context-intel";
  readonly version = "0.3.0";
  protected readonly description = "Automated context: recap, compact, handoff";
  protected readonly events = ["session_start","session_shutdown","turn_end","turn_start","input","agent_start"];

  private readonly config: ContextIntelConfig;
  private readonly transcriptBuilder = new TranscriptBuilder();
  private readonly promptBuilder = new PromptBuilder();
  private readonly compactor: Compactor;
  private readonly recapper: Recapper;
  private readonly handoff: Handoff;
  private messageCount = 0;

  // --- Automation: auto-suggest handoff when conversation is deep ---
  async onAgentEnd(_, ctx: ExtensionContext) {
    const entries = ctx.sessionManager.getBranch();
    const msgCount = entries.filter(e => e.type === "message").length;
    const threshold = this.config.handoff.autoSuggestAtMessages;
    if (threshold > 0 && msgCount >= threshold && msgCount % 10 === 0) {
      this.notify(
        `Context is deep (${msgCount} messages). Use /handoff to continue in a focused session.`,
        { severity: "info", badge: { text: "context-depth", variant: "warning" } }
      );
    }
    // Telemetry heartbeat
    this.track("agent_end", { messageCount: msgCount });
  }

  // --- Automation: surface token-savings after compaction ---
  async onTurnEnd(_, ctx: ExtensionContext) {
    const before = /* snapshot token count */ 0;
    await this.compactor.maybeTrigger(ctx, this.messageCount);
    // Notify savings if compaction triggered (see compactor implementation)
  }

  // ... remaining hooks delegate to recapper + compactor
}

export default function(pi: ExtensionAPI) {
  new ContextIntelExtension(pi).register();
  // Register /handoff, /recap, /compact-config commands
}
```

### 2-H — Update `session-lifecycle/index.ts`

Replace three separate imports:
```typescript
// BEFORE
import handoff from "./handoff.ts";
import autoCompact from "./auto-compact/index.ts";
import sessionRecap from "./session-recap/index.ts";
// handoff(pi); autoCompact(pi); sessionRecap(pi);

// AFTER
import contextIntel from "./context-intel/index.ts";
// contextIntel(pi);
```

### 2-I — Delete old files

```
session-lifecycle/handoff.ts
session-lifecycle/auto-compact/ (entire dir)
session-lifecycle/session-recap/ (entire dir)
```

### 2-J — Telemetry & automation hooks

| Event | Telemetry action |
|-------|-----------------|
| Compaction triggered | `notify("Context compacted — saved ~Xk tokens", { badge: { text: "-Xk tokens", variant: "success" } })` |
| Recap generated | heartbeat on `context-intel` |
| Handoff completed | heartbeat + `notify("Handoff prompt ready — ${N} context items transferred")` |
| autoSuggestAtMessages threshold | `notify("Context is deep (N msgs). /handoff to continue cleanly.")` |

---

## Phase 3 — Unified Planning

> Branch: `feat/planning`
> Commit: `feat(core-tools): merge plan-mode+task-orchestration → planning`
> Profile: dev subset-A, full

### Why merge

`plan-mode.ts` has a full TUI + `plan` tool + file-based persistence in
`.pi/plans/`. `task-orchestration/` has agent-driven task capture + DAG +
4-state execution engine but a broken test suite (now fixed in Phase 1).
They are the same domain: ordered work items with dependencies.

### 3-A — New file tree

```
core-tools/planning/
├── index.ts          # PlanningExtension extends ExtensionLifecycle
├── types.ts          # Plan, PlanStep, StepStatus — unified model
├── dag.ts            # PlanDAG (ported from task-orchestration, unchanged)
├── capture.ts        # IntentCapture (ported from task-orchestration)
├── store.ts          # PlanStore — .pi/plans/ JSON-frontmatter persistence
├── executor.ts       # StepExecutor — 4-state machine (pending→done/fail)
├── tools.ts          # plan_manage, plan_list, plan_status LLM tools
├── commands.ts       # /plan TUI + /plan new + /plan on/off
└── ui/
    ├── manager.ts    # Plan selection TUI (from plan-mode-core.ts)
    ├── detail.ts     # Plan detail overlay (from plan-mode-core.ts)
    └── progress.ts   # Live progress widget (from task-orchestration/ui)
```

### 3-B — Unified type model

The two type systems are close but not identical:

| task-orchestration | plan-mode | Unified (planning/types.ts) |
|-------------------|-----------|----------------------------|
| `Task.id` (string) | `step.id` (number) | `PlanStep.id` (string — migrate numeric → string) |
| `Task.text` | `step.text` | `PlanStep.text` |
| `Task.status` (5 states) | `step.done` (boolean) | `PlanStep.status` (pending/in_progress/completed/failed/skipped) |
| `Task.blockedBy` | — | `PlanStep.dependsOn` |
| — | Plan metadata | `Plan.{ id, title, status, assignedToSession }` |

**Migration path for plan-mode JSON files:**
`planModeStepToPlanStep(step: PlanModeStep): PlanStep` adapter (removes after 1 release).

### 3-C — `dag.ts`

Direct port of `task-orchestration/src/core/task.ts`'s `TaskDAG`, renamed
to `PlanDAG`, using `PlanStep` instead of `Task`. Logic is identical.

**Tests — `planning/tests/dag.test.ts`:** Port the already-written Jest tests
(converted in Phase 1) to `node:test`. Same 25 test cases.

### 3-D — `capture.ts` — IntentCapture (agent-automation core)

Ports `RegexIntentClassifier` from task-orchestration with additions:

```typescript
export class IntentCapture {
  /** Scan assistant messages for implied task lists. */
  inferFromMessages(messages: Message[]): ExtractedTask[]

  /** Detect trigger phrases that suggest a plan is needed. */
  detectPlanTrigger(userText: string): boolean
  // Patterns: "I need to", "Let's", "Step 1", "First ... then ...", "We should"
}
```

**Agent-automation:** `PlanningExtension.onInput` calls `detectPlanTrigger`
and notifies when detected:
```
notify("Plan trigger detected. Use /plan new to capture steps.", 
  { badge: { text: "plan-suggestion", variant: "info" } })
```

Rate-limited to once per session to avoid noise.

**Tests — `planning/tests/capture.test.ts`** (8 cases):
```
inferFromMessages
  ✔ empty messages → []
  ✔ "Step 1: X, Step 2: Y" → 2 tasks
  ✔ "First X then Y" → 2 tasks
  ✔ tasks with explicit dependencies extracted
detectPlanTrigger
  ✔ "I need to fix the auth module" → true
  ✔ "Let's refactor" → true
  ✔ "Can you help me?" → false
  ✔ repeated trigger in same session → suppressed after first
```

### 3-E — `store.ts` — PlanStore

Port of `plan-mode-core.ts` persistence (`loadPlan`, `savePlan`, `listPlans`,
`lockPlan`, `unlockPlan`). No logic changes.

**Tests — `planning/tests/store.test.ts`** (8 cases):
```
  ✔ save then load returns same plan
  ✔ list returns all plans
  ✔ update changes fields without replacing others
  ✔ delete removes plan
  ✔ lock prevents concurrent saves
  ✔ lock TTL releases stale lock
  ✔ concurrent lock attempts: second returns false
  ✔ works when plans dir does not exist (creates it)
```

### 3-F — LLM tools `tools.ts`

| Tool | Replaces | Parameters |
|------|---------|-----------|
| `plan_manage` | `plan` tool (plan-mode) + task tools | `action`, `planId?`, `title?`, `steps?`, `stepId?`, `status?` |
| `plan_list` | task list output | none |
| `plan_status` | task status widget | `planId?` |

**Tests — `planning/tests/tools.test.ts`** (6 cases):
```
  ✔ plan_manage create returns new plan with id
  ✔ plan_manage add_step appends step
  ✔ plan_manage update_step changes status
  ✔ plan_manage complete marks plan done
  ✔ plan_list returns all active plans
  ✔ plan_status returns step breakdown for active plan
```

### 3-G — `index.ts` — PlanningExtension

```typescript
export class PlanningExtension extends ExtensionLifecycle {
  readonly name = "planning";
  readonly version = "0.3.0";
  protected readonly tools = ["plan_manage", "plan_list", "plan_status"];
  protected readonly events = ["session_start", "agent_end", "input"];

  // --- Automation: detect plan triggers in user input ---
  private planTriggerNotifiedThisSession = false;
  async onInput(event, ctx) {
    if (!this.planTriggerNotifiedThisSession && this.capture.detectPlanTrigger(event.text)) {
      this.planTriggerNotifiedThisSession = true;
      this.notify("Plan trigger detected. Use /plan new to capture steps.", {
        badge: { text: "plan-hint", variant: "info" }
      });
    }
    return { action: "continue" };
  }

  // --- Automation: capture tasks from assistant output ---
  async onAgentEnd(_, ctx) {
    const messages = ctx.messages ?? [];
    const extracted = this.capture.inferFromMessages(messages);
    if (extracted.length > 0) {
      const plan = await this.store.getActivePlan();
      if (plan) {
        // Silently append discovered steps to active plan
        for (const t of extracted) await this.store.addStep(plan.id, t);
        this.track("steps_auto_captured", { count: extracted.length });
      }
    }
  }
}
```

### 3-H — Remove old files

```
core-tools/plan-mode.ts
core-tools/plan-mode-core.ts
core-tools/task-orchestration/ (entire dir — tests already moved to planning/tests)
```

---

## Phase 4 — Code Quality Pipeline

> Branch: `feat/code-quality`
> Commit: `feat(core-tools): merge formatter+autofix+code-actions → code-quality`
> Profile: dev subset-A, full

### Why merge

After every `write`/`edit` event, **three separate listeners** currently fire:
1. `formatter` — runs format runners
2. `autofix` — runs lint-fix runners
3. `code-actions` — (not triggered automatically, but extracts snippets on `/code`)

These should be a single pipeline: write → format → fix → extract.
`CodeRunner` interface enables new runners without editing existing code.

### 4-A — New file tree

```
core-tools/code-quality/
├── index.ts              # CodeQualityExtension extends ExtensionLifecycle
├── types.ts              # CodeRunner interface, RunnerConfig, RunnerResult, Snippet
├── registry.ts           # RunnerRegistry — add runners without touching existing code
├── pipeline.ts           # CodeQualityPipeline.processFile() — format → fix → extract
├── format/               # Moved from formatter/extensions/formatter/
│   ├── dispatch.ts
│   ├── context.ts
│   ├── path.ts
│   ├── plan.ts
│   ├── config.ts
│   ├── system.ts
│   └── runners/          # All runner files unchanged, just moved
├── fix/                  # Moved from autofix/
│   ├── index.ts
│   └── runners.ts
├── snippets/             # Moved from code-actions/
│   ├── extract.ts        # extractSnippets from messages + (new) from files
│   ├── actions.ts
│   └── ui.ts
└── commands.ts           # /format (was /formatter-format), /code, /quality-stats
```

### 4-B — `types.ts` — CodeRunner interface

```typescript
export interface CodeRunner {
  readonly id: string;
  readonly type: "format" | "fix";
  matches(filePath: string): boolean;
  run(filePath: string, config: RunnerConfig): Promise<RunnerResult>;
}

export interface RunnerConfig {
  cwd: string;
  timeoutMs: number;
  exec: (cmd: string, args: string[], opts: { cwd: string; timeout: number }) => Promise<ExecResult>;
}

export interface RunnerResult {
  status: "succeeded" | "failed" | "skipped";
  message?: string;
}
```

### 4-C — `registry.ts` — RunnerRegistry (Open/Closed)

```typescript
export class RunnerRegistry {
  private runners = new Map<string, CodeRunner>();

  register(runner: CodeRunner): this { this.runners.set(runner.id, runner); return this; }
  get(id: string): CodeRunner | undefined { return this.runners.get(id); }
  getForFile(filePath: string, type: "format"|"fix"): CodeRunner[] {
    return [...this.runners.values()].filter(r => r.type === type && r.matches(filePath));
  }
  list(): CodeRunner[] { return [...this.runners.values()]; }
}
```

**Tests — `code-quality/tests/registry.test.ts`** (5 cases):
```
  ✔ register() adds runner
  ✔ getForFile() filters by type and extension
  ✔ getForFile() returns empty when nothing matches
  ✔ duplicate id overwrites previous
  ✔ list() returns all registered runners
```

### 4-D — `pipeline.ts` — CodeQualityPipeline

```typescript
export class CodeQualityPipeline {
  constructor(
    private registry: RunnerRegistry,
    private config: { timeoutMs: number },
    private pi: ExtensionAPI
  ) {}

  async processFile(filePath: string, cwd: string): Promise<PipelineResult> {
    // Step 1: Format
    const formatRunners = this.registry.getForFile(filePath, "format");
    const formatResults = await this.runAll(formatRunners, filePath, cwd);

    // Step 2: Fix (only if format succeeded or there were no format runners)
    const fixRunners = this.registry.getForFile(filePath, "fix");
    const fixResults = await this.runAll(fixRunners, filePath, cwd);

    return { filePath, format: formatResults, fix: fixResults };
  }

  private async runAll(runners: CodeRunner[], filePath: string, cwd: string): Promise<RunnerResult[]> { ... }
}
```

**Tests — `code-quality/tests/pipeline.test.ts`** (8 cases):
```
  ✔ empty registry → no-op, returns empty results
  ✔ format runner called on matching file
  ✔ fix runner called after format
  ✔ format failure does not prevent fix step
  ✔ runner skipped when matches() returns false
  ✔ timeout propagated to runner
  ✔ pipeline result contains both format and fix results
  ✔ two format runners both called (registry "all" mode)
```

### 4-E — Agent automation: auto-detect project formatters

`CodeQualityExtension.onSessionStart` scans the cwd for config files and
notifies which runners were auto-enabled:

```typescript
async onSessionStart(_, ctx) {
  const detected = await detectProjectFormatters(ctx.cwd);
  if (detected.length > 0) {
    this.notify(
      `Auto-enabled formatters: ${detected.join(", ")}`,
      { badge: { text: "formatters", variant: "success" } }
    );
  }
  this.track("session_start", { formatters: detected });
}
```

Detection rules (already exist in `formatter/extensions/formatter/`):
- `biome.json` or `biome.jsonc` → enable biome
- `.eslintrc*` or `eslint.config.*` → enable eslint
- `pyproject.toml` with `[tool.ruff]` → enable ruff
- `.prettierrc*` → enable prettier

### 4-F — Remove old files

```
core-tools/formatter/ (entire dir — moved to code-quality/format/)
core-tools/autofix/ (entire dir — moved to code-quality/fix/)
core-tools/code-actions/ (entire dir — moved to code-quality/snippets/)
```

---

## Phase 5 — Subprocess Orchestrator

> Branch: `feat/subprocess-orchestrator`
> Commit: `feat(core-tools): merge sub-pi+subagent+ralph-loop → subprocess-orchestrator`
> Profile: full subset-B

### Why merge

`sub-pi` and `subagent` both spawn child `pi` processes. The difference is:
- `sub-pi` spawns `pi -p` (headless subprocess)
- `subagent` spawns with `--mode json` and manages agents with identities/scopes

`ralph-loop` is a loop-wrapper around subagent. All three register separate
tools (`run_pi`, `subagent`, `ralph_loop`) with overlapping parameters.

**Risk:** subagent is the largest module (~50 files, 2000+ lines in executor alone).
Strategy: keep the subagent internals intact; wrap with `SubprocessTask` adapter.

### 5-A — New file tree

```
core-tools/subprocess-orchestrator/
├── index.ts              # SubprocessOrchestratorExtension extends ExtensionLifecycle
├── types.ts              # SubprocessTask, TaskMode, SubprocessResult
├── normalizer.ts         # TaskNormalizer — convert sub-pi/subagent/ralph params → SubprocessTask
├── executors/
│   ├── registry.ts       # ExecutorRegistry (Open/Closed — add executors without changes)
│   ├── single.ts         # SingleExecutor (delegates to subagent foreground execution)
│   ├── chain.ts          # ChainExecutor (from subagent chain-execution)
│   ├── parallel.ts       # ParallelExecutor (from subagent parallel-utils)
│   └── loop.ts           # LoopExecutor (from ralph-loop, uses condition polling)
├── tools.ts              # run_subprocess unified tool (replaces run_pi + subagent)
├── commands.ts           # /agents, /subprocess-status
│
│ # Internals preserved as-is (not merged, just re-pathed):
├── agents/               # from subagent/agents/
├── runs/                 # from subagent/runs/
├── shared/               # from subagent/shared/
├── tui/                  # from subagent/tui/
├── intercom/             # from subagent/intercom/
└── slash/                # from subagent/slash/
```

### 5-B — `types.ts`

```typescript
export type TaskMode = "single" | "chain" | "parallel" | "loop";
export type ExecMode = "sync" | "async" | "forked";

export interface SubprocessTask {
  id: string;
  mode: TaskMode;
  execMode: ExecMode;
  prompt: string;
  agent?: string;          // named agent from agents/ config
  model?: { provider: string; id: string };
  tools: string[];
  skills?: string[];
  forkContext?: boolean;
  subTasks?: SubprocessTask[];  // for chain/parallel
  loopConfig?: {
    conditionCommand: string;
    maxIterations?: number;
    intervalSeconds?: number;
  };
}
```

### 5-C — `normalizer.ts` — TaskNormalizer

Converts the three existing tool schemas into `SubprocessTask`:

```typescript
export class TaskNormalizer {
  fromSubPiParams(p: SubPiToolParams): SubprocessTask   // sub-pi tool → task
  fromSubagentParams(p: SubagentToolParams): SubprocessTask  // subagent tool → task
  fromRalphParams(p: RalphToolParams): SubprocessTask   // ralph-loop → task with loopConfig
}
```

**Tests — `subprocess-orchestrator/tests/normalizer.test.ts`** (9 cases):
```
fromSubPiParams
  ✔ single task with prompt → SubprocessTask{mode:"single"}
  ✔ parallel tasks array → SubprocessTask{mode:"parallel", subTasks}
  ✔ chain array → SubprocessTask{mode:"chain", subTasks}
fromSubagentParams
  ✔ agent + task → SubprocessTask{mode:"single"}
  ✔ tasks array (parallel) → SubprocessTask{mode:"parallel"}
  ✔ chain array → SubprocessTask{mode:"chain"}
fromRalphParams
  ✔ condition command preserved in loopConfig
  ✔ maxIterations preserved
  ✔ missing maxIterations defaults to undefined
```

### 5-D — `tools.ts` — `run_subprocess` unified tool

```typescript
// Single tool replacing run_pi + subagent + ralph_loop
{
  name: "run_subprocess",
  description: "Run one or more pi subprocess agents...",
  parameters: {
    mode: enum("single","chain","parallel","loop"),
    prompt: string,                      // single mode
    tasks: array({ prompt, agent?, ... }), // chain/parallel mode
    agent: string,                       // optional named agent
    async: boolean,                      // default false
    fork: boolean,                       // fork parent context
    loop: { condition, maxIterations },  // loop mode
  }
}
```

The old tool names (`run_pi`, `subagent`, `ralph_loop`) are kept as **deprecated
aliases** for one release, emitting a telemetry warning when used:
```typescript
this.notify(
  "Tool 'run_pi' is deprecated. Use 'run_subprocess' instead.",
  { severity: "warning", badge: { text: "deprecated", variant: "warning" } }
);
```

### 5-E — Agent automation

```typescript
// Detect when ≥3 independent tasks appear in a response
async onAgentEnd(_, ctx) {
  const extracted = await detectParallelizableTasks(ctx.messages ?? []);
  if (extracted.length >= 3) {
    this.notify(
      `${extracted.length} independent tasks detected. Consider run_subprocess with mode:"parallel".`,
      { badge: { text: "parallel-hint", variant: "info" } }
    );
    this.track("parallel_hint", { count: extracted.length });
  }
}
```

### 5-F — Remove old directories

```
core-tools/sub-pi/ (merged into orchestrator via normalizer)
core-tools/sub-pi-skill/ (merged into orchestrator/agents/skills.ts)
core-tools/subagent/ (internals moved into orchestrator/)
core-tools/ralph-loop/ (merged into orchestrator/executors/loop.ts)
```

---

## Phase 6 — File Intelligence

> Branch: `feat/file-intel`
> Commit: `feat(core-tools): merge file-collector+ast-grep → file-intel`
> Profile: full subset-B

### 6-A — New file tree

```
core-tools/file-intel/
├── index.ts        # FileIntelExtension extends ExtensionLifecycle
├── types.ts        # TrackedFile, FileIntelConfig
├── tracker.ts      # FileTracker class (from file-collector)
├── tools.ts        # file_list, ast_grep_search, ast_grep_replace
└── ast-grep/       # from ast-grep-tool/ (no logic changes)
    ├── client.ts
    ├── search.ts
    ├── replace.ts
    └── shared.ts
```

### 6-B — `tracker.ts` — FileTracker

Port `file-collector/extension.ts` logic into a class, adding:

```typescript
export class FileTracker {
  track(path: string, action: "read"|"write"|"edit", toolName: string): void
  getAll(): TrackedFile[]
  getHotFiles(limit = 5): TrackedFile[]     // NEW: sorted by writeCount desc
  getByExtension(ext: string): TrackedFile[] // NEW
  getStats(): { total, reads, writes, hotFile?: string }  // NEW
  reset(): void
}
```

**Tests — `file-intel/tests/tracker.test.ts`** (10 cases):
```
  ✔ track read increments readCount
  ✔ track write increments writeCount
  ✔ track edit increments writeCount
  ✔ same path deduplicates (single TrackedFile)
  ✔ getHotFiles returns top N by writeCount
  ✔ getByExtension filters correctly
  ✔ getStats totals are accurate
  ✔ reset clears all state
  ✔ absolutePath resolves relative paths against cwd
  ✔ firstSeen is set on first track; lastModified updates on subsequent
```

### 6-C — Agent automation

```typescript
async onAgentEnd(_, ctx) {
  const stats = this.tracker.getStats();
  if (stats.writes >= 5) {
    this.notify(
      `${stats.writes} files modified this session. Use ast_grep_search to find patterns across them.`,
      { badge: { text: `${stats.writes} files`, variant: "info" } }
    );
  }
}
```

### 6-D — `tools.ts`

```typescript
// NEW: file_list — agent-callable inventory
{ name: "file_list",
  description: "List all files read or written in this session...",
  parameters: { filter?: "reads"|"writes"|"hot", extension?: string, limit?: number }
}

// UNCHANGED: ast_grep_search, ast_grep_replace (direct port)
```

**Tests — `file-intel/tests/tracker.test.ts`** and existing ast-grep tests
(ported from `ast-grep-tool/client.test.ts` — already passing).

### 6-E — Remove old files

```
core-tools/file-collector/ (entire dir)
core-tools/ast-grep-tool/ (moved to file-intel/ast-grep/)
```

---

## Phase 7 — Web Consolidation

> Branch: `feat/web`
> Commit: `feat(content-tools): merge web-search+web-fetch → web`
> Profile: full

### Why merge

Both tools make HTTP requests to external services. `web-search` lives in
`core-tools/` while `web-fetch` is in `content-tools/`. Neither belongs in
core-tools. They share zero code but use the same `fetch` primitive.

### 7-A — New file tree

```
content-tools/web/
├── index.ts          # WebExtension extends ExtensionLifecycle
├── types.ts          # WebConfig, SearchResult, FetchResult
├── search/           # from core-tools/web-search.ts (split by backend)
│   ├── index.ts
│   ├── backends/
│   │   ├── exa.ts
│   │   ├── tavily.ts
│   │   └── valiyu.ts
│   └── search.ts     # SearchBackend interface + resolution logic
└── fetch/            # from content-tools/web-fetch/ (no changes)
    ├── index.ts
    ├── tool.ts
    ├── extract.ts
    ├── format.ts
    ├── dom.ts
    ├── profiles.ts
    └── settings.ts
```

**No shared HTTP client in this phase.** The `wreq-js` library (already used
by web-fetch) handles TLS fingerprinting. Adding a shared `HttpClient` class
would require refactoring web-fetch's working internals — not justified by
the merge alone. Instead, the shared surface is just the `WebExtension`
registration and a unified `/web-config` command.

### 7-B — Backend split for web-search

Current `web-search.ts` has three backends in one file. Move each to its own
file for testability:

```typescript
// search/backends/exa.ts
export const exaBackend: SearchBackend = { name: "exa", search(...) {} }

// search/backends/tavily.ts
export const tavilyBackend: SearchBackend = { name: "tavily", search(...) {} }

// search/backends/valiyu.ts
export const valiyuBackend: SearchBackend = { name: "valiyu", search(...) {} }

// search/search.ts
export function resolveBackend(): SearchBackend | undefined { ... }
```

**Tests — `web/tests/search.test.ts`** (ported from existing `web-search.test.ts`,
3 additional cases):
```
  (existing 6 cases — already passing)
  ✔ resolveBackend returns exa when EXA_API_KEY set
  ✔ resolveBackend returns tavily when TAVILY_API_KEY set
  ✔ resolveBackend returns undefined when no key set
```

### 7-C — Agent automation

```typescript
// Suggest search when agent response mentions uncertainty
async onAgentEnd(_, ctx) {
  const lastMsg = getLastAssistantMessage(ctx.messages ?? []);
  if (lastMsg && containsUncertaintyPhrase(lastMsg)) {
    const backendAvailable = !!resolveBackend();
    if (backendAvailable) {
      this.notify("Agent expressed uncertainty. Use web_search to verify.", {
        badge: { text: "search-hint", variant: "info" }
      });
    }
  }
}

const UNCERTAINTY_PHRASES = [
  "i'm not sure", "i don't know", "you might want to check",
  "verify this", "double-check", "i believe", "i think", "approximately",
];
```

### 7-D — Update `content-tools/index.ts`

```typescript
// Replace:
import webFetch from "./web-fetch/index.ts";
// Add:
import web from "./web/index.ts";
```

### 7-E — Update `core-tools/index.ts`

Remove `import webSearch from "./web-search.ts"` and its call from subset A.

### 7-F — Remove old files

```
core-tools/web-search.ts
content-tools/web-fetch/ (moved to content-tools/web/fetch/)
```

---

## Phase 8 — Remove Deprecated Extensions

> Branch: `feat/remove-deprecated`
> Commit: `chore: remove preset, edit-session, files-widget`

### 8-A — Remove Preset (`core-tools/preset/`)

**Reason:** Pi's native settings manager handles model/provider/thinking-level
switching. The preset extension adds ~300 lines of TUI for something the host
app already does.

Steps:
1. Delete `core-tools/preset/` (extension.ts + index.ts)
2. Remove import + call from `core-tools/index.ts`
3. Add to CHANGELOG.md under "Breaking Changes"

### 8-B — Remove Edit Session (`core-tools/edit-session/`)

**Reason:** Pi's built-in `/tree` and session fork cover rewinding to prior
messages. The extension's in-place editor is complex (~600 lines) and fragile.

Steps:
1. Delete `core-tools/edit-session/` (entire directory)
2. Remove import + call from `core-tools/index.ts`
3. Add to CHANGELOG.md under "Breaking Changes"

### 8-C — Remove Files Widget (`content-tools/files-widget/`)

**Reason:** UX-only `/readfiles` with three external binary dependencies
(`bat`, `delta`, `glow`). File-picker already provides agent-relevant file
operations. High maintenance surface for low agent value.

Steps:
1. Delete `content-tools/files-widget/` (entire directory)
2. Remove import + call from `content-tools/index.ts`
3. Add to CHANGELOG.md. Suggest `brew install bat delta glow` + manual
   invocation as alternative.

---

## Phase 9 — Telemetry & Automation Polish

> Branch: `feat/telemetry-polish`
> Commit: `feat(telemetry): per-module hooks, automation triggers, /usage enhancements`

### 9-A — Standardise all module registrations

Every module now extends `ExtensionLifecycle` (from Phase 0). Verify the
`tools` and `events` arrays are accurate for each module so the `/usage`
dashboard shows correct attribution.

| Module | tools | events |
|--------|-------|--------|
| context-intel | — | session_start, session_shutdown, turn_end, input, agent_end |
| planning | plan_manage, plan_list, plan_status | session_start, input, agent_end |
| code-quality | extract_reusable_snippets | session_start, tool_call, tool_result |
| subprocess-orchestrator | run_subprocess | session_start, agent_end, tool_call |
| file-intel | file_list, ast_grep_search, ast_grep_replace | session_start, tool_call, agent_end |
| web | web_search, web_fetch, batch_web_fetch | session_start, agent_end |

### 9-B — Automation trigger matrix

All triggers use `this.notify(message, opts)` from `ExtensionLifecycle`.
Each trigger fires at most once per session (guarded by a boolean flag reset
on `session_start`) unless otherwise noted.

| Module | Trigger condition | Notification |
|--------|------------------|-------------|
| context-intel | `messageCount >= config.handoff.autoSuggestAtMessages` (every 10 messages above threshold) | `"Context is deep (N msgs). /handoff to start fresh."` |
| context-intel | Compaction triggered | `"Compacted — saved ~Xk tokens."` (severity: success) |
| planning | `detectPlanTrigger(userText) === true` | `"Plan trigger detected. Use /plan new to capture steps."` |
| planning | Active plan step completed | `"Plan '${title}' — step ${n}/${total} done."` |
| code-quality | `onSessionStart` detects formatter configs | `"Auto-enabled: ${runners.join(', ')}"` |
| subprocess-orchestrator | `≥3` independent tasks in response | `"${n} tasks detected. Consider parallel execution."` |
| subprocess-orchestrator | Deprecated tool called | `"Tool '${name}' is deprecated. Use 'run_subprocess'."` (severity: warning) |
| file-intel | `stats.writes >= 5` after agent turn | `"${n} files modified. Use ast_grep_search to find patterns."` |
| web | Last assistant message has uncertainty phrase | `"Agent expressed uncertainty. Use web_search to verify."` |

### 9-C — `/usage` dashboard enhancements

The existing `usage-extension` already renders a dashboard. Extend
`UsageComponent` to include a new "Automation Events" section:

```
┌─ Automation Activity ──────────────────────────────────────────────────┐
│  Compactions:  3 (saved ~45k tokens)                                   │
│  Plans created: 2, completed: 1, in-progress: 1                        │
│  Formatters auto-enabled: biome, eslint                                │
│  Subprocesses: 7 single, 2 parallel (avg 3.2s)                        │
│  Files modified: 12, hot file: src/index.ts (5 writes)                 │
└────────────────────────────────────────────────────────────────────────┘
```

Data comes from telemetry `heartbeat` calls and `track()` calls made by each
module. Storage: in-memory session stats accumulated via new
`SessionStats` class in `session-lifecycle/usage-extension/session-stats.ts`.

---

## Phase 10 — Test Coverage

> Branch: integrated per-phase (each phase branch includes its tests)
> Final commit: `test: ensure 85%+ coverage, remove jest, standardise node:test`

### 10-A — Test framework standardisation

The project uses `tsx --test` (Node.js built-in test runner). All tests must
use `node:test` + `node:assert/strict`. Zero jest dependencies.

**Banned:**
- `import from "@jest/globals"` → use `import { describe, it } from "node:test"`
- `expect(x).toBe(y)` → `assert.strictEqual(x, y)`
- `expect(x).toEqual(y)` → `assert.deepStrictEqual(x, y)`
- `jest.fn()` → manual stub objects or `import { mock } from "node:test"`

### 10-B — New test files (summary)

| Phase | Test file | Cases |
|-------|-----------|-------|
| 0 | `shared/lifecycle.test.ts` | 6 |
| 0 | `shared/telemetry-helpers.test.ts` | 2 |
| 0 | `session-lifecycle/session-name.test.ts` | 6 |
| 0 | `session-lifecycle/skill-args.test.ts` | 10 |
| 2 | `context-intel/tests/transcript-builder.test.ts` | 13 |
| 2 | `context-intel/tests/prompt-builder.test.ts` | 6 |
| 2 | `context-intel/tests/config.test.ts` | 4 |
| 2 | `context-intel/tests/compactor.test.ts` | 6 |
| 3 | `planning/tests/dag.test.ts` | 25 (ported) |
| 3 | `planning/tests/capture.test.ts` | 8 |
| 3 | `planning/tests/store.test.ts` | 8 |
| 3 | `planning/tests/tools.test.ts` | 6 |
| 4 | `code-quality/tests/registry.test.ts` | 5 |
| 4 | `code-quality/tests/pipeline.test.ts` | 8 |
| 5 | `subprocess-orchestrator/tests/normalizer.test.ts` | 9 |
| 6 | `file-intel/tests/tracker.test.ts` | 10 |
| 7 | `web/tests/search.test.ts` | 3 (new) + 6 (ported) |

**Total new cases: ~135** on top of the existing 464 passing cases.
Target: **≥580 passing, 0 failing**.

### 10-C — Coverage by module (target)

| Module | Target | Strategy |
|--------|--------|---------|
| `shared/` | 95% | Pure functions, easy to test |
| `foundation/` | 90% | Already well-tested; add scanner edge cases |
| `context-intel/` | 85% | Test TranscriptBuilder + PromptBuilder + Compactor |
| `planning/` | 85% | Test DAG + store + tools (TUI code exempt) |
| `code-quality/` | 80% | Test registry + pipeline; runners tested indirectly |
| `subprocess-orchestrator/` | 70% | Test normalizer; executor integration needs live pi |
| `file-intel/` | 85% | Test tracker fully; ast-grep tests already pass |
| `web/` | 75% | Test backend resolution; actual HTTP requires mocking |

---

## Phase 11 — Documentation & Release

> Branch: merged to `main` after all phases pass CI

### 11-A — `package.json` updates

```json
{
  "version": "0.3.0",
  "pi": {
    "extensions": [
      "pi-telemetry",
      "./foundation/index.ts",
      "./session-lifecycle/index.ts",
      "./core-tools/index.ts",
      "./content-tools/index.ts",
      "./authoring/index.ts",
      "pi-web-providers/dist/index.js",
      "pi-dialog"
    ]
  }
}
```

(No changes to the extensions array — umbrella files handle the internal
routing. Only internal imports change.)

### 11-B — `README.md` rewrite

Sections to update:
1. **Tests badge:** `417+ passing` → `580+ passing`
2. **Feature table:** Replace rows for merged modules; remove preset/edit-session/files-widget
3. **Architecture diagram:** Update to new file tree
4. **Agent Automation section (NEW):** Document all 9 automation triggers with examples
5. **Breaking Changes section (NEW):** List removed tools and migration path
6. **Configuration:** Update context-intel config file path

### 11-C — `CHANGELOG.md` (create)

```markdown
# Changelog

## [0.3.0] — 2026-05-XX

### Added
- `context-intel`: unified context summarisation with auto-suggest handoff, compaction savings badge
- `planning`: unified plan+task system with LLM-driven step capture and plan-trigger detection
- `code-quality`: unified formatter+fixer+snippet pipeline with auto-runner detection
- `subprocess-orchestrator`: unified subprocess tool `run_subprocess` (single/chain/parallel/loop)
- `file-intel`: unified file tracker + AST-grep with session-file inventory tool `file_list`
- `web`: unified web-search + web-fetch with uncertainty-phrase trigger
- `shared/lifecycle.ts`: `ExtensionLifecycle` base class for all extensions
- 9 agent-automation triggers via pi-telemetry badges
- 135 new test cases (580+ total, 0 failing)

### Changed
- All modules now extend `ExtensionLifecycle` for consistent telemetry setup
- `run_subprocess` replaces `run_pi`, `subagent`, `ralph_loop` (deprecated aliases kept for v0.3.x)
- `plan_manage/list/status` replace `plan` + task-orchestration tools
- `web_search` moved from core-tools to content-tools (full profile only)

### Removed
- **preset** extension (use pi settings manager)
- **edit-session** extension (use pi's built-in `/tree`)
- **files-widget** extension (use file-picker or file_list tool)

### Fixed
- All 11 task-orchestration tests now use `node:test` (removed jest dependency)
```

### 11-D — Git workflow

```bash
# One commit per phase (already branched above)
# Final integration:
git checkout main
git merge feat/shared-foundation    # Phase 0
git merge fix/test-runner-compat    # Phase 1
git merge feat/context-intel        # Phase 2
git merge feat/planning             # Phase 3
git merge feat/code-quality         # Phase 4
git merge feat/subprocess-orchestrator # Phase 5
git merge feat/file-intel           # Phase 6
git merge feat/web                  # Phase 7
git merge feat/remove-deprecated    # Phase 8
git merge feat/telemetry-polish     # Phase 9
# (tests integrated per-branch)

npm test   # must show: 0 failing, 580+ passing

git tag v0.3.0
git push origin main --tags
```

### 11-E — Post-publish verification

```bash
# Test clean install
mkdir /tmp/pi-test && cd /tmp/pi-test
pi install https://github.com/dmoreq/pi-me

# Test each profile
PI_PROFILE=minimal pi -p "echo hello"   # only foundation loads
PI_PROFILE=dev     pi -p "echo hello"   # context-intel, planning, code-quality load
PI_PROFILE=full    pi -p "echo hello"   # everything loads
```

---

## Dependency Map (phase execution order)

```
Phase 0 (shared-foundation)
  └── Phase 1 (fix-tests)
        ├── Phase 2 (context-intel)     ← depends on 0
        ├── Phase 3 (planning)          ← depends on 0 + 1
        ├── Phase 4 (code-quality)      ← depends on 0
        ├── Phase 5 (subprocess-orch)   ← depends on 0
        ├── Phase 6 (file-intel)        ← depends on 0
        └── Phase 7 (web)              ← depends on 0
              └── Phase 8 (remove-deprecated)  ← depends on 4, 5, 6, 7
                    └── Phase 9 (telemetry-polish)  ← depends on all
                          └── Phase 10 (tests)      ← integrated per-phase
                                └── Phase 11 (release)
```

Phases 2–7 can be developed **in parallel** on separate branches once Phase 0
and Phase 1 are merged to `main`.

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Subagent internals too complex to extract cleanly | Medium | Keep subagent internals verbatim under `subprocess-orchestrator/`; only add adapter layer |
| Plan-mode TUI components hard to port | Low | Keep TUI files as-is under `planning/ui/`; only change imports |
| `plan_manage` tool breaks existing sessions | Medium | Keep old `plan` tool as deprecated alias for one release |
| Test count drops below 85% after deletes | Low | Write new tests in same PR as each delete |
| pi-telemetry `track()` API not available | Low | Use `heartbeat()` as proxy (already confirmed from source) |
| Profile loading breaks after import path changes | Low | All profile logic is in umbrella index files; only those change |

---

## Definition of Done

- [ ] `npm test` → **0 failing, 580+ passing**
- [ ] `npm test` runs without any jest references
- [ ] All 9 automation triggers fire correctly in manual test session
- [ ] `/usage` dashboard shows module stats
- [ ] `pi install https://github.com/dmoreq/pi-me` works on clean install
- [ ] All three profiles (minimal/dev/full) load without errors
- [ ] README reflects new feature set
- [ ] CHANGELOG.md created
- [ ] v0.3.0 tagged and pushed

# Context Intelligence Refactor Plan — DRY / OOP / SOLID Compliance Pass

## Problem Statement

Context Intelligence (`session-lifecycle/context-intel/`) was built as a consolidation of 5 legacy modules. While the consolidation was successful, the internal architecture has several DRY/OOP/SOLID violations that accumulated during the merge:

### Violations Found

#### 1. DRY — Duplicate type definitions across layers
- `PruningMeta` in `types.ts` is essentially the same shape as messages returned by the pipeline — both carry `role`, `content`, `tool_call_id`. They're used interchangeably but have separate type paths.
- `SessionStats` in `types.ts` duplicates fields that `ContextMonitor` calculates internally — no shared interface.
- `MemoryConfig` has `autoConsolidate` + `autoConsolidateMinMessages` — `AutomationConfig` has `autoCompactThreshold` — different naming for the same pattern (threshold configs).

#### 2. SRP Violation — `ContextMonitor` is a god class
- Tracks: message count, turn count, tool calls, bash calls, touched files, token usage, last recap time, session ID, cwd
- `getCompactSuggestion()`, `getRecapEligible()`, `getContextUsageRatio()` — three different threshold checks in one class
- Should be split into: `SessionCounter` (counts), `TokenTracker` (usage), `ThresholdMonitor` (triggers)

#### 3. OCP Violation — Automation triggers are hardcoded
- `TRIGGERS` array in `auto-advisor.ts` is a const array. Adding a new trigger means editing the file.
- `TelemetryAutomation` static methods are hardcoded. Adding a new trigger means adding a new static method.
- Should use the same registry pattern as pruning rules.

#### 4. LSP — Auto-modules have inconsistent constructors
- `AutoCompactor(config, monitor, pruning)` — 3 constructor params
- `AutoRecapper(config, monitor, memory)` — 3 constructor params
- `AutoConsolidator(config, memory)` — 2 constructor params
- `AutoAdvisor()` — 0 constructor params
- Some take `config`, some take `monitor`, some take `pruning`. `AutoAdvisor` takes nothing.
- Should share a common `AutomationContext` object.

#### 5. ISP — PipelineResult exposes unused analyze stage
- `PipelineResult` in `types.ts` has `format: RunnerResult[]`, `fix: RunnerResult[]`, `analyze: RunnerResult[]`
- `analyze` is never implemented. Every consumer ignores it.
- Should be removed.

#### 6. DIP — Core depends on concrete implementations
- `ContextIntelExtension` directly instantiates `ContextMonitor`, `MemoryOrchestrator`, `WorkflowEngine`, all auto-modules in its constructor
- No dependency injection, no interfaces for testing
- Should depend on interfaces (monitor, memory, pipeline, automation)

#### 7. Magic numbers everywhere
- `keepRecentCount: 10` — hardcoded default
- `autoCompactThreshold: 80` — hardcoded default
- `TRIGGERS` cooldowns: `300_000`, `120_000` — magic numbers without explanation
- `hasFTS5` flag in store — no config option to disable FTS5

#### 8. Inconsistent naming
- `PruningMeta` uses `metadata` (object), but rules return `string` arrays
- `PruneRule.check()` returns `{ prune: boolean; reason?: string; metadata?: PruningMeta }` — optional metadata is rarely used
- Mix of `snake_case` (db columns) and `camelCase` (TS interfaces) — acceptable but inconsistent for `last_accessed` vs `updatedAt`

---

## Proposed Architecture

### Before (current)
```
ContextIntelExtension
├── ContextMonitor (god class, 7 responsibilities)
├── WorkflowEngine (pruning)
├── MemoryOrchestrator
├── AutoCompactor ← hardcoded constructor
├── AutoRecapper   ← hardcoded constructor
├── AutoConsolidator ← hardcoded constructor
├── AutoAdvisor   ← hardcoded triggers array
└── TelemetryAutomation ← hardcoded static methods
```

### After
```
ContextIntelExtension
├── di/Container.ts                 ← Dependency injection container
├── core/
│   ├── SessionCounter.ts           ← message/turn/tool counts
│   ├── TokenTracker.ts             ← token usage & ratio
│   ├── ThresholdMonitor.ts         ← threshold checks (80% compact, 50msgs deep)
│   └── StatsCollector.ts           ← log scanning (unchanged)
├── pruning/
│   ├── WorkflowEngine.ts           ← unchanged
│   └── rules/                      ← unchanged
├── memory/
│   ├── MemoryStore.ts              ← unchanged
│   ├── MemoryConsolidator.ts       ← unchanged
│   ├── MemoryInjector.ts           ← unchanged
│   └── MemoryOrchestrator.ts       ← unchanged
├── automation/
│   ├── registry.ts                 ← NEW: registry pattern (like pruning rules)
│   ├── triggers.ts                 ← refactored: dynamic, registered via registry
│   ├── AutoCompactor.ts            ← takes AutomationContext
│   ├── AutoRecapper.ts             ← takes AutomationContext
│   ├── AutoConsolidator.ts         ← takes AutomationContext
│   └── AutoAdvisor.ts              ← takes AutomationContext
├── types.ts                        ← cleaned: no PruningMeta, no analyze in PipelineResult
├── config.ts                       ← unchanged
└── index.ts                        ← uses Container, dep injection
```

---

## Step-by-Step Implementation (8 steps)

### Step 1: Extract `core/SessionCounter.ts` from `ContextMonitor`

**Current**: `ContextMonitor` holds 12 fields + 8 methods for counting + 4 methods for threshold checks.

**Move out**:
- `messageCount`, `turnCount`, `toolCallCount`, `bashCallCount`, `touchedFiles`
- `recordMessage()`, `recordTurn()`, `recordToolCall()`, `recordFileWrite()`
- `getStats()` → only the count fields

**New class**:
```typescript
export class SessionCounter {
  messageCount = 0;
  turnCount = 0;
  toolCallCount = 0;
  bashCallCount = 0;
  touchedFiles = new Set<string>();

  recordMessage(): void { this.messageCount++; }
  recordTurn(): void { this.turnCount++; }
  recordToolCall(name: string): void {
    this.toolCallCount++;
    if (name === "bash") this.bashCallCount++;
  }
  recordFileWrite(path: string): void { this.touchedFiles.add(path); }
  reset(): void { /* zero all */ }
  snapshot(): SessionCountSnapshot { /* returns current values */ }
}
```

---

### Step 2: Extract `core/TokenTracker.ts` from `ContextMonitor`

**Move out**:
- `tokenUsage: TokenUsage | null`
- `updateTokenUsage()`, `getContextUsageRatio()`

**New class**:
```typescript
export class TokenTracker {
  private usage: TokenUsage | null = null;

  update(usage: TokenUsage): void { this.usage = usage; }
  getRatio(): number | null { /* usage.total / usage.contextWindow */ }
  getPercentage(): number | null { /* ratio * 100 */ }
  getDisplay(): string { /* "45% (12K/128K)" */ }
}
```

---

### Step 3: Extract `core/ThresholdMonitor.ts` from `ContextMonitor`

**Move out**:
- `lastRecapAt`, `sessionId`, `cwd`
- `markRecap()`, `getRecapEligible()`, `getCompactSuggestion()`

**New class**:
```typescript
export class ThresholdMonitor {
  lastRecapAt = 0;
  lastCompactAt = 0;
  config: { compactThreshold: number; recapMinMessages: number };

  constructor(config: { compactThreshold: number; recapMinMessages: number }) {
    this.config = config;
  }

  isCompactNeeded(ratio: number): boolean {
    return ratio >= this.config.compactThreshold / 100
      && Date.now() - this.lastCompactAt > 60_000; // 1min cooldown
  }

  isRecapEligible(messageCount: number): boolean {
    return messageCount >= this.config.recapMinMessages
      && Date.now() - this.lastRecapAt > 600_000; // 10min cooldown
  }

  markCompact(): void { this.lastCompactAt = Date.now(); }
  markRecap(): void { this.lastRecapAt = Date.now(); }
}
```

---

### Step 4: Create `di/Container.ts` (Dependency Injection)

**New file** — replaces the god constructor in `index.ts`:

```typescript
export class ContextIntelContainer {
  readonly config: ContextIntelConfig;
  readonly counter: SessionCounter;
  readonly tokenTracker: TokenTracker;
  readonly threshold: ThresholdMonitor;
  readonly pruning: WorkflowEngine;
  readonly memory: MemoryOrchestrator;
  readonly automation: AutomationRegistry;
  readonly advisor: AutoAdvisor;

  constructor(config: ContextIntelConfig) {
    this.config = config;
    this.counter = new SessionCounter();
    this.tokenTracker = new TokenTracker();
    this.threshold = new ThresholdMonitor({
      compactThreshold: config.automation.autoCompactThreshold,
      recapMinMessages: config.automation.autoRecapMaxMessageCount ?? 20,
    });
    this.pruning = new WorkflowEngine(config.pruning);
    this.memory = new MemoryOrchestrator(config.memory);
    this.automation = new AutomationRegistry({
      compactor: new AutoCompactor(this),
      recapper: new AutoRecapper(this),
      consolidator: new AutoConsolidator(this),
    });
    this.advisor = new AutoAdvisor(this);

    // Register default advice triggers
    this.advisor.register(adviceTriggers.contextDepth);
    this.advisor.register(adviceTriggers.highActivity);
    this.advisor.register(adviceTriggers.manyFiles);
    this.advisor.register(adviceTriggers.bashHeavy);
  }
}
```

**`AutomationContext`** — shared context object for all auto-modules:
```typescript
export interface AutomationContext {
  readonly config: ContextIntelConfig;
  readonly counter: SessionCounter;
  readonly tokenTracker: TokenTracker;
  readonly threshold: ThresholdMonitor;
  readonly pruning: WorkflowEngine;
  readonly memory: MemoryOrchestrator;
}
```

**All 4 auto-modules** now take `AutomationContext` instead of individual deps:
```typescript
// Before:
new AutoCompactor(config, monitor, pruning)
new AutoRecapper(config, monitor, memory)
new AutoConsolidator(config, memory)
new AutoAdvisor()

// After:
new AutoCompactor(ctx)
new AutoRecapper(ctx)
new AutoConsolidator(ctx)
new AutoAdvisor(ctx)
```

---

### Step 5: Create `automation/registry.ts` + Refactor `automation/triggers.ts`

**Current**: `TelemetryAutomation` has 12 hardcoded static methods. `AutoAdvisor` has a hardcoded `TRIGGERS` array.

**New pattern** — registry with registration:
```typescript
// automation/registry.ts
export interface AutomationHandler {
  readonly id: string;
  readonly cooldownMs: number;
  check(ctx: AutomationContext): string | null; // null = don't fire, string = advice
}

export class AutomationRegistry {
  private handlers = new Map<string, AutomationHandler>();
  private lastFired = new Map<string, number>();

  register(handler: AutomationHandler): void {
    this.handlers.set(handler.id, handler);
  }

  async runAll(ctx: AutomationContext, pi: ExtensionAPI): Promise<void> {
    for (const [id, handler] of this.handlers) {
      const last = this.lastFired.get(id) ?? 0;
      if (Date.now() - last < handler.cooldownMs) continue;

      const advice = handler.check(ctx);
      if (advice) {
        getTelemetry()?.notify(advice, {
          package: "context-intel",
          badge: { text: id, variant: "info" },
        });
        this.lastFired.set(id, Date.now());
      }
    }
  }
}
```

**`TelemetryAutomation` refactored** — from static methods to registered handlers:
```typescript
// automation/triggers.ts
export const contextDepthHandler: AutomationHandler = {
  id: "deep-context",
  cooldownMs: 300_000,
  check: (ctx) => ctx.counter.messageCount > 50
    ? `Context is deep (${ctx.counter.messageCount} messages)`
    : null,
};
```

**12 triggers → 12 registered handlers**. Adding a new trigger is:
```typescript
advisor.register({ id: "my-trigger", cooldownMs: 60_000, check: (ctx) => ... });
```
No file edits needed.

---

### Step 6: Clean `types.ts`

**Changes**:

1. **Remove `PruningMeta`** — unused. Rules return `{ prune, reason }` objects, not `PruningMeta`. The type was copied from the old `context-pruning` but never used by any rule.

2. **Remove `analyze` from `PipelineResult`** — never implemented. Every consumer ignores it.

```typescript
// Before:
export interface PipelineResult {
  filePath: string;
  format: RunnerResult[];   // used
  fix: RunnerResult[];      // used
  analyze: RunnerResult[];  // NEVER USED
  duration: number;
}

// After:
export interface PipelineResult {
  filePath: string;
  format: RunnerResult[];
  fix: RunnerResult[];
  duration: number;
}
```

3. **Add `SessionCountSnapshot`** — return type for `SessionCounter.snapshot()`:
```typescript
export interface SessionCountSnapshot {
  messageCount: number;
  turnCount: number;
  toolCallCount: number;
  bashCallCount: number;
  touchedFiles: string[];
}
```

4. **Add `AutomationContext`** interface (see Step 4).

5. **Normalize naming**: `PruningMeta` → remove. `last_accessed` → keep as-is (maps to SQLite column).

---

### Step 7: Refactor `index.ts` (Main Extension)

**Current**: Constructor creates everything inline:
```typescript
constructor(pi: ExtensionAPI) {
  super(pi);
  this.config = loadContextIntelConfig();
  this.monitor = new ContextMonitor();
  this.memory = new MemoryOrchestrator(this.config.memory);
  this.pruning = new WorkflowEngine(this.config.pruning);
  this.autoCompactor = new AutoCompactor(...);
  this.autoRecapper = new AutoRecapper(...);
  this.autoConsolidator = new AutoConsolidator(...);
  this.autoAdvisor = new AutoAdvisor();
}
```

**After**: Uses Container:
```typescript
export class ContextIntelExtension extends ExtensionLifecycle {
  readonly name = "context-intel";
  readonly version = "0.9.0";

  private container: ContextIntelContainer;

  constructor(pi: ExtensionAPI) {
    super(pi);
    const config = loadContextIntelConfig();
    this.container = new ContextIntelContainer(config);
  }

  async onTurnEnd(_event: any, ctx: any): Promise<void> {
    const { counter, tokenTracker, threshold, pruning, automation } = this.container;

    counter.recordTurn();

    // Update token tracking
    const usage = ctx.getContextUsage?.();
    if (usage?.tokens) {
      tokenTracker.update({ total: usage.tokens, ... });
      updateContextWidget(ctx, tokenTracker.getRatio(), usage.tokens, usage.contextWindow);
    }

    // Check auto-compact via threshold
    const ratio = tokenTracker.getRatio();
    if (ratio !== null && threshold.isCompactNeeded(ratio)) {
      await this.autoCompactor.checkAndCompact(ctx);
      threshold.markCompact();
    }
  }

  async onAgentEnd(_event: any, ctx: any): Promise<void> {
    const { counter, threshold, automation } = this.container;
    counter.recordMessage();
    await automation.runAll(this.container, this.pi);
  }
}
```

---

### Step 8: Update Tests

| File | Change |
|------|--------|
| `tests/session-counter.test.ts` | NEW — test counting methods |
| `tests/token-tracker.test.ts` | NEW — test ratio calculations |
| `tests/threshold-monitor.test.ts` | NEW — test threshold checks |
| `tests/automation-registry.test.ts` | NEW — test handler registration + cooldown |
| `tests/advisor.test.ts` | REWRITE — test with mock AutomationContext |
| `tests/compactor.test.ts` | UPDATE — test with new constructor |
| `tests/recapper.test.ts` | UPDATE — test with new constructor |
| Existing pruning rule tests | UNCHANGED |

---

## DRY / OOP / SOLID Compliance (After Refactor)

| Principle | How |
|-----------|---|
| **DRY** | Types are defined once. `AutomationContext` is shared. `SessionCounter` methods don't duplicate threshold logic. `ThresholdMonitor` replaces 3 inline threshold checks. |
| **S** | `SessionCounter` → counts only. `TokenTracker` → tokens only. `ThresholdMonitor` → thresholds only. `AutoCompactor` → compaction only. |
| **O** | `AutomationRegistry` accepts new handlers via `.register()`. No edits needed to add a trigger. |
| **L** | All auto-modules take the same `AutomationContext`. Interchangeable constructors. |
| **I** | `SessionCountSnapshot` is minimal. `AutomationHandler` has 3 fields. No unused `analyze` stages. |
| **D** | `ContextIntelExtension` depends on `ContextIntelContainer`, not on concrete classes. Container builds the dependency graph. Tests can mock the container. |

---

## Code Metrics Target

| Metric | Current | Target | Delta |
|--------|---------|--------|-------|
| LOC | 2,865 | ~2,400 | **−465** |
| Files | 27 | ~30 | **+3** (new files) |
| Classes | 8 | 11 | **+3** (SessionCounter, TokenTracker, ThresholdMonitor) |
| Classes >200 LOC | 2 (ContextMonitor 119, orchestrator 268) | 0 | **−2** |
| Hardcoded triggers | 12 static methods + 4 const array | 16 registered handlers | **0** (same count, dynamic) |
| `any` types | ~8 | ~2 | **−6** |
| SRP violations | 1 (ContextMonitor) | 0 | **−1** |

---

## Implementation Order

```
Phase 1 (types + extraction):
  Step 1: SessionCounter     ← 30 min
  Step 2: TokenTracker       ← 15 min
  Step 3: ThresholdMonitor   ← 15 min
  Step 6: Clean types.ts     ← 15 min

Phase 2 (DI + automation):
  Step 4: di/Container.ts    ← 30 min
  Step 5: automation/registry.ts + triggers refactor ← 45 min

Phase 3 (integration):
  Step 7: Refactor index.ts  ← 30 min
  Step 8: Tests              ← 60 min

Total: ~4 hours
```

---

## Edge Cases

1. **Backward compatibility**: All existing commands (`/ctx`, `/handoff`, `/recap`) unchanged. The refactor is internal — no API changes.

2. **Config migration**: No config changes. `AutomationContext` reads from the existing `ContextIntelConfig`.

3. **Memory store**: Unchanged. The store (`store.ts`) is already well-factored.

4. **Pruning rules**: Unchanged. The registry pattern already exists there — we're bringing automation up to the same standard.

5. **Session without cwd/tokens**: `TokenTracker` returns null for `getRatio()`. `ThresholdMonitor` doesn't fire. Graceful degradation.

---

## Summary

This refactor:
- Splits the `ContextMonitor` god class into 3 focused classes (SRP)
- Introduces dependency injection via `Container` (DIP)
- Makes automation triggers open for extension via registry (OCP)
- Standardizes auto-module constructors on `AutomationContext` (LSP)
- Removes unused types (`PruningMeta`, `analyze` stage) (ISP)
- Eliminates magic numbers into config-driven thresholds (DRY)
- Total reduction: ~465 LOC (16%)
- Zero breaking changes to end users
- Zero changes to memory/pruning internals

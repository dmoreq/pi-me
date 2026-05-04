# Context Intelligence v2 — Refactor Plan

## Rationale

Currently 4 modules live independently across `session-lifecycle/` and `core-tools/`:

| Module | Location | Purpose | Lines |
|---|---|---|---|
| **Context Intel** | `session-lifecycle/context-intel/` | Handoff, recap, auto-compact suggestions | ~200 |
| **Context Pruning** | `session-lifecycle/context-pruning/` | Message dedup, error purging, recency | ~1,500 |
| **Context Window** | `foundation/context-window/` | Token usage monitor widget | ~80 |
| **Memory** | `core-tools/memory/` | Persistent cross-session memory (SQLite) | ~1,700 |
| **Usage Dashboard** | `session-lifecycle/usage-extension/` | Token/cost stats dashboard | ~1,200 |

**Problems:**
1. They all track conversation activity but in silos — redundant hooks, overlapping concerns
2. Context Pruning has its own file logger, config system, and registry — reinventing wheels
3. Context Intel only *suggests* actions (`/recap`, `/handoff`) without autonomously executing them
4. Memory stores facts but never feeds them into pruning decisions (e.g., "I always work in this file")
5. No unified telemetry — each module fires its own notifications without coordination
6. Usage dashboard is purely manual (`/usage` command) — never proactively surfaces cost/context info
7. ~4,700 total LOC that can be consolidated into ~2,500 with proper architecture

---

## Architecture: Context Intelligence v2

```
session-lifecycle/context-intel-v2/
├── index.ts                  ← Entry point, extension registration
├── types.ts                  ← All interfaces
├── config.ts                 ← Unified config loader (replaces 3 config systems)
│
├── core/
│   ├── context-monitor.ts    ← Token usage + message counting (replaces context-window)
│   ├── transcript-builder.ts ← Kept from v1, minor cleanup
│   ├── prompt-builder.ts     ← Kept from v1, expanded for new features
│   └── session-stats.ts      ← Session stats collection (replaces usage-dashboard core)
│
├── pruning/
│   ├── workflow.ts           ← prepare → process → filter pipeline (kept)
│   ├── rules/
│   │   ├── deduplication.ts  ← Kept
│   │   ├── recency.ts        ← Kept
│   │   ├── superseded-writes.ts ← Kept
│   │   ├── error-purging.ts  ← Kept
│   │   └── tool-pairing.ts   ← Kept
│   └── types.ts              ← Pruning-specific types
│
├── memory/
│   ├── store.ts              ← SQLite store (kept from core-tools/memory/src/store.ts)
│   ├── consolidator.ts       ← LLM-based extraction (kept from core-tools/memory/src/consolidator.ts)
│   ├── injector.ts           ← Context block builder (kept from core-tools/memory/src/injector.ts)
│   └── bootstrap.ts          ← Kept from core-tools/memory/src/bootstrap.ts
│
├── automation/
│   ├── triggers.ts           ← 9 telemetry automation triggers (consolidated)
│   ├── auto-compactor.ts     ← Auto-execute context compaction
│   ├── auto-recapper.ts      ← Auto-generate session recaps at boundaries
│   ├── auto-consolidator.ts  ← Auto-run memory consolidation
│   └── auto-advisor.ts       ← Smart suggestions based on unified signals
│
├── ui/
│   ├── context-widget.ts     ← Token usage bar (replaces context-window)
│   ├── usage-component.ts    ← /usage dashboard component (kept from usage-extension)
│   ├── cost-tracker.ts       ← /cost component (kept from usage-extension)
│   ├── pruning-status.ts     ← Pruning stats status bar
│   └── memory-status.ts      ← Memory stats status bar
│
├── commands/
│   ├── handoff.ts            ← /handoff command (kept)
│   ├── recap.ts              ← /recap command (kept)
│   ├── compact.ts            ← /compact command (kept)
│   ├── mem.ts                ← /mem command (kept from memory-mode.ts)
│   ├── memory-consolidate.ts ← /memory-consolidate (kept)
│   ├── usage.ts              ← /usage command (kept)
│   ├── cost.ts               ← /cost command (kept)
│   └── cp-stats.ts           ← /cp-stats (kept, now under /ctx)
│
└── tests/
    ├── context-monitor.test.ts
    ├── workflow.test.ts
    ├── auto-compactor.test.ts
    ├── auto-recapper.test.ts
    └── integration.test.ts
```

**Total target: ~2,500 LOC** (down from ~4,700)

---

## Phase 1: Foundation — Unified Types & Config

### 1.1 Create `session-lifecycle/context-intel-v2/types.ts`

```typescript
// Core entity
export interface ContextSession {
  id: string;
  cwd: string;
  startedAt: number;
  messageCount: number;
  tokenUsage: TokenUsage;
  prunedCount: number;
}

export interface TokenUsage {
  total: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  contextWindow: number;
}

// Pruning
export interface PruningConfig {
  enabled: boolean;
  keepRecentCount: number;
  rules: string[];
}

// Memory
export interface MemoryConfig {
  dbPath: string;
  lessonInjection: "all" | "selective";
  autoConsolidate: boolean;
  autoConsolidateMinMessages: number;
}

// Automation
export interface AutomationConfig {
  autoCompactThreshold: number;      // % of context window
  autoCompactEnabled: boolean;
  autoRecapEnabled: boolean;
  autoConsolidateEnabled: boolean;
  autoAdviseEnabled: boolean;
}

// Unified config
export interface ContextIntelConfig {
  enabled: boolean;
  pruning: PruningConfig;
  memory: MemoryConfig;
  automation: AutomationConfig;
}

export const DEFAULT_CONFIG: ContextIntelConfig = {
  enabled: true,
  pruning: {
    enabled: true,
    keepRecentCount: 10,
    rules: ["deduplication", "superseded-writes", "error-purging", "tool-pairing", "recency"],
  },
  memory: {
    dbPath: "~/.pi/context-intel/memory.db",
    lessonInjection: "selective",
    autoConsolidate: true,
    autoConsolidateMinMessages: 3,
  },
  automation: {
    autoCompactThreshold: 80,
    autoCompactEnabled: true,
    autoRecapEnabled: true,
    autoConsolidateEnabled: true,
    autoAdviseEnabled: true,
  },
};
```

### 1.2 Create `session-lifecycle/context-intel-v2/config.ts`

Replace **3 separate config systems** (bunfig for pruning, JSON settings for memory, inline for context-window) with one:

```typescript
// Single config loader using existing shared/pi-config.ts pattern (Zod + JSONC)
import { loadConfigOrDefault } from "../../shared/pi-config.js";
import { z } from "zod";
import type { ContextIntelConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

const ConfigSchema = z.object({
  enabled: z.boolean().optional(),
  pruning: z.object({
    enabled: z.boolean().optional(),
    keepRecentCount: z.number().int().positive().optional(),
    rules: z.array(z.string()).optional(),
  }).optional(),
  memory: z.object({
    dbPath: z.string().optional(),
    lessonInjection: z.enum(["all", "selective"]).optional(),
    autoConsolidate: z.boolean().optional(),
    autoConsolidateMinMessages: z.number().int().positive().optional(),
  }).optional(),
  automation: z.object({
    autoCompactThreshold: z.number().min(0).max(100).optional(),
    autoCompactEnabled: z.boolean().optional(),
    autoRecapEnabled: z.boolean().optional(),
    autoConsolidateEnabled: z.boolean().optional(),
    autoAdviseEnabled: z.boolean().optional(),
  }).optional(),
});

export function loadContextIntelConfig(): ContextIntelConfig {
  return loadConfigOrDefault({
    filename: "context-intel.jsonc",
    schema: ConfigSchema,
    defaults: DEFAULT_CONFIG,
  });
}
```

**Removes dependency on `bunfig` for pruning config** — uses the existing `shared/pi-config.ts` Zod+JSONC pattern that's already proven for `file-collector` and `file-picker`.

### 1.3 Create `session-lifecycle/context-intel-v2/index.ts`

The unified entry point — replaces all 5 separate registrations:

```typescript
/**
 * Context Intelligence v2 — Unified context management.
 *
 * Consolidates:
 *   - context-intel      (handoff, recap, auto-compact suggestions)
 *   - context-pruning    (message dedup, error purging)
 *   - context-window     (token usage widget)
 *   - memory             (persistent SQLite memory)
 *   - usage-dashboard    (token/cost stats)
 *
 * SOLID:
 *   - S: Each sub-module has one job (pruning, memory, automation, UI)
 *   - O: New rules/triggers added via registry, not by editing core
 *   - L: All automation triggers implement AutoTrigger interface
 *   - I: Focused interfaces per concern (PruneRule, MemoryStore, AutoTrigger)
 *   - D: Core depends on interfaces (ConfigReader, MessageStore, TelemetryBus)
 *
 * Automation (replaces manual commands):
 *   - Auto-compact: prune at 80% context threshold instead of suggesting it
 *   - Auto-recap: generate summary at session boundaries automatically
 *   - Auto-consolidate: extract memory facts when ≥3 user messages accumulated
 *   - Auto-advise: surface telemetry-backed suggestions at natural moments
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { loadContextIntelConfig } from "./config.ts";
import type { ContextIntelConfig, ContextSession } from "./types.ts";
import { ContextMonitor } from "./core/context-monitor.ts";
import { MemoryOrchestrator } from "./memory/bootstrap.ts";
import { WorkflowEngine } from "./pruning/workflow.ts";
import { AutoCompactor } from "./automation/auto-compactor.ts";
import { AutoRecapper } from "./automation/auto-recapper.ts";
import { AutoConsolidator } from "./automation/auto-consolidator.ts";
import { AutoAdvisor } from "./automation/auto-advisor.ts";

export class ContextIntelV2Extension extends ExtensionLifecycle {
  readonly name = "context-intel-v2";
  readonly version = "0.1.0";
  protected readonly description = "Unified context management: pruning, memory, automation, dashboard";
  protected readonly tools = ["memory_search", "memory_remember", "memory_forget", "memory_lessons", "memory_stats"];
  protected readonly events = [
    "session_start", "session_shutdown", "session_before_switch",
    "turn_end", "agent_end", "before_agent_start", "context", "tool_result",
  ];

  private config: ContextIntelConfig;
  private session: ContextSession | null = null;
  private monitor: ContextMonitor;
  private memory: MemoryOrchestrator;
  private pruning: WorkflowEngine;
  private autoCompactor: AutoCompactor;
  private autoRecapper: AutoRecapper;
  private autoConsolidator: AutoConsolidator;
  private autoAdvisor: AutoAdvisor;

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.config = loadContextIntelConfig();
    this.monitor = new ContextMonitor();
    this.memory = new MemoryOrchestrator(this.config.memory);
    this.pruning = new WorkflowEngine(this.config.pruning);
    this.autoCompactor = new AutoCompactor(this.config.automation, this.monitor);
    this.autoRecapper = new AutoRecapper();
    this.autoConsolidator = new AutoConsolidator(this.config.memory, this.memory);
    this.autoAdvisor = new AutoAdvisor();
  }

  async onSessionStart(event: any, ctx: any) { /* ... */ }
  async onSessionShutdown() { /* auto-consolidate memory, save stats */ }
  async onSessionBeforeSwitch() { /* auto-recap, auto-consolidate */ }
  async onTurnEnd() { /* update monitor, check auto-compact threshold */ }
  async onAgentEnd(event: any, ctx: any) { /* count tool calls, check triggers */ }
  async onBeforeAgentStart(event: any, ctx: any) { /* inject memory context */ }
  async onContext(event: any, ctx: any) { /* run pruning pipeline */ }
  async onToolResult(event: any, ctx: any) { /* update stats, track files */ }

  // Register all commands and register all tools
  register(): void {
    super.register(); // wire lifecycle hooks
    this.registerMemoryTools();
    this.registerCommands();
    this.registerWidgets();
    this.registerAutomationHooks();
  }
}

export default function (pi: ExtensionAPI) {
  const ext = new ContextIntelV2Extension(pi);
  ext.register();
}
```

---

## Phase 2: Core — Unified Data Layer

### 2.1 Context Monitor (`core/context-monitor.ts`)

Replaces the ad-hoc `sessionMessageCount` + `lastRecapAt` in the old ContextIntel + the `context-window` widget.

```typescript
export class ContextMonitor {
  private messageCount = 0;
  private toolCallCount = 0;
  private touchedFiles = new Set<string>();
  private tokenUsage: TokenUsage | null = null;

  reset(): void { /* zero everything */ }
  incrementMessage(): void { this.messageCount++; }
  recordToolCall(name: string): void { this.toolCallCount++; }
  recordFileWrite(path: string): void { this.touchedFiles.add(path); }
  updateTokenUsage(usage: TokenUsage): void { this.tokenUsage = usage; }

  getStats(): SessionStats { /* return aggregated snapshot */ }
  getContextUsageRatio(): number { /* tokenUsage.total / tokenUsage.contextWindow */ }
  getCompactSuggestion(): string | null {
    const ratio = this.getContextUsageRatio();
    if (ratio >= 0.9) return "critical";
    if (ratio >= 0.8) return "warn";
    return null;
  }
}
```

### 2.2 Session Stats (`core/session-stats.ts`)

Replaces `usage-extension-core.ts` data collection. Feeds both the `/usage` dashboard AND automation triggers.

```typescript
export class SessionStatsCollector {
  async collect(signal?: AbortSignal): Promise<UsageData> { /* ... */ }
  async scanLogs(daysBack: number): Promise<ProviderCost[]> { /* ... */ }
  getCurrentSessionStats(): SessionStats { /* ... */ }
}
```

### 2.3 Transcript Builder + Prompt Builder

Kept largely as-is from `context-intel/`. Minor cleanup:
- Remove dead `buildDependencyAnalysis` (unused)
- Add `buildCompactSummary` for auto-compaction
- Add `buildSessionRecap` for auto-recap

---

## Phase 3: Pruning Pipeline (Kept, Simplified)

### 3.1 Remove redundant infrastructure

| Removed | Replaced by |
|---|---|
| `logger.ts` (rotating file logger) | Unified telemetry + `console.debug` |
| `config.ts` (bunfig) | `config.ts` in Phase 1 (Zod + JSONC) |
| `registry.ts` (Map-based registry) | Static array in workflow (5 rules, not dynamic) |
| 6 command files (`cmds/`) | Single `/ctx` command with subcommands |

### 3.2 Simplify the workflow

The `prepare → process → filter` pipeline works well and is kept, but:
- Remove the registry abstraction (5 rules are known at compile time)
- Remove the file logger (use pi-telemetry for errors, `console.debug` for debug)
- Inline `metadata.ts` helpers into `workflow.ts`
- Remove `MessageWithMetadata` wrapper — use a plain `Map<number, PruningMeta>` during pipeline execution instead of wrapping every message

### 3.3 Target: pruning/ drops from ~700 LOC to ~350 LOC

---

## Phase 4: Memory (Moved, No Logic Changes)

The `core-tools/memory/src/` modules are well-structured and proven. The move is purely structural:

| File | Moves To | Change |
|---|---|---|
| `core-tools/memory/src/store.ts` | `context-intel-v2/memory/store.ts` | None |
| `core-tools/memory/src/consolidator.ts` | `context-intel-v2/memory/consolidator.ts` | None |
| `core-tools/memory/src/injector.ts` | `context-intel-v2/memory/injector.ts` | None |
| `core-tools/memory/src/bootstrap.ts` | `context-intel-v2/memory/bootstrap.ts` | Minor: accept config from parent |
| `core-tools/memory/index.ts` | DELETED | Logic absorbed by ContextIntelV2Extension |
| `core-tools/memory-mode.ts` | `context-intel-v2/commands/mem.ts` | `/mem` command extracted from the TUI-heavy file |
| `core-tools/memory/src/index.ts` | DELETED | Logic absorbed by MemoryOrchestrator |

---

## Phase 5: Automation — The "Agent Does It" Layer

This is the **core redesign**. Instead of suggesting actions, v2 *executes* them automatically at the right moment.

### 5.1 Auto Compactor (`automation/auto-compactor.ts`)

**Before:** Context Intel's `onTurnEnd` counts messages and suggests `/recap` when >20 messages and 10+ minutes idle.

**After:** When context usage exceeds `autoCompactThreshold` (default 80%), it:

1. Runs the pruning pipeline (already happens on every `context` event)
2. If still over threshold after pruning, calls `ctx.compact()` with a summary generated from the last N messages
3. Notifies via telemetry: `"📦 Auto-compacted at 82% — preserved last 10 messages"`

```typescript
export class AutoCompactor {
  constructor(
    private config: AutomationConfig,
    private monitor: ContextMonitor,
  ) {}

  async checkAndCompact(ctx: any): Promise<boolean> {
    if (!this.config.autoCompactEnabled) return false;
    const ratio = this.monitor.getContextUsageRatio();
    if (ratio === null || ratio < this.config.autoCompactThreshold / 100) return false;

    // Auto-compact
    const summary = PromptBuilder.buildCompactSummary(
      this.monitor.getRecentMessages(10),
    );
    await ctx.compact({ summary });
    getTelemetry()?.notify(`📦 Auto-compacted at ${Math.round(ratio * 100)}%`, {
      package: "context-intel-v2",
      severity: "info",
      badge: { text: "auto-compact", variant: "warning" },
    });
    return true;
  }
}
```

### 5.2 Auto Recapper (`automation/auto-recapper.ts`)

**Before:** `/recap` is a manual command. Messages pile up until the user remembers to run it.

**After:** At session boundaries (`session_shutdown`, `session_before_switch`), auto-generates a recap and stores it in memory.

```typescript
export class AutoRecapper {
  async checkAndRecap(ctx: any, monitor: ContextMonitor): Promise<void> {
    if (!this.config.autoRecapEnabled) return;
    const stats = monitor.getStats();
    if (stats.messageCount < 5) return; // not enough to recap

    // Generate recap via LLM (reuse existing PromptBuilder.buildRecap)
    const transcript = TranscriptBuilder.buildTranscript(ctx.messages, { fromLastUser: false });
    const recap = await generateRecap(transcript); // LLM call

    // Store in memory as a session fact
    memoryStore.setSemantic(
      `session.${sessionId}.recap`,
      recap,
      0.8,
      "consolidation",
    );

    getTelemetry()?.notify(`📋 Auto-recap saved for session`, {
      package: "context-intel-v2",
      severity: "info",
      badge: { text: "auto-recap", variant: "success" },
    });
  }
}
```

### 5.3 Auto Consolidator (`automation/auto-consolidator.ts`)

**Before:** Memory consolidates on `session_shutdown` only if there are ≥3 pending user messages. Requires `/memory-consolidate` command otherwise.

**After:** Same trigger conditions, but:
- Consolidates at both `session_shutdown` **and** `session_before_switch` (covers `/resume` and `/new`)
- Stores consolidation results as telemetry events so the user sees badge notifications
- If consolidation finds ≥5 new facts, sends a brief notification: `"🧠 Learned 3 facts, 2 lessons from this session"`

### 5.4 Auto Advisor (`automation/auto-advisor.ts`)

Replaces the ad-hoc `if (messageCount > 20 && timeSinceRecap > 10min)` check with a composable trigger system:

```typescript
export interface AutoAdviceTrigger {
  id: string;
  check(stats: SessionStats, ctx: any): string | null; // returns advice text or null
  cooldownMs: number; // min interval between firings
}

// Built-in triggers:
const triggers: AutoAdviceTrigger[] = [
  {
    id: "deep-context",
    check: (stats) => stats.messageCount > 50 ? "Context is deep (50+ messages)." : null,
    cooldownMs: 300_000, // 5 min
  },
  {
    id: "high-activity",
    check: (stats) => stats.toolCallCount > 10 ? `High activity (${stats.toolCallCount} tool calls). Consider a checkpoint.` : null,
    cooldownMs: 120_000,
  },
  {
    id: "many-files",
    check: (stats) => stats.fileCount > 15 ? `${stats.fileCount} files touched — ready for handoff.` : null,
    cooldownMs: 120_000,
  },
  {
    id: "context-crowded",
    check: (stats, ctx) => {
      const ratio = ctx.getContextUsage()?.ratio;
      return ratio > 0.85 ? "Context nearly full (85%+). Auto-compacting soon." : null;
    },
    cooldownMs: 60_000,
  },
];
```

These fire via telemetry badge notifications at natural moments (`onTurnEnd`, `onAgentEnd`), creating a ambient awareness layer without being intrusive.

---

## Phase 6: UI — Widgets & Commands

### 6.1 Widgets (TUI footer, always visible)

| Widget | Source | New Location |
|---|---|---|
| `context` — token bar `[▓▓░░] 45%` | `foundation/context-window/` | `ui/context-widget.ts` |
| `pruning-stats` — `✂️  Pruning: 12/150 (8%)` | `context-pruning/index.ts` (STATUS_KEY) | `ui/pruning-status.ts` |
| `memory-stats` — `🧠 Memory: 45 facts, 12 lessons` | `core-tools/memory/index.ts` (setStatus) | `ui/memory-status.ts` |

### 6.2 Commands

| Command | Source | New Location | Change |
|---|---|---|---|
| `/handoff` | context-intel | `commands/handoff.ts` | Asset (unchanged) |
| `/recap` | context-intel | `commands/recap.ts` | Enhanced (shows last auto-recap from memory) |
| `/compact` | context-intel | `commands/compact.ts` | Enhanced (shows pruning stats before/after) |
| `/mem` | memory-mode.ts | `commands/mem.ts` | Extracted from 400-line TUI file |
| `/memory-consolidate` | core-tools/memory | `commands/memory-consolidate.ts` | Kept |
| `/usage` | usage-extension | `commands/usage.ts` | Kept |
| `/cost` | usage-extension | `commands/cost.ts` | Kept |
| `/cp-stats` | context-pruning | `commands/cp-stats.ts` | Simplified |
| `/cp-toggle` | context-pruning | REMOVED | Toggle via `/ctx pruning on\|off` |
| `/cp-debug` | context-pruning | REMOVED | Toggle via `/ctx debug on\|off` |
| `/cp-init` | context-pruning | REMOVED | Config file is now `context-intel.jsonc` |
| `/cp-logs` | context-pruning | REMOVED | Logs via telemetry instead |

All pruning commands replaced by one unified `/ctx` command:

```
/ctx stats           — Show unified stats (pruning + memory + context)
/ctx pruning on|off  — Toggle pruning
/ctx memory on|off   — Toggle memory persistence
/ctx compact on|off  — Toggle auto-compaction
/ctx recap on|off    — Toggle auto-recap
/ctx debug on|off    — Toggle debug logging
/ctx config          — Show current config
```

---

## Phase 7: Cleanup — Remove Legacy Modules

After v2 is working and tested:

### Files to delete:

| File | LOC |
|---|---|
| `session-lifecycle/context-intel/` (entire dir) | ~200 |
| `session-lifecycle/context-pruning/` (entire dir) | ~1,500 |
| `session-lifecycle/usage-extension/` (entire dir) | ~1,200 |
| `foundation/context-window/context-window.ts` | ~80 |
| `core-tools/memory/` (entire dir) | ~1,700 |
| `core-tools/memory-mode.ts` | ~450 |
| `foundation/index.ts` — remove `contextWindow(pi)` line | — |
| `session-lifecycle/index.ts` — remove `contextPruning`, `usageExtension`, `registerSessionName` calls | — |
| `core-tools/index.ts` — remove `memory(pi)` call | — |

**Total removed: ~5,130 LOC**

### Files to update:

| File | Change |
|---|---|
| `foundation/index.ts` | Remove `contextWindow` import and call |
| `session-lifecycle/index.ts` | Replace `ContextIntelExtension` + `contextPruning` + `usageExtension` + `welcomeOverlay` + `registerSessionName` with single `ContextIntelV2Extension` |
| `core-tools/index.ts` | Remove `memory(pi)` call (subset A) |
| `package.json` | Remove `bunfig` dependency (no longer needed after removing pruning config) |
| `shared/telemetry-automation.ts` | Can be removed — triggers live in `automation/triggers.ts` now |

---

## Phase 8: Verification

1. **Session start**: monitor resets, memory store opens, context widget shows 0%, pruning shows "--"
2. **Conversation**: each turn updates message count, tool call count, file set
3. **Context event**: pruning pipeline runs, removes duplicates, preserves tool pairs
4. **80% threshold**: auto-compactor fires, compact + notify
5. **Session switch**: auto-recap generated and stored, auto-consolidation runs
6. **Session end**: auto-recap, auto-consolidation, monitor stats saved
7. **Commands**: `/ctx`, `/mem`, `/usage`, `/cost`, `/handoff`, `/recap` all work
8. **Tools**: `memory_search`, `memory_remember`, `memory_forget`, `memory_lessons`, `memory_stats` all work
9. **Telemetry**: badge notifications fire for auto-compact, auto-recap, auto-advice

---

## Migration Path

No breaking changes for end users:
- `/ctx` replaces 6 separate pruning commands (backward-compat aliases for one release)
- `/mem` works identically
- `/usage`, `/cost` work identically
- `/handoff`, `/recap` work identically
- All memory tools keep the same names and signatures
- Config moves from `cp.config.ts` (bunfig) + `settings.json memory.*` to `~/.pi/agent/context-intel.jsonc`. Old config values are read in a migration pass.

---

## Summary

| Metric | Before | After | Delta |
|---|---|---|---|
| Modules | 5 separate | 1 unified | **−4** |
| Entry points | 4 (`foundation`, `session-lifecycle`, `core-tools`, standalone) | 1 (`session-lifecycle/context-intel-v2`) | — |
| LOC | ~4,700 | ~2,500 | **−47%** |
| Config systems | 3 (bunfig, JSON settings, inline) | 1 (Zod + JSONC) | **−2** |
| Loggers | 1 (rotating file logger) | 0 (uses pi-telemetry) | **−1** |
| Manual commands | 6 pruning + 1 usage + 1 recaps | 1 unified `/ctx` | **−7** |
| Automation | Suggests only | Executes automatically | **New capability** |
| Telemetry | 9 separate triggers | 9 triggers + 3 auto-execution events | **+3** |

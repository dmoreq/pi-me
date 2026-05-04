# Extension Consolidation & Agent Automation Plan

## Overview

This plan restructures the pi-me extension ecosystem from 20+ modules into a cleaner, SOLID architecture with fewer, more capable extensions. The core vision: **make extensions automatic by using pi-telemetry as a sensing layer that drives proactive agent behavior, reducing the need for manual human commands.**

---

## Part A: Consolidation Matrix

### A1. Merges (extensions to combine into unified modules)

| Source Extensions | Target Module | Rationale |
|---|---|---|
| `foundation/permission` + `foundation/safe-ops` | `foundation/permission/` | Both intercept `tool_call` for bash commands — permission handles tier-based blocking, safe-ops handles git/rm protection. They share state patterns (approve/block lists) and notification infrastructure. Merge into a unified 3-layer guard: (1) safety patterns, (2) permission tiers, (3) git/rm safe-ops. |
| `session-lifecycle/welcome-overlay` + `session-lifecycle/session-name` | `session-lifecycle/welcome/` | Both set UI header/status on `session_start` and `input`. Welcome sets the permanent header; session-name sets the session label. Combine into a unified "Session Presentation" module that manages the header, welcome banner, and session name as a cohesive unit. |
| `core-tools/memory` + `authoring/skill-bootstrap` | `core-tools/memory/` | Skill-bootstrap generates `.pi/skills/SKILL.md` files — which are effectively memory about the project. The memory system already has a `before_agent_start` hook that injects context. Merge skill-bootstrap as `memory.projectContext()` — auto-generating project skills and storing them as structured memory. |
| `foundation/context-window` + `session-lifecycle/usage-extension` | `foundation/context-monitor/` | Both track usage statistics — context-window tracks token usage (`turn_end`), usage-extension tracks cost (`/usage` command). Merge into a single "Context & Usage Monitor" that displays both in a unified widget/status area and auto-suggests compaction. |

### A2. Consolidations (absorb smaller extensions into larger ones)

| Source Extensions | Target | Rationale |
|---|---|---|
| `session-lifecycle/context-pruning` → `session-lifecycle/context-intel` | `session-lifecycle/context-intel/` | Context pruning optimizes token usage by deduplicating/removing messages. Context-intel already handles handoff, auto-compact, and session recap. Pruning is a tactical implementation detail of the broader context intelligence strategy. Merge into context-intel as `ContextPruningRule` plugins. |
| `core-tools/read-guard` → `session-lifecycle/context-intel` | `session-lifecycle/context-intel/` | Read Guard checks if files have been read before editing. This is a context-awareness concern — knowing what the agent has seen. Move from `core-tools` to become a `ContextAwarenessPlugin` inside context-intel, refactored to use the same telemetry-driven approach. |
| `core-tools/formatter` → `core-tools/code-quality` | `core-tools/code-quality/` | Formatter runs `formatFile()` after write/edit tool calls. Code-quality already has a pipeline that runs `format → fix → analyze`. The formatter is the first stage of that pipeline. Merge formatter runners into code-quality's `RunnerRegistry` and remove the standalone formatter extension. |

### A3. Removals (extensions to delete)

| Extension | Reason |
|---|---|
| `core-tools/code-actions` | The `/code` command (picking snippets from assistant messages) overlaps with the built-in TUI snippet experience. Low usage, high maintenance. Remove entirely. |
| `content-tools/file-picker` | File pattern extraction from AI messages is redundant — the agent can already read files. The tool is complex (resolves editors, quicklook, etc.) and rarely used via AI. Remove entirely. |

### Summary of resulting file structure

```
foundation/
├── index.ts                          # → loads: secrets, permission (merged), context-monitor
├── permission/                       # ← merged: permission.ts + safe-ops.ts
│   ├── permission.ts                 #    unified entry: 3-layer guard
│   ├── permission-core.ts            #    same
│   ├── path-guard.ts                 #    same
│   ├── safety-patterns.ts            #    same
│   └── tests/
├── context-monitor/                  # ← NEW: merged context-window + usage-extension
│   ├── context-monitor.ts            #    unified entry
│   ├── context-widget.ts             #    widget rendering
│   ├── usage-dashboard.ts            #    /usage command
│   └── tests/
├── secrets/                          # unchanged
└── safe-ops.ts                       # DELETED (merged into permission/)

session-lifecycle/
├── index.ts                          # → loads: context-intel (merged), welcome, checkpoint, skill-args
├── context-intel/                    # ← merged: handoff, auto-compact, recap, pruning, read-guard
│   ├── index.ts                      #    entry → ContextIntelExtension
│   ├── intel-core.ts                 #    core logic
│   ├── transcript-builder.ts         #    same
│   ├── prompt-builder.ts             #    same
│   ├── plugins/                      #    ← NEW: plugin system
│   │   ├── context-pruning.ts        #    moved from context-pruning/
│   │   └── read-awareness.ts         #    moved from read-guard/
│   └── tests/
├── welcome/                          # ← NEW: merged welcome-overlay + session-name
│   ├── welcome.ts                    #    header + session name
│   └── tests/
├── git-checkpoint/                   # unchanged
├── usage-extension/                  # DELETED (merged into context-monitor)
├── context-pruning/                  # DELETED (merged into context-intel)
├── welcome-overlay/                  # DELETED (merged into welcome/)
└── session-name.ts                   # DELETED (merged into welcome/)

core-tools/
├── index.ts                          # → subset A/B, without code-actions
├── code-quality/                     # ← merged: code-quality + formatter
│   ├── index.ts                      #    unified entry
│   ├── pipeline.ts                   #    same
│   ├── registry.ts                   #    expanded with formatter runners
│   ├── runners/                      #    ← moved from formatter/
│   │   ├── prettier.ts
│   │   ├── eslint.ts
│   │   ├── biome.ts
│   │   └── ...
│   └── tests/
├── memory/                           # ← merged: memory + skill-bootstrap
│   ├── index.ts                      #    same
│   ├── src/
│   │   ├── index.ts                  #    same
│   │   ├── store.ts                  #    same
│   │   ├── consolidator.ts           #    same
│   │   ├── injector.ts               #    same
│   │   ├── bootstrap.ts              #    same
│   │   ├── project-context.ts        #    ← NEW: skill-bootstrap as memory plugin
│   │   └── ...
│   └── tests/
├── file-intelligence/                # unchanged
├── task-plan/                        # MERGED: planning + task-orchestration

├── subprocess-orchestrator/          # unchanged
├── thinking-steps/                   # unchanged
├── code-actions/                     # DELETED
├── read-guard/                       # DELETED (merged into context-intel)
└── formatter/                        # DELETED (merged into code-quality)

content-tools/
├── index.ts                          # → without file-picker
├── web-tools/                        # unchanged
├── repeat/                           # unchanged
├── github.ts                         # unchanged
└── file-picker/                      # DELETED

authoring/
├── index.ts                          # → without skill-bootstrap
└── commit-helper/                    # unchanged

shared/
├── lifecycle.ts                      # unchanged
├── telemetry-automation.ts           # ← expanded with 3 new automations
├── ext-state.ts                      # unchanged
└── ...
```

---

## Part B: Agent Automation Design (pi-telemetry-driven)

### Core principle: "Sense → Decide → Act → Inform"

Instead of requiring the user to type `/handoff`, `/recap`, `/compact`, `/usage`, or `/memory-consolidate`, the extensions should **automatically detect conditions** and **proactively inform/act**.

### B1. Telemetry Automation Framework (existing + expanded)

Currently we have 9 triggers in `TelemetryAutomation`. We'll add 3 more:

**New Trigger 10 — Session Lifecycle Automation**
```typescript
static sessionStale(elapsedMinutes: number, messageCount: number): AutomationTrigger | null {
  if (elapsedMinutes > 30 && messageCount > 20) {
    return {
      id: "session-stale",
      condition: true,
      message: `⏰ Session has ${messageCount} messages over ${elapsedMinutes}m. Auto-handoff suggested.`,
      badge: { text: "session-stale", variant: "warning" },
    };
  }
  return null;
}
```

**New Trigger 11 — Memory Consolidation Hint**
```typescript
static memoryReadyForConsolidation(pendingMessages: number): AutomationTrigger | null {
  if (pendingMessages >= 5) {
    return {
      id: "memory-consolidation",
      condition: true,
      message: `🧠 ${pendingMessages} new messages ready for memory consolidation.`,
      badge: { text: "memory-ready", variant: "info" },
    };
  }
  return null;
}
```

**New Trigger 12 — Context Pressure Warning**
```typescript
static contextPressure(usedTokens: number, totalTokens: number): AutomationTrigger | null {
  const ratio = usedTokens / totalTokens;
  if (ratio > 0.85) {
    return {
      id: "context-pressure",
      condition: true,
      message: `📊 Context at ${Math.round(ratio * 100)}%. Auto-compacting recommended.`,
      badge: { text: "high-context", variant: "error" },
    };
  }
  return null;
}
```

### B2. Automation Managers — agents that act, not just inform

Each merged extension module will get an **AutomationManager** that runs during lifecycle hooks and decides whether to inform the user or take automatic action:

```typescript
// Concept — lives in each extension
class AutomationManager {
  private config: AutomationConfig;
  
  constructor(config: Partial<AutomationConfig>) { ... }

  /** Evaluate all triggers and return actions to take */
  async evaluate(ctx: ExtensionContext): Promise<AutomationAction[]> {
    const actions: AutomationAction[] = [];
    
    for (const trigger of this.triggers) {
      const result = await trigger.evaluate(ctx);
      if (result) actions.push(result);
    }
    
    return actions;
  }
  
  /** Execute actions — notify or auto-perform */
  async execute(actions: AutomationAction[], ext: ExtensionLifecycle): Promise<void> {
    for (const action of actions) {
      if (action.type === "notify") {
        ext.notify(action.message, { severity: action.severity, badge: action.badge });
      } else if (action.type === "auto-act") {
        await action.perform(ctx);
        ext.notify(`✅ Auto-${action.name} completed`, { badge: { text: action.name, variant: "success" } });
      }
      // Track via telemetry
      ext.track(action.name, { ...action.metadata });
    }
  }
}
```

### B3. Extension-specific Automation Plans

#### ContextIntelExtension automation
- **Auto-compact**: When context reaches 85% (Trigger 12), automatically run compaction instead of just warning
- **Auto-handoff hint**: When session is stale (Trigger 10), suggest /handoff with one-click prompt
- **Periodic recap**: Every 15 minutes of active conversation, auto-trigger a lightweight recap

#### PermissionExtension automation  
- **Auto-escalation suggestions**: When a command fails at current level 3+ times, suggest raising the level
- **Safety pattern learning**: When same safety pattern is approved 3+ times, automatically add to session allow-list

#### MemoryExtension automation
- **Auto-consolidation**: When pending messages >= 5 (Trigger 11), auto-consolidate instead of waiting for shutdown
- **Context injection telemetry**: Track which memories are injected and how often they're useful

#### ContextMonitor automation
- **Auto-widget updates**: Push context/usage widget updates via telemetry heartbeat instead of `turn_end` polling
- **Cost alerts**: When session cost exceeds configurable threshold, notify user

---

## Part C: SOLID & DRY Refactoring

### C1. Extract shared patterns into base classes

**Problem**: `CodeQualityExtension`, `ContextIntelExtension`, and future extensions each duplicate:
- Telemetry registration boilerplate (`registerPackage`, `t.heartbeat`)
- Hook wiring (which lifecycle methods to subscribe)
- `notify()` and `track()` wrappers

**Fix**: The existing `ExtensionLifecycle` base class already handles this. Ensure ALL new extensions (including the merged ones) extend it consistently.

### C2. Plugin architecture for context-intel

**Problem**: `context-pruning/` has 5 rule modules plus command handlers. `read-guard/` has its own guard module. These need to be composable plugins.

**Fix**:
```typescript
// session-lifecycle/context-intel/plugins/plugin.ts
export interface ContextPlugin {
  readonly name: string;
  readonly hooks: ContextPluginHook[];
  
  /** Called during context event — can modify messages before LLM call */
  onContext?(messages: Message[]): Promise<Message[]>;
  
  /** Called during session_start — initialize state */
  onSessionStart?(ctx: ExtensionContext): Promise<void>;
  
  /** Called during tool_call — can intercept before execution */
  onToolCall?(event: ToolCallEvent): Promise<{ block?: boolean; reason?: string } | undefined>;
}
```

### C3. Unified command pattern

**Problem**: Many extensions register commands with similar patterns (settings, toggle, status). Each reimplements the dialog flow.

**Fix**: Extract a `CommandBuilder` utility:

```typescript
// shared/command-builder.ts
export class CommandBuilder {
  static settings<T extends Record<string, any>>(
    pi: ExtensionAPI, 
    name: string, 
    settings: SettingDefinition<T>
  ): void { ... }
  
  static toggle(pi: ExtensionAPI, name: string, opts: ToggleOptions): void { ... }
  
  static status(pi: ExtensionAPI, name: string, getStatus: () => string): void { ... }
}
```

### C4. Remove code duplication found in audit

**Watch for these patterns during implementation**:
1. **Safe-ops + Permission**: Both parse commands, both check patterns, both prompt via `confirmDialog`. Unify the pattern-matching and dialog logic.
2. **Formatter + Code-quality**: Both have runner registries. Formatter's runners (prettier, eslint, biome, etc.) become code-quality runners seamlessly.
3. **Welcome-overlay + Session-name**: Both set UI status on `session_start`/`session_shutdown`. Share the `STATUS_KEY` management.
4. **Memory + Skill-bootstrap**: Both analyze project structure. Merge scanning logic.

---

## Part D: Test Strategy

### D1. Existing test baseline: 545 passing, 0 failing

Preserve all existing tests. New tests to add:

| Module | New Tests | Coverage Focus |
|---|---|---|
| `foundation/permission/` (merged) | +15 | Safe-ops git patterns, rm→trash, unified 3-layer guard |
| `foundation/context-monitor/` | +10 | Widget updates, cost tracking, automation triggers |
| `session-lifecycle/context-intel/` | +20 | Plugin system, pruning rules as plugins, read-awareness plugin |
| `session-lifecycle/welcome/` | +8 | Header rendering, session name behavior, combined lifecycle |
| `core-tools/code-quality/` (merged) | +15 | Formatter runners in pipeline, unified config |
| `core-tools/memory/` (merged) | +8 | Project context integration, auto-bootstrap |
| `shared/telemetry-automation.ts` | +6 | New triggers (10, 11, 12) |
| `shared/command-builder.ts` | +12 | Settings, toggle, status command patterns |

**Target: 639+ tests** (94 new tests).

### D2. Test types per module

| Test Type | Description |
|---|---|
| **Unit** | Pure functions, individual classes, plugin logic |
| **Integration** | Extension lifecycle, telemetry registration, hook wiring |
| **Regression** | Every removed file — verify its functionality is preserved in the new location/module |
| **Automation** | Trigger conditions fire correctly, auto-actions don't fire false positives |

---

## Part E: Implementation Phases (ordered for minimal disruption)

### Phase 1: Infrastructure (safe — no functional changes)
**Files changed**: `foundation/permission/`, `shared/`, `foundation/`

1. **Rename/move**: Merge `safe-ops.ts` logic into `foundation/permission/permission.ts` as `SafeOpsLayer`
   - Create `foundation/permission/safe-ops-layer.ts` with the git/rm interception logic
   - Update `foundation/permission/permission.ts` to compose 3 layers: SafetyPatterns → PermissionTier → SafeOps
   - Delete `foundation/safe-ops.ts`
   - Update `foundation/index.ts` to only load permission (which now includes safe-ops)

2. **Add new automation triggers**: Extend `shared/telemetry-automation.ts` with triggers 10-12

3. **Create `shared/command-builder.ts`**: Extract common command patterns

**Tests**: All existing + 20 new. Run: `npm test`

**Commit**: `refactor: merge safe-ops into permission with 3-layer guard; add automation triggers 10-12`

### Phase 2: Context Monitor (merge context-window + usage-extension)
**Files changed**: `foundation/context-window/`, `session-lifecycle/usage-extension/`, `foundation/context-monitor/`

1. Create `foundation/context-monitor/` directory
2. Copy `context-window.ts` → `context-monitor/context-widget.ts`
3. Copy usage-extension core → `context-monitor/usage-dashboard.ts`
4. Create `context-monitor/context-monitor.ts` as unified entry with both widget + dashboard
5. Wire automation: when context >85%, auto-fire context-pressure trigger
6. Update `foundation/index.ts` to load `context-monitor` instead of `context-window`
7. Update `session-lifecycle/index.ts` to remove `usage-extension` import
8. Delete `foundation/context-window/`, `session-lifecycle/usage-extension/`

**Tests**: 10 new. Run: `npm test`

**Commit**: `feat(monitor): create unified context-monitor from context-window + usage-extension`

### Phase 3: Context Intel (merge pruning + read-guard)
**Files changed**: `session-lifecycle/context-pruning/`, `core-tools/read-guard/`, `session-lifecycle/context-intel/`

1. Create `session-lifecycle/context-intel/plugins/` directory
2. Create plugin interface: `context-intel/plugins/plugin.ts`
3. Move `context-pruning/` logic → `context-intel/plugins/context-pruning.ts`
   - Each rule becomes a plugin: `DeduplicationPlugin`, `SupersededWritesPlugin`, etc.
4. Move `read-guard/` logic → `context-intel/plugins/read-awareness.ts`
   - Refactor into plugin that tracks reads and checks edits
5. Update `ContextIntelExtension` to load plugins automatically
6. Wire automation: auto-compact at 85% context pressure
7. Delete `session-lifecycle/context-pruning/`, `core-tools/read-guard/`
8. Update `session-lifecycle/index.ts` to only import context-intel (already does)
9. Update `core-tools/index.ts` to remove read-guard import

**Tests**: 20 new. Run: `npm test`

**Commit**: `feat(intel): merge context-pruning and read-guard as plugins into context-intel`

### Phase 4: Welcome + Session Name
**Files changed**: `session-lifecycle/welcome-overlay/`, `session-lifecycle/session-name.ts`, `session-lifecycle/welcome/`

1. Create `session-lifecycle/welcome/` directory
2. Create `session-lifecycle/welcome/welcome.ts` that combines:
   - Welcome header rendering (from `welcome-overlay/index.ts`)
   - Session name auto-detection (from `session-name.ts`)
   - `/welcome-toggle`, `/welcome-builtin` commands
3. Update `session-lifecycle/index.ts` to import `welcome/` instead of separate modules
4. Delete `session-lifecycle/welcome-overlay/`, `session-lifecycle/session-name.ts`

**Tests**: 8 new. Run: `npm test`

**Commit**: `refactor(ui): merge welcome-overlay and session-name into unified welcome module`

### Phase 5: Code Quality + Formatter merge
**Files changed**: `core-tools/formatter/`, `core-tools/code-quality/`

1. Copy `formatter/extensions/formatter/runners/` → `core-tools/code-quality/runners/`
2. Update `core-tools/code-quality/registry.ts` to include formatter runners
3. Update `CodeQualityPipeline.processFile()` to run format as first stage
4. Create `core-tools/code-quality/commands/` with `/cq-config` (replacing `/formatter`)
5. Delete `core-tools/formatter/` directory
6. Update `core-tools/index.ts` to only import code-quality

**Tests**: 15 new. Run: `npm test`

**Commit**: `feat(quality): merge formatter runners into code-quality pipeline`

### Phase 6: Memory + Skill Bootstrap
**Files changed**: `core-tools/memory/`, `authoring/skill-bootstrap/`, `authoring/index.ts`

1. Create `core-tools/memory/src/project-context.ts` — wraps skill-bootstrap logic as a memory plugin
2. Add `autoBootstrap` config option to memory (enabled by default)
3. On `session_start`, auto-scan project and generate memory context
4. Store generated skill as `memory_remember type=fact key=project.skill.<name>`
5. Update `authoring/index.ts` to remove skill-bootstrap import
6. Delete `authoring/skill-bootstrap/`

**Tests**: 8 new. Run: `npm test`

**Commit**: `feat(memory): merge skill-bootstrap as auto-project-context into memory`

### Phase 7: Remove dead extensions
**Files changed**: `core-tools/code-actions/`, `content-tools/file-picker/`

1. Delete `core-tools/code-actions/` directory entirely
2. Delete `content-tools/file-picker/` directory entirely
3. Update `core-tools/index.ts` to remove code-actions import
4. Update `content-tools/index.ts` to remove file-picker import

**Tests**: 0 new — just ensure nothing breaks. Run: `npm test`

**Commit**: `chore: remove code-actions and file-picker extensions`

### Phase 8: Automation wiring (the "agent is automatic" part)
**Files changed**: All merged modules + `shared/telemetry-automation.ts`

1. Create `shared/automation-manager.ts` — generic AutomationManager class
2. Wire into each merged extension:
   - `ContextIntelExtension` → auto-compact, session-stale hints
   - `PermissionExtension` → auto-escalation suggestions
   - `MemoryExtension` → auto-consolidation (online, not just shutdown)
   - `ContextMonitorExtension` → context-pressure auto-suggest
3. All automation is configurable via `settings.json`:
   ```json
   {
     "automation": {
       "autoCompact": true,
       "autoConsolidateMemory": true,
       "autoSuggestEscalation": true,
       "maxCostAlert": 5.00
     }
   }
   ```

**Tests**: +15. Run: `npm test`

**Commit**: `feat(automation): add telemetry-driven automation manager to all merged extensions`

### Phase 9: Document & Publish
**Files changed**: README.md, package.json

1. Update README.md with new architecture description
2. List all extensions in `package.json` `pi.extensions` (already done — verify)
3. Update version to `0.5.0` (major refactor)
4. Create CHANGELOG entry
5. Run final `npm test`, ensure 639+ tests pass
6. Commit and push to GitHub

---

## Part F: Rollback Safety

Each phase is designed to be **independently testable and reversible**:

- **Before each phase**: verify `npm test` passes (baseline: 545)
- **During each phase**: work in a git branch, commit after each phase
- **After each phase**: `npm test` must pass
- **Rollback**: `git revert <phase-commit>` restores the pre-phase state

The `git checkout -b refactor/extension-consolidation` branch workflow will be used throughout.

---

## Part G: File Inventory — Complete List of Changes

### Files to CREATE
| File | Phase |
|---|---|
| `foundation/permission/safe-ops-layer.ts` | 1 |
| `foundation/context-monitor/context-monitor.ts` | 2 |
| `foundation/context-monitor/context-widget.ts` | 2 |
| `foundation/context-monitor/usage-dashboard.ts` | 2 |
| `foundation/context-monitor/tests/` | 2 |
| `session-lifecycle/context-intel/plugins/plugin.ts` | 3 |
| `session-lifecycle/context-intel/plugins/context-pruning.ts` | 3 |
| `session-lifecycle/context-intel/plugins/read-awareness.ts` | 3 |
| `session-lifecycle/context-intel/automation.ts` | 3, 8 |
| `session-lifecycle/welcome/welcome.ts` | 4 |
| `session-lifecycle/welcome/tests/` | 4 |
| `core-tools/code-quality/runners/` (copied from formatter) | 5 |
| `core-tools/code-quality/commands/` | 5 |
| `core-tools/memory/src/project-context.ts` | 6 |
| `shared/command-builder.ts` | 1 |
| `shared/automation-manager.ts` | 8 |

### Files to DELETE
| File | Phase |
|---|---|
| `foundation/safe-ops.ts` | 1 |
| `foundation/context-window/context-window.ts` | 2 |
| `session-lifecycle/usage-extension/index.ts` | 2 |
| `session-lifecycle/usage-extension/usage-extension-core.ts` | 2 |
| `session-lifecycle/usage-extension/cost-tracker.ts` | 2 |
| `session-lifecycle/context-pruning/` (entire directory) | 3 |
| `core-tools/read-guard/` (entire directory) | 3 |
| `session-lifecycle/welcome-overlay/` (entire directory) | 4 |
| `session-lifecycle/session-name.ts` | 4 |
| `core-tools/formatter/` (entire directory) | 5 |
| `authoring/skill-bootstrap/` (entire directory) | 6 |
| `core-tools/code-actions/` (entire directory) | 7 |
| `content-tools/file-picker/` (entire directory) | 7 |

### Files to MODIFY
| File | Changes | Phase |
|---|---|---|
| `foundation/index.ts` | Load `context-monitor` instead of `context-window`; remove `safe-ops` import | 1, 2 |
| `foundation/permission/permission.ts` | Compose SafeOpsLayer, update entry point | 1 |
| `session-lifecycle/index.ts` | Remove usage-extension, context-pruning, welcome-overlay, session-name imports | 2, 3, 4 |
| `session-lifecycle/context-intel/index.ts` | Plugin system, automation wiring | 3, 8 |
| `core-tools/index.ts` | Remove read-guard, code-actions, formatter imports | 3, 5, 7 |
| `core-tools/code-quality/index.ts` | Add formatter runners, unified config | 5 |
| `core-tools/memory/index.ts` | Add project-context plugin | 6 |
| `content-tools/index.ts` | Remove file-picker import | 7 |
| `authoring/index.ts` | Remove skill-bootstrap import | 6 |
| `shared/telemetry-automation.ts` | Add triggers 10, 11, 12 | 1 |
| `README.md` | New architecture | 9 |
| `package.json` | Version bump | 9 |

---

## Total Effort Estimate

| Phase | Est. Time | Files Changed | New Tests |
|---|---|---|---|
| 1. Infrastructure | ⏱ 45 min | 9 | 20 |
| 2. Context Monitor | ⏱ 30 min | 12 | 10 |
| 3. Context Intel plugins | ⏱ 60 min | 25 | 20 |
| 4. Welcome + Session | ⏱ 20 min | 6 | 8 |
| 5. Code Quality merge | ⏱ 40 min | 18 | 15 |
| 6. Memory merge | ⏱ 20 min | 5 | 8 |
| 7. Remove dead | ⏱ 10 min | 4 | 0 |
| 8. Automation wiring | ⏱ 45 min | 10 | 15 |
| 9. Document & publish | ⏱ 15 min | 3 | 0 |
| **Total** | **~4.5 hours** | **92 files** | **96 new tests** |

---

*End of plan. Ready to begin Phase 1 when directed.*

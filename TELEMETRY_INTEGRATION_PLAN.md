# pi-telemetry: Integratable Extension Plan

## Core Philosophy

**Zero-config telemetry for every extension.** The framework automatically detects and tracks all plugins without requiring manual `register()` calls. Explicit registration is optional — for extensions that want badge notifications, heartbeat, and named attribution.

## Architecture: How Integration Works

```
pi startup
  │
  ├─► pi-telemetry loads first
  │     ├─► Hooks into tool_call (catch-all)
  │     ├─► Hooks into tool_result (catch-all)
  │     ├─► Hooks into turn_start / turn_end
  │     └─► Hooks into agent_start / agent_end
  │
  ├─► Other extensions load
  │     └─► pi-telemetry automatically sees every tool_call
  │          and tool_result via its event hooks
  │
  └─► At runtime:
        ├─► Every tool call is tracked (name, args)
        ├─► Every tool result is tracked (timing, errors)
        ├─► Every turn's token/cost is attributed (proportional)
        └─► Session-level aggregation persists
```

## What Works Automatically (Zero Config)

| Feature | How | What's needed |
|---------|-----|---------------|
| Tool invocation counting | `tool_call` event hook | **Nothing** — works for all tools automatically |
| Tool timing (avg, p95, max) | `tool_result` event hook | **Nothing** — works for all tools automatically |
| Error tracking | `tool_result.isError` | **Nothing** — works for all tools automatically |
| Token/cost attribution | `message_end` usage data | **Nothing** — works for all registered packages |
| Health widget | Live status bar | Works once at least one package registers |
| `/health` command | Shows all activity | Shows "unregistered" tool activity |

## What Needs Explicit `register()` (Opt-In)

| Feature | Why | What You Get |
|---------|-----|--------------|
| Named attribution | Telemetry shows "read-guard" instead of "unregistered-1" | Clean dashboard labels |
| Heartbeat health | Package shows healthy/degraded/stale | Live health monitoring |
| Badge notifications | `[read-guard] ✓ Package loaded` | Styled session messages |
| Custom tool names | Telemetry knows which tools a package owns | Per-tool breakdown dashboard |

## Integration: The Two-Line Pattern

For any extension that wants clean attribution + heartbeat + badges, add **2 lines** at the top of its entry point:

```typescript
// Before (any extension):
export default function (pi: ExtensionAPI) {
  // ... existing code
}

// After:
import { getTelemetry } from "pi-telemetry";

export default function (pi: ExtensionAPI) {
  const t = getTelemetry();
  t?.register({ name: "my-ext", version: "1.0.0", description: "..." });
  t?.heartbeat("my-ext");
  t?.notify("My-ext loaded", { package: "my-ext", severity: "info", badge: { text: "v1.0.0", variant: "info" } });
  
  // ... existing code (no other changes needed)
}
```

That's it. `recordToolInvocation`, `recordToolResult`, `recordTokens`, `recordCost`, `recordError` are all handled automatically by the framework's event hooks.

## What We Need to Add to pi-telemetry

### 1. Auto-track unregistered tool activity

Instead of requiring every tool to be registered before tracking, the framework should attribute tool calls to a default "activity" category when no package claims them.

**Implementation**: In the `tool_call` handler, check if a registered package claims the tool. If not, track under a generic "system" category. This means even npm packages (pi-web-providers, pi-dialog) that we can't modify get automatic tracking.

### 2. Map tool names to packages automatically

When an extension calls `register({ tools: ["read", "edit"] })`, the framework learns the mapping. On subsequent tool_call events, it matches `toolName` against known package → tool mappings for attribution.

### 3. `/telemetry` dashboard shows tool-level details

Already implemented in `commands.ts` via `getSnapshot()`. The dashboard already shows per-package and per-tool breakdowns.

## Integration Plan: All pi-me Extensions

### Phase 0: Framework Self-Improvement (1 PR — pi-telemetry repo)

Add automatic unregistered-tool tracking so the framework works without any `register()` calls:

**Files to update** in `pi-telemetry/src/index.ts`:
- `handleMessageEnd`: already done — attributes to all registered packages
- Add `handleToolCall`: auto-track every tool call, mapping to registered package or "system" fallback
- Add `handleToolResult`: auto-track timing and errors

This makes telemetry instantly useful even before any plugin adopts it.

**Effort**: ~30 min

### Phase 1: Core Framework + High-Impact Extensions (1 PR — pi-me repo)

| Extension | Change |
|-----------|--------|
| `foundation/index.ts` | Add import + register("foundation") |
| `session-lifecycle/index.ts` | Add import + register("session-lifecycle") |
| `core-tools/index.ts` | **Already done** ✓ |
| `content-tools/index.ts` | Add import + register("content-tools") |
| `authoring/index.ts` | Add import + register("authoring") |

These are the **umbrella entry points**. By registering each umbrella, all tools beneath them get clean attribution. No need to instrument individual sub-extensions — the framework auto-tracks their tool calls.

**Effort**: ~15 min

### Phase 2: Individual Extensions with Badge Notifications (1 PR)

For extensions that already call `ctx.ui.notify()` — swap to `t?.notify()` for styled output:

| Extension | Notify Calls | Effort |
|-----------|-------------|--------|
| `foundation/permission` | 15+ | ~20 min |
| `foundation/safe-ops` | 20+ | ~20 min |
| `session-lifecycle/context-pruning` | 10+ | ~15 min |
| `session-lifecycle/usage-extension` | 5+ | ~10 min |
| `core-tools/read-guard` | **Already done** ✓ | — |
| `core-tools/plan-mode` | 10+ | ~15 min |
| `core-tools/thinking-steps` | 10+ | ~10 min |
| `core-tools/ralph-loop` | 15+ | ~15 min |
| `core-tools/memory` | 5+ | ~10 min |
| `content-tools/repeat` | 15+ | ~15 min |
| `content-tools/files-widget` | 3+ | ~5 min |
| `authoring/commit-helper` | 2+ | ~5 min |
| `authoring/skill-bootstrap` | 2+ | ~5 min |

**Effort**: ~2h total

### Phase 3: Heartbeat + Tool Recording in Complex Extensions (1 PR)

For extensions where we want heartbeat monitoring and per-tool tracking:

| Extension | What to Track | Effort |
|-----------|--------------|--------|
| `subagent` | Agent runs, async sessions, errors | ~30 min |
| `plan-mode` | Plan CRUD operations, mode toggles | ~15 min |
| `ralph-loop` | Loop iterations, start/stop events | ~15 min |
| `memory` | Consolidation runs, search calls | ~10 min |

**Effort**: ~1h

### Phase 4: Custom Event Emitters (Optional)

Extensions can use `t.bus.publish("pi-telemetry:custom:", payload, "my-ext")` for domain-specific telemetry. For example:
- `memory` could publish `"pi-telemetry:custom:consolidation"` with key count
- `subagent` could publish `"pi-telemetry:custom:agent-run"` with result summary
- `ralph-loop` could publish `"pi-telemetry:custom:loop-iteration"` with iteration count

These would be visible in the expanded dashboard view.

## Summary: The Minimal Lift

| What | Who Does It | Lines Added |
|------|------------|-------------|
| Auto-track all tool calls | Framework (Phase 0) | ~20 lines in index.ts |
| Register 5 umbrella entry points | Each umbrella index.ts | ~5 lines each |
| Replace notify calls (13 extensions) | Per extension | ~2 lines each |
| Add heartbeats (4 complex extensions) | Per extension | ~5 lines each |
| **Total** | | **~100 lines across 22 files** |

The result: every extension in pi-me gets automatic usage tracking, timing, error monitoring, cost attribution, and health status — regardless of whether it explicitly adopts telemetry. The explicit `register()` call and badge notifications are the cherry on top for extensions that want clean dashboard labels.

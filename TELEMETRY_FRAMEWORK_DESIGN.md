# pi-telemetry: Monitoring & Telemetry Framework

## Problem Statement

pi-me has 18+ extensions developed independently with:
- **Zero shared monitoring** — cannot tell if extensions work, are stuck, or crashed
- **No usage tracking** — no idea how often each extension is used
- **No cost attribution** — token/cost data from LLM calls is not attributed to packages
- **No error tracking** — errors are silent or displayed as raw red text
- **Inconsistent UI** — `ctx.ui.notify()` with raw strings, emoji prefixes, no badges/formatting

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       pi-telemetry                           │
│                                                              │
│  ┌──────────────────┐   ┌───────────────────────────────┐   │
│  │  PackageRegistry  │   │       MessageBus (pi.events)   │   │
│  │  - register()    │──▶│  - pi-telemetry:package:*      │   │
│  │  - deregister()  │   │  - pi-telemetry:tool:*         │   │
│  │  - list()        │   │  - pi-telemetry:cost:*         │   │
│  │  - healthCheck() │   │  - pi-telemetry:error:*        │   │
│  └────────┬─────────┘   └──────────────┬────────────────┘   │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 TelemetryCollector                    │   │
│  │  - usage counters (per-package, per-tool)             │   │
│  │  - token accounting (input, output, cache)            │   │
│  │  - cost estimation (model × token rates)              │   │
│  │  - error tracking (type, count, last occurred)        │   │
│  │  - latency tracking (avg, p95, max)                   │   │
│  │  - session persistence (custom entry)                 │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Session UI/UX Layer                     │   │
│  │  - MessageRenderer (badge-light styled)               │   │
│  │  - StatusWidget (health dots per package)             │   │
│  │  - /telemetry command (dashboard)                     │   │
│  │  - /health command (per-package status)               │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Package Registry (`registry.ts`)

Every extension registers itself. The registry provides discovery, health checks, and dependency tracking.

### Registration Contract

```typescript
interface PackageRegistration {
  name: string;                    // unique package name, e.g. "read-guard"
  version: string;                 // semver, e.g. "1.0.0"
  description: string;             // short description
  tools?: string[];                // tools this package registers/intercepts
  events?: string[];               // events this package subscribes to
  hooks?: string[];                // lifecycle hooks used
  valueMetrics?: ValueMetric[];    // value propositions (see below)
}

interface RegisteredPackage extends PackageRegistration {
  registeredAt: number;            // timestamp
  lastHeartbeat: number;           // timestamp
  status: PackageStatus;           // healthy | degraded | error | stale
  lastError?: PackageError;
  invocations: number;             // total tool invocations attributed
  totalCost: number;               // estimated USD cost attributed
}

type PackageStatus = "healthy" | "degraded" | "error" | "stale";
```

### Heartbeat & Health

Each package sends a heartbeat periodically (or on key events). The framework classifies:
- **healthy**: heartbeat within last 60s
- **degraded**: heartbeat within last 300s, or has non-fatal errors
- **error**: heartbeat with error flag
- **stale**: no heartbeat for >300s

```typescript
// In each extension's critical code paths:
telemetry.heartbeat("read-guard", { status: "healthy" });

// On error:
telemetry.heartbeat("read-guard", { status: "error", error: "..." });
```

### API

```typescript
// Register a package
telemetry.register(pkg: PackageRegistration): void;

// Deregister (on session_shutdown)
telemetry.deregister(name: string): void;

// Send heartbeat
telemetry.heartbeat(name: string, opts?: { status?: PackageStatus; error?: string }): void;

// List all registered packages with health
telemetry.list(): RegisteredPackage[];

// Get health summary
telemetry.health(): { healthy: number; degraded: number; error: number; stale: number; total: number };
```

---

## 2. Message Bus (`bus.ts`)

Built on `pi.events` with standardized namespace for inter-package communication.

### Channel Namespace Convention

| Channel | Direction | Payload |
|---------|-----------|---------|
| `pi-telemetry:package:register` | pkg → framework | `{ name, version, ... }` |
| `pi-telemetry:package:deregister` | pkg → framework | `{ name }` |
| `pi-telemetry:package:heartbeat` | pkg → framework | `{ name, status, timestamp }` |
| `pi-telemetry:tool:invoke` | pkg → framework | `{ package, tool, args, timestamp }` |
| `pi-telemetry:tool:result` | pkg → framework | `{ package, tool, duration, isError, error? }` |
| `pi-telemetry:cost:attribution` | framework → all | `{ package, inputTokens, outputTokens, cost }` |
| `pi-telemetry:error:report` | pkg → framework | `{ package, type, message, stack? }` |
| `pi-telemetry:ui:notify` | pkg → framework | `{ package, severity, message, badge? }` |

### API

```typescript
// Publish a message
telemetry.publish(channel: string, payload: unknown): void;

// Subscribe to a channel (thin wrapper around pi.events)
telemetry.subscribe(channel: string, handler: (payload: any) => void): void;
```

---

## 3. Telemetry Collector (`collector.ts`)

Central data store for all telemetry. Persisted as a custom session entry for restarts.

### Data Models

```typescript
interface PackageTelemetry {
  name: string;
  version: string;
  
  // Usage
  totalInvocations: number;
  totalErrors: number;
  errorRate: number;              // errors / invocations
  
  // Tokens
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  
  // Cost (in USD)
  estimatedCost: number;
  
  // Timing (ms)
  totalExecutionMs: number;
  avgExecutionMs: number;
  maxExecutionMs: number;
  executionTimes: number[];       // rolling window (last 100)
  
  // Per-tool breakdown
  tools: Record<string, ToolTelemetry>;
  
  // Health
  lastHeartbeat: number;
  status: PackageStatus;
  lastError?: { type: string; message: string; timestamp: number; count: number };
}

interface ToolTelemetry {
  invocations: number;
  errors: number;
  avgDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
}

interface SessionTelemetry {
  sessionStart: number;
  sessionEnd?: number;
  packages: Record<string, PackageTelemetry>;
  totalTokens: number;
  totalCost: number;
  totalInvocations: number;
  totalErrors: number;
  modelUsed?: string;
}
```

### Token & Cost Attribution Strategy

Tokens are attributed at `message_end` by examining the turn's tool calls and usage data:

```
For each assistant turn:
  1. Collect all tool calls made in that turn
  2. Map each tool call to its registering package
  3. Get token usage from event.message.usage (if available)
  4. Proportionally attribute: package_share = package_tools / total_tools
  5. Record: package.tokens += usage.tokens * package_share
```

Cost is read directly from `usage.cost` when available, or estimated from model × tokens using known pricing tables.

### API

```typescript
// Record a tool invocation
telemetry.recordToolInvocation(pkg: string, tool: string): void;

// Record a tool result (duration, error)
telemetry.recordToolResult(pkg: string, tool: string, duration: number, isError: boolean): void;

// Record token attribution
telemetry.recordTokens(pkg: string, tokens: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): void;

// Record cost
telemetry.recordCost(pkg: string, cost: number): void;

// Record error
telemetry.recordError(pkg: string, type: string, message: string, stack?: string): void;

// Get snapshot for current session
telemetry.getSnapshot(): SessionTelemetry;

// Export to JSON
telemetry.exportJSON(): string;

// Reset for new session
telemetry.reset(): void;
```

### Session Persistence

On `message_end` (periodically, every N turns), the collector saves a snapshot:

```typescript
pi.appendEntry("pi-telemetry.snapshot", telemetry.getSnapshot());
```

On `session_start`, snapshots are loaded and merged for the session lifetime report.

---

## 4. Session UI/UX Layer

### 4a. Badge-Style Message Renderer (`renderer.ts`)

Replaces raw `ctx.ui.notify("text", "error")` with styled messages using Bootstrap 5-inspired badge variants.

**Badge Variants** (mapped to theme colors):

| Variant | Bootstrap Equivalent | Theme Color | Use Case |
|---------|---------------------|-------------|----------|
| `info` | `badge bg-info text-dark` | `accent` | General info, loading |
| `success` | `badge bg-success` | `success` | Success, completion |
| `warning` | `badge bg-warning text-dark` | `warning` | Warnings, blocks |
| `danger` | `badge bg-danger` | `error` | Errors, failures |
| `primary` | `badge bg-primary` | tool call color | Actions, highlights |
| `secondary` | `badge bg-secondary` | `muted` | Secondary info |
| `light` | `badge bg-light text-dark` | default | Subtle context |

**Display format** (via `registerMessageRenderer`):

```
[read-guard]     ✓ Package loaded                           (info badge, green)
[read-guard]     ⚠ No prior read — edit blocked            (warning badge, yellow)
[pi-memory]      ✗ Consolidation failed: timeout            (danger badge, red)
[plan-mode]      ▶ Planning mode enabled, read-only tools   (primary badge)
```

**API:**

```typescript
// Notify with badge styling
telemetry.notify(message: string, opts?: {
  package?: string;       // package name for the badge label
  severity?: "info" | "success" | "warning" | "error";  // maps to variant
  badge?: {
    text: string;         // badge label text
    variant: BadgeVariant; // info | success | warning | danger | primary | secondary | light
  };
  details?: Record<string, unknown>;  // for expanded view
});
```

### 4b. Status Widget (`widget.ts`)

A persistent TUI widget showing package health at a glance:

```
📊 Telemetry: ◉ read-guard  ◉ plan-mode  ○ ralph-loop  ◉ memory  ...
```

Color mapping:
- `◉` (green/U+25C9) = healthy
- `◉` (yellow) = degraded
- `○` (gray/U+25CB) = stale
- `✗` (red) = error

### 4c. Commands (`commands.ts`)

**`/telemetry`** — Interactive dashboard
```
╔══════════════════════════════════════════════════════════════╗
║  📊 Telemetry Dashboard                                     ║
║                                                              ║
║  Package           Invs    Errors   Cost     Health          ║
║  ─────────────────────────────────────────────────────       ║
║  read-guard         28       3      $0.02    ◉ healthy       ║
║  plan-mode          12       0      $0.01    ◉ healthy       ║
║  memory             45       1      $0.04    ◉ healthy       ║
║  ralph-loop          8       2      $0.03    ○ stale         ║
║                                                              ║
║  Total: $0.10 | 93 invocations | 6 errors                    ║
╚══════════════════════════════════════════════════════════════╝
```

**`/telemetry export`** — Write JSON report to `.pi/telemetry/export-<timestamp>.json`

**`/telemetry report`** — Generate a natural-language summary:
> "read-guard was used 28 times, blocked 3 edits (saving ~2,000 tokens), cost $0.02"

**`/health`** — Quick health check
```
╔════════════════════════════╗
║  Health Check              ║
║                            ║
║  ◉ read-guard  — 12s ago  ║
║  ◉ plan-mode   — 8s ago   ║
║  ○ ralph-loop  — stale    ║
║  ◉ memory      — 3s ago   ║
╚════════════════════════════╝
```

---

## 5. Value Metrics

Extensions can declare what value they provide:

```typescript
interface ValueMetric {
  name: string;              // "tokens-saved" | "errors-prevented" | "time-saved"
  label: string;             // "Tokens Saved"
  unit: string;              // "tokens" | "errors" | "ms" | "USD"
  compute: (stats: PackageTelemetry) => number | string;
}
```

Examples:
- **read-guard**: "Blocked 3 erroneous edits, saving ~2,400 tokens and $0.005"
- **autofix**: "Auto-fixed 12 lint errors, saving ~3 LLM turns"
- **thinking-steps**: "Rendered 45 thinking steps across 12 turns"

The `report` command uses these to explain each package's contribution in plain language.

---

## 6. Directory Structure

```
core-tools/telemetry/
├── index.ts              # Extension entry point, exports plugin() and plugin API
├── registry.ts           # PackageRegistry
├── collector.ts          # TelemetryCollector
├── renderer.ts           # MessageRenderer (badge-style notifications)
├── widget.ts             # StatusWidget (health dots)
├── commands.ts           # /telemetry, /health commands
├── bus.ts                # MessageBus (pi.events wrapper)
├── types.ts              # All TypeScript interfaces
├── collector.test.ts     # Tests
├── registry.test.ts      # Tests
└── renderer.test.ts      # Tests
```

---

## 7. Integration Pattern

### In any extension:

```typescript
// Before (current pattern):
ctx.ui.notify("Edit blocked — haven't read file yet", "error");

// After (using telemetry):
import { telemetry } from "../telemetry/index.ts";

// 1. Register on startup
telemetry.register({
  name: "read-guard",
  version: "1.0.0",
  description: "Read-before-edit guard",
  tools: ["read", "edit"],
  events: ["tool_call"],
});

// 2. Send heartbeats on key operations
telemetry.heartbeat("read-guard");

// 3. Use styled notifications
telemetry.notify("Edit blocked — haven't read file yet", {
  package: "read-guard",
  severity: "warning",
  badge: { text: "BLOCKED", variant: "warning" },
});

// 4. Record tool results
telemetry.recordToolResult("read-guard", "edit", /* duration */ 5, /* isError */ false);
telemetry.recordToolInvocation("read-guard", "edit");
```

### In core-tools/index.ts:

```typescript
import telemetry from "./telemetry/index.ts";

export default function (pi: ExtensionAPI) {
  const profile = readProfile();
  if (profile === "minimal") return;

  // Telemetry must be loaded FIRST so other extensions can use it
  telemetry(pi);

  // All other extensions (unchanged)...
  readGuard(pi);
  planMode(pi);
  memory(pi);
  // ...
}
```

### Cross-Extension Communication

```typescript
// Extension A sends a request
telemetry.publish("pi-telemetry:custom:action-requested", {
  source: "read-guard",
  action: "flush-cache",
});

// Extension B listens
telemetry.subscribe("pi-telemetry:custom:action-requested", (payload) => {
  if (payload.action === "flush-cache") {
    myExtension.flushCache();
  }
});
```

---

## 8. Implementation Phases

### Phase 1: Framework Core
- [ ] `types.ts` — all interfaces
- [ ] `registry.ts` — PackageRegistry (register, heartbeat, health, list)
- [ ] `collector.ts` — TelemetryCollector (usage, tokens, cost, errors, timing)
- [ ] `bus.ts` — pi.events wrapper with typed channels
- [ ] `index.ts` — extension entry point

### Phase 2: Session UI/UX
- [ ] `renderer.ts` — MessageRenderer with badge-style `registerMessageRenderer`
- [ ] `widget.ts` — StatusWidget (health dots in status bar)
- [ ] `commands.ts` — /telemetry dashboard, /telemetry export, /health

### Phase 3: Adoption in Existing Extensions
- [ ] read-guard: register, heartbeat, notify with badges
- [ ] plan-mode: register, heartbeat, notify, tool recording
- [ ] memory: register, heartbeat
- [ ] ralph-loop: register, error tracking
- [ ] thinking-steps: register
- [ ] clipboard, subagent, preset, etc.

### Phase 4: Token & Cost Attribution
- [ ] Hook into `message_end` for usage data
- [ ] Per-turn tool attribution
- [ ] Cost estimation with known pricing tables
- [ ] Session persistence via `pi.appendEntry`

### Phase 5: Reports & Value Metrics
- [ ] `/telemetry report` natural-language summary
- [ ] Value metric computation per package
- [ ] Export `.pi/telemetry/` directory with historical data

---

## 9. Design Principles

1. **Opt-in, not mandatory** — Extensions can ignore the framework entirely. No breaking changes.
2. **Zero overhead when unused** — If only 2 extensions register, only 2 packages appear. No performance cost.
3. **Session-first** — All data is per-session. Survives restarts via `pi.appendEntry`. Does NOT persist across sessions (no DB, no filesystem pollution).
4. **Approximate is fine** — Token attribution is proportional, not precise. Cost is estimated, not billed. The goal is directional insight, not audit-grade accuracy.
5. **Hygienic UI** — Badge-style messages are compact, colored, and scannable. The widget is a single line. The dashboard is on-demand. No UI spam.
6. **Cross-extension compatible** — Framework exposes its API as a module other extensions can import. `pi.events` (the bus) is available to any extension.

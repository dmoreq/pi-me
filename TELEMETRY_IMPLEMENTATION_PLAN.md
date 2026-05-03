# pi-telemetry: Implementation Plan

## Overview

Build `pi-telemetry` as an independent pi package at `git:github.com/dmoreq/pi-telemetry`, then integrate it into `pi-me` as a dependency. The entire life-cycle: scaffold → implement → tests → document → publish → integrate → verify.

---

## Step 1: Scaffold pi-telemetry Repository

**Goal**: Create the repo skeleton at `../pi-telemetry` matching the pi package conventions.

**Location**: `/Users/quy.doan/Workspace/personal/pi-telemetry/`

**Files to create**:

```
pi-telemetry/
├── package.json          # name: pi-telemetry, pi.extensions: ["./src/index.ts"]
├── tsconfig.json         # standard Node ESNext config
├── README.md             # brief description
├── LICENSE               # MIT
└── src/
    ├── index.ts          # extension entry point — exports default function(pi)
    ├── registry.ts       # PackageRegistry — register/deregister/heartbeat/list/health
    ├── collector.ts      # TelemetryCollector — usage/tokens/cost/errors/timing
    ├── bus.ts            # MessageBus — pi.events wrapper with typed channels
    ├── renderer.ts       # Badge-style message renderer via registerMessageRenderer
    ├── widget.ts         # StatusWidget — health dots in status bar
    ├── commands.ts       # /telemetry and /health commands
    ├── types.ts          # All TS interfaces
    ├── registry.test.ts  # Unit tests for registry
    ├── collector.test.ts # Unit tests for collector
    └── renderer.test.ts  # Unit tests for renderer
```

**Key decisions**:
- `package.json` `type: "module"` — matches pi-me convention
- No build step — pi loads `.ts` directly via jiti
- Peer dependencies: `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@sinclair/typebox`
- Runtime dependencies: `none` (zero runtime deps)

---

## Step 2: Implement types.ts

**Interfaces**:

```typescript
// === Package Registry Types ===

export type PackageStatus = "healthy" | "degraded" | "error" | "stale";

export interface PackageRegistration {
  name: string;
  version: string;
  description: string;
  tools?: string[];
  events?: string[];
  hooks?: string[];
}

export interface RegisteredPackage extends PackageRegistration {
  registeredAt: number;
  lastHeartbeat: number;
  status: PackageStatus;
  lastError?: PackageError;
  invocations: number;
  totalCost: number;
}

export interface PackageError {
  type: string;
  message: string;
  timestamp: number;
  count: number;
}

// === Telemetry Types ===

export interface ToolTelemetry {
  invocations: number;
  errors: number;
  avgDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  executionTimes: number[]; // rolling window last 100
}

export interface PackageTelemetry {
  name: string;
  version: string;
  totalInvocations: number;
  totalErrors: number;
  errorRate: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  estimatedCost: number;
  totalExecutionMs: number;
  avgExecutionMs: number;
  maxExecutionMs: number;
  tools: Record<string, ToolTelemetry>;
  lastHeartbeat: number;
  status: PackageStatus;
  lastError?: PackageError;
}

export interface SessionTelemetry {
  sessionStart: number;
  sessionEnd?: number;
  packages: Record<string, PackageTelemetry>;
  totalTokens: number;
  totalCost: number;
  totalInvocations: number;
  totalErrors: number;
}

// === Message Bus Types ===

export type TelemetryChannel =
  | "pi-telemetry:package:register"
  | "pi-telemetry:package:deregister"
  | "pi-telemetry:package:heartbeat"
  | "pi-telemetry:tool:invoke"
  | "pi-telemetry:tool:result"
  | "pi-telemetry:cost:attribution"
  | "pi-telemetry:error:report"
  | "pi-telemetry:ui:notify";

export interface TelemetryMessage<T = unknown> {
  channel: TelemetryChannel;
  payload: T;
  timestamp: number;
  source: string;
}

// === UI Types ===

export type BadgeVariant = "info" | "success" | "warning" | "danger" | "primary" | "secondary" | "light";

export interface NotifyOptions {
  package?: string;
  severity?: "info" | "success" | "warning" | "error";
  badge?: {
    text: string;
    variant: BadgeVariant;
  };
  details?: Record<string, unknown>;
}

// === Bus payloads ===

export interface PackageRegisterPayload {
  name: string;
  version: string;
  description: string;
  tools?: string[];
  events?: string[];
  hooks?: string[];
}

export interface PackageHeartbeatPayload {
  name: string;
  status: PackageStatus;
  timestamp: number;
  error?: string;
}

export interface ToolInvokePayload {
  package: string;
  tool: string;
  args?: Record<string, unknown>;
  timestamp: number;
}

export interface ToolResultPayload {
  package: string;
  tool: string;
  duration: number;
  isError: boolean;
  error?: string;
}

export interface CostAttributionPayload {
  package: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
}

export interface ErrorReportPayload {
  package: string;
  type: string;
  message: string;
  stack?: string;
}

export interface UINotifyPayload {
  package: string;
  severity: "info" | "success" | "warning" | "error";
  message: string;
  badge?: { text: string; variant: BadgeVariant };
  details?: Record<string, unknown>;
}
```

---

## Step 3: Implement registry.ts

**Class `PackageRegistry`**:

```typescript
export class PackageRegistry {
  private packages = new Map<string, RegisteredPackage>();
  private static HEARTBEAT_HEALTHY_MS = 60_000;
  private static HEARTBEAT_DEGRADED_MS = 300_000;

  register(reg: PackageRegistration): void;
  deregister(name: string): boolean;
  heartbeat(name: string, opts?: { status?: PackageStatus; error?: string }): boolean;
  get(name: string): RegisteredPackage | undefined;
  list(): RegisteredPackage[];
  health(): { healthy: number; degraded: number; error: number; stale: number; total: number };
  private computeStatus(pkg: RegisteredPackage): PackageStatus;
}
```

**Behavior**:
- `register()` creates new entry with `healthy` status
- `deregister()` removes entry, returns false if not found
- `heartbeat()` updates timestamp; optional error updates `lastError`
- `computeStatus()` checks time since last heartbeat:
  - < 60s: `healthy`
  - < 300s: `degraded`
  - ≥ 300s: `stale`
  - if `lastError` is set and recent (< 60s): `error`
- Internal LRU-like cleanup: max 50 packages, evict oldest stale on register if full

---

## Step 4: Implement collector.ts

**Class `TelemetryCollector`**:

```typescript
export class TelemetryCollector {
  private packages = new Map<string, PackageTelemetry>();

  recordToolInvocation(pkg: string, tool: string): void;
  recordToolResult(pkg: string, tool: string, duration: number, isError: boolean): void;
  recordTokens(pkg: string, tokens: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): void;
  recordCost(pkg: string, cost: number): void;
  recordError(pkg: string, type: string, message: string, stack?: string): void;
  getOrCreate(pkg: string): PackageTelemetry;
  getSnapshot(): SessionTelemetry;
  exportJSON(): string;
  fromSnapshot(snapshot: SessionTelemetry): void;
  reset(): void;
}
```

**Key behavior**:
- `recordToolInvocation` increments counters, creates entry on first access
- `recordToolResult` updates per-tool timing, maintains rolling 100-window for p95
- `recordTokens` accumulates per-package
- `recordError` sets `lastError` and increments `totalErrors`
- `exportJSON` serializes `getSnapshot()` to formatted JSON
- `fromSnapshot` merges a saved snapshot (for session persistence restore)
- p95 calculation: sort last 100 execution times, pick 95th percentile

---

## Step 5: Implement bus.ts

**Class `MessageBus`**:

```typescript
export class MessageBus {
  constructor(private piEvents: ExtensionAPI["events"]) {}

  publish<T>(channel: TelemetryChannel, payload: T, source: string): void;
  subscribe<T>(channel: TelemetryChannel, handler: (payload: T, message: TelemetryMessage<T>) => void): void;
  unsubscribe(channel: TelemetryChannel, handler: Function): void;
}
```

**Behavior**:
- Thin wrapper around `pi.events.on`/`pi.events.emit`
- Wraps payloads in `TelemetryMessage<T>` envelope with timestamp and source
- Channel strings are namespaced: `pi-telemetry:*`

---

## Step 6: Implement renderer.ts

**Badge-style message renderer**:

```typescript
export function registerTelemetryMessageRenderer(pi: ExtensionAPI): void;
```

**Behavior**:
- Uses `pi.registerMessageRenderer("pi-telemetry.notify", renderer)` 
- Renderer formats messages as: `[package-name] ✓ message text`
- Badge variants map to theme colors:
  - `info` → `theme.fg("accent", ...)`
  - `success` → `theme.fg("success", ...)` 
  - `warning` → `theme.fg("warning", ...)`
  - `danger` → `theme.fg("error", ...)`
  - `primary` → bold accent
  - `secondary` → `theme.fg("muted", ...)`
  - `light` → default (no color)
- Supports `expanded` mode to show `details` as JSON

**`notify()` public API**:

```typescript
function notify(pi: ExtensionAPI, message: string, opts?: NotifyOptions): void;
```

Sends a custom message via `pi.sendMessage()` with:
- `customType: "pi-telemetry.notify"`
- `content: message`
- `display: true`
- `details: { ...opts }`

---

## Step 7: Implement widget.ts

**Status widget for health dots**:

```typescript
export function registerTelemetryWidget(pi: ExtensionAPI): void;
```

Sets a UI widget via `ctx.ui.setWidget("pi-telemetry", ...)` showing:
```
📊 Telemetry: ◉ read-guard  ◉ plan-mode  ○ ralph-loop  ...
```

Updates on:
- `session_start` (initial render)
- Each `tool_call` that triggers a heartbeat (refresh every 30s throttle)

---

## Step 8: Implement commands.ts

### `/telemetry` — Interactive Dashboard

Uses `ctx.ui.custom()` with a SelectList:

```typescript
export function registerTelemetryCommands(pi: ExtensionAPI, registry: PackageRegistry, collector: TelemetryCollector): void;
```

**Dashboard layout**:
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
║                                                              ║
║  [Enter] expand package  [t] toggle view  [e] export  [q]   ║
╚══════════════════════════════════════════════════════════════╝
```

- Select a package → show detailed view (per-tool breakdown, error history)
- `t` — toggle between summary and detailed view
- `e` — export to file (triggers `/telemetry export`)
- `q` — close

### `/telemetry export` — JSON Export

Writes `SessionTelemetry` to `.pi/telemetry/export-<timestamp>.json`

### `/health` — Quick Health Overview

```
╔════════════════════════════╗
║  Health Check (4 packages) ║
║                            ║
║  ◉ read-guard  — 12s ago  ║
║  ◉ plan-mode   — 8s ago   ║
║  ○ ralph-loop  — stale    ║
║  ◉ memory      — 3s ago   ║
╚════════════════════════════╝
```

### `/telemetry report` — Natural language summary

Generates a plain-text report via the LLM or a template:
> "This session: read-guard used 28 times (3 blocks), plan-mode 12 times (0 errors), memory 45 times (1 consolidation error). Total estimated cost: $0.10."

---

## Step 9: Implement index.ts (Entry Point)

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { PackageRegistry } from "./registry.js";
import { TelemetryCollector } from "./collector.js";
import { MessageBus } from "./bus.js";
import { registerTelemetryMessageRenderer } from "./renderer.js";
import { registerTelemetryWidget } from "./widget.js";
import { registerTelemetryCommands } from "./commands.js";

export class Telemetry {
  readonly registry: PackageRegistry;
  readonly collector: TelemetryCollector;
  readonly bus: MessageBus;

  constructor(pi: ExtensionAPI) {
    this.registry = new PackageRegistry();
    this.collector = new TelemetryCollector();
    this.bus = new MessageBus(pi.events);

    // Setup
    registerTelemetryMessageRenderer(pi);
    registerTelemetryWidget(pi);
    registerTelemetryCommands(pi, this.registry, this.collector);

    // Hook message_end for token/cost attribution
    pi.on("message_end", (event, ctx) => {
      this.handleMessageEnd(event, ctx);
    });

    // Reset on session start
    pi.on("session_start", (_event, _ctx) => {
      this.collector.reset();
      this.registry = new PackageRegistry();
    });

    // Shutdown
    pi.on("session_shutdown", () => {
      this.collector.recordSessionEnd();
    });
  }

  // Convenience proxies
  register(pkg: PackageRegistration): void { this.registry.register(pkg); }
  deregister(name: string): boolean { return this.registry.deregister(name); }
  heartbeat(name: string, opts?: { status?: PackageStatus; error?: string }): boolean { return this.registry.heartbeat(name, opts); }
  notify(message: string, opts?: NotifyOptions): void { /* sends via pi.sendMessage */ }
  recordToolInvocation(pkg: string, tool: string): void { this.collector.recordToolInvocation(pkg, tool); }
  recordToolResult(pkg: string, tool: string, duration: number, isError: boolean): void { this.collector.recordToolResult(pkg, tool, duration, isError); }
  recordTokens(pkg: string, tokens: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): void { this.collector.recordTokens(pkg, tokens); }
  recordCost(pkg: string, cost: number): void { this.collector.recordCost(pkg, cost); }
  recordError(pkg: string, type: string, message: string, stack?: string): void { this.collector.recordError(pkg, type, message, stack); }
}
```

**`handleMessageEnd` logic**:

```typescript
private handleMessageEnd(event: any, ctx: any): void {
  if (event.message.role !== "assistant") return;
  const usage = event.message.usage;
  if (!usage) return;

  const activePackages = this.registry.list();
  if (activePackages.length === 0) return;

  // Count total tool calls from all active packages' registered tools
  // Simple attribution: divide tokens equally among all registered packages
  const packageCount = activePackages.length;
  const share = 1 / packageCount;

  for (const pkg of activePackages) {
    this.collector.recordTokens(pkg.name, {
      input: Math.round(usage.tokens.input * share),
      output: Math.round(usage.tokens.output * share),
      cacheRead: usage.tokens.cacheRead ?? 0,
      cacheWrite: usage.tokens.cacheWrite ?? 0,
    });
    if (usage.cost?.total) {
      this.collector.recordCost(pkg.name, usage.cost.total * share);
    }
  }
}
```

**Entry point**:

```typescript
let telemetryInstance: Telemetry | null = null;

export default function (pi: ExtensionAPI) {
  telemetryInstance = new Telemetry(pi);
}

export function getTelemetry(): Telemetry | null {
  return telemetryInstance;
}
```

---

## Step 10: Write Tests

### registry.test.ts (6 tests)

| # | Test | Description |
|---|------|-------------|
| 1 | `register creates entry with healthy status` | Verify `register()` creates package with correct initial state |
| 2 | `deregister removes entry` | Verify `deregister()` removes and returns `true`; unknown returns `false` |
| 3 | `heartbeat updates timestamp and status` | Verify heartbeat updates timestamp and clears error |
| 4 | `heartbeat with error sets error state` | Verify heartbeat with `status: "error"` sets lastError |
| 5 | `health returns correct counts` | Register 3 packages (healthy, stale, error) and verify counts |
| 6 | `list returns all registered` | Register 3 packages, verify list returns all 3 |

### collector.test.ts (8 tests)

| # | Test | Description |
|---|------|-------------|
| 1 | `recordToolInvocation increments counter` | 2 invocations → totalInvocations = 2 |
| 2 | `recordToolResult tracks timing` | Record durations and verify avg/max |
| 3 | `recordToolResult maintains p95` | Populate 100 entries, verify p95 ≈ expected |
| 4 | `recordTokens accumulates` | 2 calls → input/output tokens summed |
| 5 | `recordError sets lastError and increments` | Error with type/message → count=1 |
| 6 | `getSnapshot returns full state` | Populate data and verify snapshot shape |
| 7 | `fromSnapshot restores state` | Export → reset → import → same data |
| 8 | `reset clears all` | Populate → reset → empty state |

### renderer.test.ts (3 tests)

| # | Test | Description |
|---|------|-------------|
| 1 | `notify sends custom message` | Mock pi.sendMessage, verify it's called with correct format |
| 2 | `notify with badge options` | Verify badge details are included |
| 3 | `notify handles missing package` | Graceful fallback |

---

## Step 11: Documentation

### README.md sections:
- What is pi-telemetry?
- Quick start (install + import)
- Package Registration API
- Telemetry Collector API
- Message Bus API
- Commands (`/telemetry`, `/health`)
- Integration guide for extension authors
- Example: instrumenting an existing extension

---

## Step 12: Create GitHub Repository and Push

```bash
# Inside /Users/quy.doan/Workspace/personal/pi-telemetry/
git init
git add -A
git commit -m "feat: initial pi-telemetry framework scaffold

- PackageRegistry: register, deregister, heartbeat, health checks
- TelemetryCollector: usage, tokens, cost, errors, timing with p95
- MessageBus: typed pub/sub on pi.events
- Badge-style message renderer for session notifications
- /telemetry dashboard command
- /health status command
- Full test suite"
git remote add origin git@github.com:dmoreq/pi-telemetry.git
git push -u origin main
git tag v0.1.0
git push origin v0.1.0
```

---

## Step 13: Integrate into pi-me

### 13a. Add GitHub dependency in package.json

```json
{
  "dependencies": {
    "pi-telemetry": "github:dmoreq/pi-telemetry"
  }
}
```

### 13b. Create content-tools/telemetry/index.ts (adapter)

```typescript
/**
 * pi-telemetry adapter — re-exports from the external package
 * with pi-me-specific defaults.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import telemetryExtension, { getTelemetry } from "pi-telemetry";
export { getTelemetry, Telemetry } from "pi-telemetry";
export default telemetryExtension;
```

### 13c. Update core-tools/index.ts

```typescript
// Must be loaded FIRST so other extensions can use it
import telemetry from "../content-tools/telemetry/index.ts";

export default function (pi: ExtensionAPI) {
  const profile = readProfile();
  if (profile === "minimal") return;

  // 1. Load telemetry first
  telemetry(pi);

  // 2. All other extensions (unchanged)
  taskOrchestration(pi);
  planMode(pi);
  // ...
}
```

### 13d. Install and verify

```bash
cd /Users/quy.doan/Workspace/personal/pi-me
npm install  # pulls github:dmoreq/pi-telemetry into node_modules
```

Run tests to ensure nothing broke:
```bash
npm test
```

---

## Step 14: Test pi-me Integration

### 14a. Run existing test suite

```bash
npm test 2>&1 | tail -30
```

Expected: All existing 417+ tests pass, plus the new pi-telemetry tests run.

### 14b. Manual smoke test with pi

```bash
pi -e . "Show /health"
```

Expected: `/health` command works, shows empty state (no packages registered yet)

### 14c. Verify keyboard shortcuts and commands

- `/telemetry` — opens dashboard (empty initially)
- `/telemetry export` — writes JSON file
- `/health` — shows empty state
- `Ctrl+R` — reload, verify persistence works

---

## Step 15: Future Adoption — Instrument Existing Extensions

After the framework is verified, instrument individual extensions (separate PRs):

| Extension | Registration | Heartbeat | Notify | Tool Recording |
|-----------|-------------|-----------|--------|----------------|
| read-guard | `register()` on load | On each edit block | Replace raw notify | Record tool results |
| plan-mode | `register()` on load | On plan CRUD | Replace raw notify | Record plan operations |
| memory | `register()` on load | On consolidate | Replace raw notify | Record memory ops |
| ralph-loop | `register()` on load | Per iteration | Replace raw notify | Record loop stats |
| thinking-steps | `register()` on load | On mode change | - | Record render count |

---

## Summary

| Step | Description | Est. Effort |
|------|-------------|-------------|
| 1 | Scaffold repo | ~15 min |
| 2–8 | Implement types, registry, collector, bus, renderer, widget, commands | ~4h |
| 9 | Implement index.ts entry point | ~30 min |
| 10 | Write tests (17 tests) | ~1.5h |
| 11 | Documentation (README) | ~30 min |
| 12 | Create GitHub repo and push | ~15 min |
| 13 | Integrate into pi-me | ~30 min |
| 14 | Test integration | ~30 min |
| **Total** | | **~8h** |

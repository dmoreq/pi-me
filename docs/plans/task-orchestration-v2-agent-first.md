# Task Orchestration v2: Agent-Driven Design

**Status:** Specification  
**Created:** 2026-05-03  
**Version:** 2.0 (UX redesign + implementation optimization)  
**Focus:** Zero-config agent automation, DRY/SOLID principles, minimal human interaction

---

## Vision

**Current (v1):** Explicit task declaration via commands (`/todo`, `/btw`, `/plan_tracker`)
```
User: /todo "Fix login bug"
User: /todo "Update docs", blockedBy="task-123"
User: /btw "Fix auth", "Refactor db", "Deploy"
```

**New (v2):** Implicit, agent-driven task orchestration
```
User: "Fix the login flow and update the auth docs"
       ↓ Agent autonomously:
         1. Breaks into subtasks (fix → test → docs)
         2. Infers dependencies (docs depends on fix)
         3. Executes in parallel where possible
         4. Notifies on errors/blockers only
       (User sees progress in sidebar, no explicit actions needed)
```

---

## Architecture: Agent-First Task Orchestration

### Core Principle: Implicit > Explicit

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Session                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User message: "Refactor auth module, add tests"       │
│       ↓                                                 │
│  [TaskCaptureMiddleware]                               │
│  ├─ Parse user intent via NLP                          │
│  ├─ Infer subtasks from conversation context           │
│  └─ Detect dependencies from code analysis             │
│       ↓                                                 │
│  [TaskExecutor]                                        │
│  ├─ Resolve DAG (parallel safe operations)             │
│  ├─ Dispatch as background jobs (async-first)          │
│  └─ Stream results to notifications                    │
│       ↓                                                 │
│  [NotificationInbox]                                   │
│  ├─ Aggregated task progress                           │
│  ├─ Errors/blockers only (not noise)                   │
│  └─ One-click actions (retry, skip, reorder)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
core-tools/task-orchestration/
├── src/
│   ├── core/
│   │   ├── task.ts              ← Task model + DAG
│   │   ├── capture.ts           ← Extract tasks from conversation
│   │   ├── dependency.ts        ← Smart DAG resolver
│   │   └── executor.ts          ← Async job dispatch
│   │
│   ├── inference/
│   │   ├── intent.ts            ← Intent classifier (NLP)
│   │   ├── code-analyzer.ts     ← Detect deps from code refs
│   │   └── context.ts           ← Session context manager
│   │
│   ├── ui/
│   │   ├── notification-inbox.ts ← Aggregated task notifs
│   │   ├── task-card.ts         ← Individual task card
│   │   ├── progress-widget.ts   ← Sidebar progress bar
│   │   └── renderer.ts          ← ANSI formatting
│   │
│   ├── persistence/
│   │   ├── state.ts             ← In-memory + branch-replay
│   │   └── events.ts            ← Event log (audit trail)
│   │
│   ├── hooks/
│   │   ├── agent-end.ts         ← Capture tasks on agent completion
│   │   ├── before-agent-start.ts ← Inject context for next turn
│   │   └── session-lifecycle.ts ← Init/shutdown handlers
│   │
│   ├── tools/
│   │   └── task-control.ts      ← /task skip|retry|prioritize (minimal)
│   │
│   └── index.ts                 ← Extension entry point
│
├── tests/
│   ├── capture.test.ts
│   ├── dependency.test.ts
│   ├── executor.test.ts
│   ├── intent.test.ts
│   └── e2e.test.ts
│
├── README.md
├── docs/
│   ├── USAGE.md                 ← How agents use (not users)
│   ├── ARCHITECTURE.md          ← Design decisions
│   └── MIGRATION.md             ← From v1 to v2
│
└── package.json
```

---

## UX Design: Implicit Task Management

### 1. Zero-Config Task Capture

**Agent detects tasks automatically from conversation:**

```typescript
// Extension hook: on agent_end
pi.on("agent_end", async (event, ctx) => {
  // Extract tasks from assistant's response (implicit)
  const tasks = taskCapture.inferFromMessage(event.messages);
  
  // Infer dependencies from code context
  const dag = dependencyResolver.build(tasks, ctx);
  
  // Execute async (user doesn't wait)
  executor.dispatch(dag, { background: true });
});
```

**Examples:**

| User Message | Agent Inference |
|---|---|
| "Fix login bug and update docs" | 2 tasks: fix (can start now), docs (depends on fix) |
| "Refactor the auth module" | 3 tasks: analyze, refactor, test (sequential) |
| "Add tests to payment service" | 2 tasks: write tests, run tests (sequential) |

### 2. Minimal UI: Notification Inbox

**No dedicated widget.** Tasks integrated into existing **notification system:**

```
[Notifications]
├─ 🟢 Task: Fix login [✓ Done in 2m]
├─ 🟡 Task: Update docs [→ Running 45s]
│   └─ Click to expand details
├─ 🔴 Task: Deploy [✗ Failed - no changes]
│   └─ "Retry" | "Skip" | "View error"
└─ 📋 Show all (X pending, Y running, Z done)
```

**Why notification inbox (not dedicated widget)?**
- Unified with other system events (builds, errors, reminders)
- Less visual clutter
- Natural discovery (user already checks notifications)
- Works on small screens (no extra panel)

### 3. One-Click Task Control

**Minimal intervention tools:**

```typescript
// Tool: task_control (rarely needed)
// Only for user overrides: skip/retry/prioritize

pi.registerTool("task_control", {
  description: "Skip, retry, or prioritize a running task",
  parameters: {
    taskId: string,
    action: "skip" | "retry" | "prioritize"
  }
});
```

**Usage patterns:**
- User sees error notification → Click "Retry"
- Task taking too long → Click "Skip" (mark done anyway)
- Low-priority task in the way → Click "Prioritize" (swap order)

### 4. No Explicit Commands

**Remove these anti-patterns:**
```
❌ /todo "task text"              → Use natural language
❌ /btw "task1, task2, task3"     → Agent infers
❌ /plan_tracker init ["a","b"]   → Agent breaks down
❌ /tasks list                    → Shown in notifications
❌ /task <id> complete            → Agent detects completion
```

**Keep one tool for edge cases:**
```
✅ task_control(taskId, action)   → User overrides (rare)
```

---

## Implementation: DRY + SOLID Principles

### SOLID Architecture

```typescript
// 1. SINGLE RESPONSIBILITY

// ❌ Before: One god-object
class TaskManager {
  captureFromConversation() {}
  resolveDependencies() {}
  executeAsync() {}
  renderUI() {}
  persistState() {}
}

// ✅ After: Separated concerns
class TaskCapture {
  infer(message: Message): Task[] {}
}

class DependencyResolver {
  build(tasks: Task[]): DAG {}
}

class TaskExecutor {
  dispatch(dag: DAG): Promise<Result> {}
}

class NotificationInbox {
  render(tasks: Task[]): Component {}
}

class TaskStore {
  save(tasks: Task[]): void {}
  load(): Task[] {}
}

// 2. OPEN/CLOSED

// ❌ Before: Hard-coded intent types
if (message.includes("fix")) {
  type = "fix";
} else if (message.includes("refactor")) {
  type = "refactor";
}

// ✅ After: Pluggable intent classifiers
interface IntentClassifier {
  classify(text: string): Intent;
}

class RegexIntentClassifier implements IntentClassifier { }
class NLPIntentClassifier implements IntentClassifier { }
// Add new classifiers without modifying existing code

// 3. LISKOV SUBSTITUTION

interface TaskStore {
  save(tasks: Task[]): Promise<void>;
  load(): Promise<Task[]>;
}

class MemoryTaskStore implements TaskStore { }
class FileTaskStore implements TaskStore { }
class SQLiteTaskStore implements TaskStore { }
// All interchangeable

// 4. INTERFACE SEGREGATION

// ❌ Before: Fat interface
interface TaskManager {
  captureTask(): Task;
  resolveDependencies(): void;
  executeTask(): void;
  persistTask(): void;
  renderUI(): void;
  // Client needs only 1 or 2, but forced to implement all
}

// ✅ After: Segregated interfaces
interface ITaskCapture {
  infer(message: Message): Task[];
}

interface ITaskExecutor {
  dispatch(dag: DAG): Promise<void>;
}

interface INotificationRenderer {
  render(tasks: Task[]): Component;
}

// 5. DEPENDENCY INVERSION

// ❌ Before: Tight coupling
class TaskExecutor {
  private store = new FileTaskStore();
  private notifier = new ConsoleNotifier();
  
  async execute(task: Task) {
    await this.store.save(task);
    this.notifier.notify(task);
  }
}

// ✅ After: Inject dependencies
class TaskExecutor {
  constructor(
    private store: ITaskStore,
    private notifier: INotifier
  ) {}
  
  async execute(task: Task) {
    await this.store.save(task);
    this.notifier.notify(task);
  }
}

// Usage:
new TaskExecutor(
  new MemoryTaskStore(),
  new NotificationInbox()
)
```

### DRY: Eliminate Duplication

**Shared task model:**
```typescript
// ✅ Single source of truth
interface Task {
  id: string;
  text: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  
  // Minimal metadata (eliminate 3 different schemas)
  intent?: string;              // "fix" | "refactor" | "docs" | ...
  blockedBy?: string[];         // Inferred dependencies
  sequenceOrder?: number;       // If explicitly ordered
  
  // Execution context
  agent?: string;
  executor: "sub-pi" | "shell" | "none";
  
  // Results (write-once)
  result?: {
    exitCode: number;
    stdout: string;
    error: string;
    duration: number;
  };
  
  // Audit trail
  source: "captured" | "explicit" | "inferred";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

**Shared rendering logic:**
```typescript
// ❌ Before: Duplicate code in todo, plan-tracker, btw-task
// (3 versions of status-to-icon conversion)
const todoIcon = status === "completed" ? "✓" : "○";
const planIcon = status === "complete" ? "✓" : "→";
const btwIcon = status === "done" ? "✓" : "→";

// ✅ After: Single utility
class TaskRenderer {
  static statusIcon(task: Task): string {
    switch (task.status) {
      case "done": return "✓";
      case "running": return "→";
      case "failed": return "✗";
      default: return "○";
    }
  }
  
  static statusColor(task: Task, theme: Theme): string {
    return {
      "done": theme.fg("success", this.statusIcon(task)),
      "running": theme.fg("warning", this.statusIcon(task)),
      "failed": theme.fg("error", this.statusIcon(task)),
      "pending": theme.fg("dim", this.statusIcon(task))
    }[task.status];
  }
}

// Reuse everywhere: inbox, card, progress-bar
```

**Shared persistence:**
```typescript
// ✅ Single persistence layer (branch-replay + events)
class TaskStore {
  private tasks: Map<string, Task> = new Map();
  
  // Write: append-only event log
  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
    await this.eventLog.append({
      type: "task_updated",
      task,
      timestamp: now()
    });
  }
  
  // Read: reconstruct from branch + event log
  async load(): Promise<Task[]> {
    const fromBranch = this.reconstructFromBranch();
    const fromEvents = this.eventLog.sinceLastSnapshot();
    return merge(fromBranch, fromEvents);
  }
}
```

---

## Task Capture: How Agent Infers Tasks

### Algorithm

```typescript
class TaskCapture {
  // Main entry point
  infer(message: Message): Task[] {
    const segments = this.segmentMessage(message);
    const tasks: Task[] = [];
    
    for (const segment of segments) {
      // 1. Classify intent (fix|refactor|docs|test|deploy|etc)
      const intent = this.classifyIntent(segment);
      
      // 2. Extract task text (verb + object)
      const text = this.extractText(segment);
      
      // 3. Infer dependencies from:
      //    - Conversation history
      //    - Code references (imports, definitions)
      //    - Execution order (explicit sequencing in message)
      const blockingTasks = this.inferDependencies(segment, tasks);
      
      tasks.push({
        id: generateId(),
        text,
        intent,
        blockedBy: blockingTasks.map(t => t.id),
        status: "pending",
        source: "captured"
      });
    }
    
    return tasks;
  }
  
  // Segment message into logical task units
  private segmentMessage(msg: Message): string[] {
    // Split on: "and", commas, newlines, conjunctions
    // "Fix login bug and update auth docs"
    // → ["Fix login bug", "update auth docs"]
    
    // Context: look at previous turns for patterns
    // "First refactor the parser. Then add tests."
    // → ["refactor the parser", "add tests"] (ordered)
    
    return [];
  }
  
  // Classify intent (supervised learning or rules)
  private classifyIntent(text: string): string {
    // Patterns:
    // "Fix X" | "Debug X" | "Resolve X" → "fix"
    // "Refactor X" | "Rewrite X" | "Clean up X" → "refactor"
    // "Add tests" | "Test X" | "Unit test X" → "test"
    // "Update X" | "Document X" | "Write docs" → "docs"
    // "Deploy X" | "Release X" → "deploy"
    
    return this.intentClassifier.classify(text);
  }
  
  // Infer what tasks this one depends on
  private inferDependencies(text: string, previousTasks: Task[]): Task[] {
    // 1. Explicit sequencing in message
    if (text.includes("after") || text.includes("then")) {
      return previousTasks; // This task depends on all prior
    }
    
    // 2. Code reference analysis
    // "Update the auth module tests after fixing login"
    // → Find "login" from previous tasks
    const refs = this.extractCodeReferences(text);
    return previousTasks.filter(t =>
      refs.some(ref => t.text.includes(ref))
    );
    
    // 3. Dependency graph from codebase
    // "Update API docs" → depends on "Fix API endpoint"?
    // (Check if API code was modified in prior tasks)
    
    return [];
  }
}
```

### Examples

```
INPUT: "Fix the login flow and update the auth docs"

CAPTURE PROCESS:
  1. Segment: ["Fix the login flow", "update the auth docs"]
  
  2. Task 1:
     - intent: "fix"
     - text: "Fix the login flow"
     - blockedBy: [] (nothing depends on it)
     
  3. Task 2:
     - intent: "docs"
     - text: "Update the auth docs"
     - blockedBy: [task1.id] (inferred: docs depends on fix)

EXECUTION:
  - Task 1 runs immediately
  - Task 2 waits for Task 1 to complete
  - Both run asynchronously (user doesn't wait)
  - Results posted to notification inbox

INPUT: "Refactor the payment service, add unit tests, and deploy"

CAPTURE:
  1. intent: "refactor" → text: "Refactor the payment service"
  2. intent: "test" → text: "Add unit tests" (depends on 1)
  3. intent: "deploy" → text: "Deploy" (depends on 1, 2)

EXECUTION:
  - Task 1 runs
  - Task 2 waits for Task 1
  - Task 3 waits for Task 1 AND Task 2
  - Sequential chain: 1 → 2 → 3
```

---

## Notification Inbox: UI/UX

### Design: Minimal, Non-Intrusive

```
┌─ Notifications (collapsible) ─────────────┐
├───────────────────────────────────────────┤
│ Tasks: 2 running, 1 pending, 3 done      │
│                                           │
│ ✓ Fix login bug                  [Done]   │
│   Sub-pi: 2m 30s ago                     │
│                                           │
│ → Add auth tests [Running]        [45s]  │
│   Building test suite...                 │
│   [Expand] [Logs] [Skip]                 │
│                                           │
│ ○ Update docs [Pending]          [Blocked]│
│   Waiting for: Add auth tests            │
│   [Show deps]                            │
│                                           │
│ + 3 more tasks (collapsed)               │
└───────────────────────────────────────────┘

On Error:
┌─ Notifications ───────────────────────────┐
│ ✗ Deploy to staging [Failed]              │
│   Error: No uncommitted changes           │
│                                           │
│   [Retry] [Skip] [View error log]        │
└───────────────────────────────────────────┘
```

### Behavior

| State | Display | Action |
|-------|---------|--------|
| **Pending** | ○ Gray | Show dependency blockers |
| **Running** | → Yellow, spinning | Show elapsed time + logs |
| **Done** | ✓ Green | Collapse (show timestamp) |
| **Failed** | ✗ Red, expanded | Show error, offer retry |
| **Skipped** | ⊘ Gray | Show reason (user skipped) |

### No Noise Policy

**Only show notifications for:**
- ✓ Task completion (green checkmark, quiet)
- ✗ Task failure (red alert, loud)
- ⏱️ Long-running (10+ seconds, show progress)

**Never show:**
- Tasks pending (wait for start)
- Task started (too noisy)
- Task queued (distraction)

---

## Extension Hooks: Integration Points

```typescript
export default function (pi: ExtensionAPI) {
  const taskStore = new TaskStore();
  const taskCapture = new TaskCapture();
  const executor = new TaskExecutor(taskStore);
  const inbox = new NotificationInbox(pi.ui);
  
  // 1. CAPTURE: Extract tasks from agent completion
  pi.on("agent_end", async (event, ctx) => {
    // Check if assistant said anything task-like
    const tasks = taskCapture.infer(event.messages);
    
    if (tasks.length === 0) return; // No tasks inferred
    
    // Resolve dependencies
    const dag = dependencyResolver.build(tasks, ctx);
    
    // Dispatch async (non-blocking)
    await executor.dispatch(dag, { background: true });
    
    // Show quick notification "X tasks queued"
    ctx.ui.notify(`${tasks.length} tasks queued`, "info", { auto_close: 2000 });
  });
  
  // 2. INJECT CONTEXT: Inform agent of pending tasks
  pi.on("before_agent_start", async (event, ctx) => {
    const pending = taskStore.getPending();
    const running = taskStore.getRunning();
    
    if (pending.length + running.length === 0) return;
    
    const context = `
Task Status:
- Running: ${running.map(t => t.text).join(", ") || "None"}
- Pending: ${pending.map(t => t.text).join(", ") || "None"}
- Blocked: ${pending.filter(t => t.blockedBy).length} task(s) waiting
    `;
    
    return {
      systemPrompt: event.systemPrompt + "\n\n" + context
    };
  });
  
  // 3. PROGRESS: Stream results to notification inbox
  executor.on("task_update", async (task) => {
    await taskStore.save(task);
    await inbox.update(taskStore.getAll());
  });
  
  // 4. PERSISTENT WIDGET: Compact progress bar in footer
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    
    ctx.ui.setWidget("task_progress", (_tui, theme) => {
      const tasks = taskStore.getAll();
      const done = tasks.filter(t => t.status === "done").length;
      const running = tasks.filter(t => t.status === "running").length;
      const pending = tasks.filter(t => t.status === "pending").length;
      
      const bar = `${done}✓ ${running}→ ${pending}○`;
      return new Text(theme.fg("dim", `Tasks: ${bar}`), 0, 0);
    });
  });
  
  // 5. MINIMAL TOOL: Only for user overrides
  pi.registerTool("task_control", {
    description: "Skip, retry, or reorder a task",
    parameters: Type.Object({
      taskId: Type.String(),
      action: StringEnum(["skip", "retry", "prioritize"])
    }),
    async execute(_id, params, _signal, _update, ctx) {
      const task = taskStore.get(params.taskId);
      if (!task) return { error: "Task not found" };
      
      switch (params.action) {
        case "skip":
          task.status = "skipped";
          break;
        case "retry":
          task.status = "pending";
          await executor.dispatch([{ tasks: [task] }]); // Re-queue
          break;
        case "prioritize":
          // Move to front of queue
          await executor.prioritize(params.taskId);
          break;
      }
      
      await taskStore.save(task);
      return { ok: true, message: `Task ${params.action}ped` };
    }
  });
  
  // 6. LIFECYCLE: Cleanup on shutdown
  pi.on("session_shutdown", async () => {
    // Persist pending tasks for next session
    const pending = taskStore.getPending();
    if (pending.length > 0) {
      await taskStore.persist();
    }
  });
}
```

---

## Code Structure: DRY & SOLID

### Module Organization

```
src/core/
├── task.ts              [Task model + types]
│   export interface Task { ... }
│   export class TaskDAG { ... }
│
├── capture.ts           [Extract tasks from messages]
│   export class TaskCapture { }
│   export interface IIntentClassifier { }
│
├── dependency.ts        [Build DAG]
│   export class DependencyResolver { }
│
└── executor.ts          [Dispatch async]
    export class TaskExecutor { }
    
src/inference/
├── intent.ts            [Intent classification]
│   export class RegexIntentClassifier { }
│   export class NLPIntentClassifier { }
│
├── code-analyzer.ts     [Extract code refs]
│   export class CodeAnalyzer { }
│
└── context.ts           [Session/conversation context]
    export class ContextManager { }
    
src/ui/
├── notification-inbox.ts [Aggregated notifications]
│   export class NotificationInbox { }
│
├── task-card.ts         [Individual task display]
│   export class TaskCard { }
│
├── progress-widget.ts   [Footer progress bar]
│   export class ProgressWidget { }
│
└── renderer.ts          [Shared ANSI logic]
    export class TaskRenderer { }
    
src/persistence/
├── state.ts             [In-memory + branch-replay]
│   export class TaskStore { }
│
└── events.ts            [Event log for audit]
    export class EventLog { }
    
src/hooks/
├── agent-end.ts         [Task capture hook]
├── before-agent-start.ts [Context injection]
└── session-lifecycle.ts  [Init/shutdown]
    
src/tools/
└── task-control.ts      [User control tool (minimal)]
```

### Example: Task Model (DRY)

```typescript
// src/core/task.ts

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  DONE = "done",
  FAILED = "failed",
  SKIPPED = "skipped"
}

export enum TaskIntent {
  FIX = "fix",
  REFACTOR = "refactor",
  TEST = "test",
  DOCS = "docs",
  DEPLOY = "deploy",
  ANALYZE = "analyze"
}

export interface Task {
  id: string;
  text: string;
  
  // Semantics
  intent?: TaskIntent;
  status: TaskStatus;
  
  // Dependencies (unified)
  blockedBy?: string[];  // Task IDs this depends on
  sequenceOrder?: number;
  
  // Execution
  executor: "sub-pi" | "shell" | "none";
  agent?: string;
  
  // Results
  result?: TaskResult;
  
  // Metadata
  source: "captured" | "explicit" | "inferred";
  priority?: "low" | "normal" | "high";
  tags?: string[];
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number; // ms
}

export class TaskDAG {
  tasks: Map<string, Task>;
  edges: Map<string, string[]>; // task -> [dependencies]
  
  constructor(tasks: Task[]) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));
    this.edges = new Map(
      tasks.map(t => [t.id, t.blockedBy || []])
    );
  }
  
  // Topological sort for execution order
  topologicalSort(): string[][] {
    // Returns batches: each batch can run in parallel
    const visited = new Set<string>();
    const batches: string[][] = [];
    
    // ... implementation
    
    return batches;
  }
  
  // Check for cycles
  hasCycle(): boolean {
    // ... DFS-based cycle detection
    return false;
  }
  
  // Get tasks ready to run
  getUnblocked(): Task[] {
    return Array.from(this.tasks.values()).filter(t =>
      !t.blockedBy || t.blockedBy.every(
        depId => this.tasks.get(depId)?.status === TaskStatus.DONE
      )
    );
  }
}
```

### Example: Notification Inbox (SOLID)

```typescript
// src/ui/notification-inbox.ts

interface INotifier {
  show(task: Task): Promise<void>;
  update(tasks: Task[]): Promise<void>;
  close(taskId: string): Promise<void>;
}

export class NotificationInbox implements INotifier {
  private ui: UI;
  private tasks: Map<string, Task>;
  private config: InboxConfig;
  
  constructor(ui: UI, config?: InboxConfig) {
    this.ui = ui;
    this.tasks = new Map();
    this.config = config || DEFAULT_CONFIG;
  }
  
  // Unified rendering (DRY)
  async update(tasks: Task[]): Promise<void> {
    this.tasks.clear();
    tasks.forEach(t => this.tasks.set(t.id, t));
    
    // Intelligently decide what to show
    const toNotify = this.selectNotifiable(tasks);
    const component = this.render(toNotify);
    
    this.ui.setNotification("task_inbox", component);
  }
  
  // Smart notification strategy (not too noisy)
  private selectNotifiable(tasks: Task[]): Task[] {
    return tasks.filter(t => {
      // Always notify on error/failure
      if (t.status === TaskStatus.FAILED) return true;
      
      // Notify on completion (quick flash)
      if (t.status === TaskStatus.DONE) {
        return this.isRecentlyChanged(t);
      }
      
      // Only show running if long-running (> 10s)
      if (t.status === TaskStatus.RUNNING) {
        const duration = Date.now() - new Date(t.startedAt!).getTime();
        return duration > 10000;
      }
      
      // Don't notify pending/queued (not actionable)
      return false;
    });
  }
  
  // Unified renderer
  private render(tasks: Task[]): Component {
    if (tasks.length === 0) return null;
    
    return new Box([
      new Text(`Tasks: ${this.getSummary()}`),
      ...tasks.map(t => new TaskCard(t, this.config.theme))
    ]);
  }
  
  private getSummary(): string {
    const done = this.tasks.size && 
      Array.from(this.tasks.values()).filter(t => t.status === TaskStatus.DONE).length;
    const running = 
      Array.from(this.tasks.values()).filter(t => t.status === TaskStatus.RUNNING).length;
    const pending = 
      Array.from(this.tasks.values()).filter(t => t.status === TaskStatus.PENDING).length;
    
    return `${done}✓ ${running}→ ${pending}○`;
  }
  
  private isRecentlyChanged(task: Task): boolean {
    const ago = Date.now() - new Date(task.completedAt!).getTime();
    return ago < 5000; // Flash for 5 seconds
  }
}
```

---

## Migration: From v1 to v2

### What Happens to Old Tools?

| Old Tool | New Behavior |
|----------|-------------|
| `/todo <task>` | Agent uses conversation; tool deprecated but supported (compat layer) |
| `/btw X, Y, Z` | Agent auto-infers; command deprecated but supported |
| `/plan_tracker` | Agent breaks down plans; tool deprecated but supported |
| Widget overlays | Consolidated into notification inbox + footer progress bar |
| Explicit blockedBy | Inferred from conversation context |

### Backward Compatibility Layer

```typescript
// src/compat/legacy.ts

// If user or legacy agent uses /todo, capture as task
pi.registerTool("todo", { /* legacy */ });

pi.on("tool_execution_end", async (event) => {
  if (event.tool === "todo") {
    // Convert legacy tool call to new Task format
    const task = convertLegacyTodo(event);
    await taskStore.save(task);
  }
});
```

---

## Testing Strategy

```
tests/
├── capture.test.ts
│   ✓ Segment messages correctly
│   ✓ Classify intents accurately
│   ✓ Infer dependencies from code refs
│   ✓ Handle edge cases (ambiguous tasks)
│
├── dependency.test.ts
│   ✓ Build DAG correctly
│   ✓ Detect cycles
│   ✓ Topological sort (execution order)
│   ✓ Handle missing/deleted tasks
│
├── executor.test.ts
│   ✓ Dispatch async tasks
│   ✓ Queue tasks in dependency order
│   ✓ Handle task failures gracefully
│   ✓ Update status correctly
│
├── intent.test.ts
│   ✓ Classify common intents
│   ✓ Handle ambiguous phrases
│   ✓ Extract entities (what to do)
│
├── e2e.test.ts
│   ✓ Full workflow: capture → resolve → execute → notify
│   ✓ Multi-task scenarios
│   ✓ Session persistence
│   ✓ Widget rendering
│
└── integration.test.ts
    ✓ With subagent for execution
    ✓ With memory extension
    ✓ With permission system
```

---

## Success Metrics

### Technical

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Code lines** | < 2,500 | Lean, maintainable |
| **Cyclomatic complexity** | < 3 per function | Testable, readable |
| **SOLID violations** | 0 | Clean architecture |
| **Code coverage** | > 80% | Core logic tested |
| **Dependencies** | 0 new | Use existing pi/node APIs |

### UX

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Commands needed** | 1 (task_control) | Zero-config |
| **User actions/task** | < 0.1 | Mostly automatic |
| **Notification spam** | None | Only errors/completion |
| **Widget clutter** | 1 footer bar | Minimal UI footprint |
| **Setup time** | 0 minutes | Enabled by default |

### Behavioral

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Tasks auto-captured** | > 80% of agent tasks | Low false-positive |
| **Dependencies inferred** | > 90% accuracy | Smart sequencing |
| **Task completion rate** | > 95% | Reliable execution |
| **Notification latency** | < 500ms | Responsive |

---

## Implementation Phases

### Phase 1: Core (Days 1-2, ~6h)

- [ ] Task model + DAG (task.ts, core.ts)
- [ ] TaskCapture basic (capture.ts)
- [ ] Simple intent classifier (rules-based)
- [ ] TaskStore + branch-replay
- [ ] DependencyResolver
- [ ] Unit tests (capture, dependency, store)

### Phase 2: Execution (Days 3-4, ~5h)

- [ ] TaskExecutor (async dispatch)
- [ ] Integration with sub-pi
- [ ] Error handling + retries
- [ ] Event log (audit trail)
- [ ] Integration tests

### Phase 3: UI (Days 5, ~3h)

- [ ] NotificationInbox component
- [ ] TaskCard renderer
- [ ] ProgressWidget for footer
- [ ] Smart notification strategy (no noise)
- [ ] UI tests

### Phase 4: Integration (Days 6, ~2h)

- [ ] Extension hooks (agent_end, before_agent_start)
- [ ] Compat layer (legacy tools)
- [ ] Session lifecycle
- [ ] E2E tests

### Phase 5: Polish (Days 7, ~2h)

- [ ] Documentation (USAGE.md, ARCHITECTURE.md)
- [ ] Migration guide (from v1)
- [ ] Performance optimization
- [ ] Code review + refactor

**Total: ~18 hours, 1 week**

---

## Code Example: Full Integration

```typescript
// src/index.ts — Complete extension

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { TaskCapture } from "./core/capture";
import { DependencyResolver } from "./core/dependency";
import { TaskExecutor } from "./core/executor";
import { TaskStore } from "./persistence/state";
import { NotificationInbox } from "./ui/notification-inbox";

export default function (pi: ExtensionAPI) {
  // Dependencies
  const store = new TaskStore();
  const capture = new TaskCapture();
  const resolver = new DependencyResolver();
  const executor = new TaskExecutor(store, pi);
  const inbox = new NotificationInbox(pi.ui);
  
  // Load persisted tasks
  (async () => {
    await store.load();
  })();
  
  // Hook 1: Capture tasks from agent completion
  pi.on("agent_end", async (event, ctx) => {
    const tasks = capture.infer(event.messages);
    if (tasks.length === 0) return;
    
    // Save + execute
    for (const task of tasks) {
      await store.save(task);
    }
    
    const dag = resolver.build(await store.getAll());
    await executor.dispatch(dag);
    
    // Quiet notification
    ctx.ui.notify(`${tasks.length} tasks queued`, "info", { 
      auto_close: 2000 
    });
  });
  
  // Hook 2: Inject task context
  pi.on("before_agent_start", async (event, ctx) => {
    const pending = await store.getPending();
    const running = await store.getRunning();
    
    if (pending.length + running.length === 0) return;
    
    const info = `
### Active Tasks
- **Running**: ${running.map(t => t.text).join(", ") || "None"}
- **Pending**: ${pending.map(t => t.text).join(", ") || "None"}

Manage tasks with: task_control(taskId, action)
    `;
    
    return {
      systemPrompt: event.systemPrompt + "\n\n" + info
    };
  });
  
  // Hook 3: Stream task updates
  executor.on("task_update", async (task) => {
    await store.save(task);
    await inbox.update(await store.getAll());
  });
  
  // Hook 4: Persistent footer widget
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    
    const updateWidget = async () => {
      const tasks = await store.getAll();
      const summary = `${tasks.filter(t => t.status === "done").length}✓ ` +
        `${tasks.filter(t => t.status === "running").length}→ ` +
        `${tasks.filter(t => t.status === "pending").length}○`;
      
      ctx.ui.setWidget("task_progress", 
        new Text(`Tasks: ${summary}`, 0, 0)
      );
    };
    
    await updateWidget();
    executor.on("task_update", updateWidget);
  });
  
  // Hook 5: Minimal user tool
  pi.registerTool("task_control", {
    description: "Skip, retry, or prioritize a task",
    parameters: Type.Object({
      taskId: Type.String(),
      action: StringEnum(["skip", "retry", "prioritize"])
    }),
    async execute(_id, params) {
      const task = await store.get(params.taskId);
      if (!task) return { error: "Not found" };
      
      if (params.action === "skip") {
        task.status = "skipped";
      } else if (params.action === "retry") {
        task.status = "pending";
        const dag = resolver.build(await store.getAll());
        await executor.dispatch(dag);
      }
      
      await store.save(task);
      return { ok: true };
    }
  });
  
  // Hook 6: Cleanup
  pi.on("session_shutdown", async () => {
    await store.persist();
  });
}
```

---

## Architecture Decision Record (ADR)

### ADR-1: Why Implicit Task Capture?

**Problem:** Users had to explicitly declare tasks with `/todo`, `/btw`, etc.
**Solution:** Agent infers tasks automatically from conversation.
**Benefits:**
- Zero friction (no commands)
- Better dependency inference (from context)
- Natural language (user's own words)
- Consistent with modern AI UX (Claude Projects, GitHub Copilot)
**Trade-offs:**
- Requires good intent classification (mitigated by tests + fallback)
- Can infer false positives (mitigated by filtering: only action verbs)

### ADR-2: Why Async-First Execution?

**Problem:** Blocking execution forces user to wait for task completion.
**Solution:** All tasks run in background by default.
**Benefits:**
- Non-blocking (better UX)
- Parallelizable (run independent tasks concurrently)
- Natural workflow (user continues working)
**Trade-offs:**
- Complexity in async coordination (mitigated by DAG + event system)
- Harder to debug (mitigated by audit log + detailed error messages)

### ADR-3: Why Notification Inbox (not dedicated widget)?

**Problem:** Separate task widget adds visual clutter.
**Solution:** Integrate into existing notification system.
**Benefits:**
- Unified with other system events
- Reduces UI footprint
- Prevents notification fatigue (single place to check)
- Works on all screen sizes
**Trade-offs:**
- Less prominent than dedicated widget (acceptable: users check notifications regularly)
- Requires smart filtering to avoid spam (mitigated by "no noise" policy)

### ADR-4: Why SOLID + DRY?

**Problem:** Original v1 had 3 overlapping task implementations (btw, todo, plan-tracker).
**Solution:** Single task model + separated concerns (capture, resolve, execute, render).
**Benefits:**
- 75% less code
- Changes in one place
- Easy to extend (add new intent classifier, notifier, etc)
- Testable units
**Trade-offs:**
- Initial refactor effort (acceptable: pays off immediately)
- More files (18 vs 8, but smaller + focused each)

---

## Comparison: v1 vs v2

| Aspect | v1 (Old) | v2 (New) |
|--------|----------|----------|
| **User interaction** | `/todo`, `/btw`, `/plan_tracker` commands | Natural conversation (agent auto-detects) |
| **Task declaration** | Explicit | Implicit |
| **Dependency tracking** | blockedBy array, topic-based | Inferred from context + code analysis |
| **Execution** | Synchronous (blocking) | Asynchronous (background) |
| **UI** | 2 overlapping widgets | 1 notification inbox + 1 footer bar |
| **Noise level** | Medium (shows all task updates) | Low (only errors/completion) |
| **Code organization** | 3 separate implementations | 1 unified + modular |
| **SOLID compliance** | Low (tight coupling) | High (dependency injection, segregated interfaces) |
| **DRY compliance** | Low (duplication) | High (shared model + renderers) |
| **Lines of code** | ~2,100 | ~2,000 (plus compat layer) |
| **Setup time** | 0 (but need to learn commands) | 0 (works automatically) |
| **User cognitive load** | Higher ("which tool to use?") | Lower ("just talk, it works") |

---

## Summary

**Vision:** Agent-driven, zero-config task orchestration that works in the background.

**Key Changes:**
1. Remove explicit `/todo`, `/btw`, `/plan_tracker` commands
2. Add implicit task capture from agent completion
3. Consolidate 3 implementations into 1 unified extension
4. Follow SOLID + DRY for maintainability
5. Smart notification inbox instead of overlapping widgets
6. One minimal tool (`task_control`) for user overrides

**Architecture:** Clean, modular, testable (18 modules, <2,500 lines)

**UX:** Transparent to user, works automatically, interrupts only on errors

**Effort:** ~18 hours, 1 week

**Outcome:** Fewer files, clearer code, better UX, higher productivity

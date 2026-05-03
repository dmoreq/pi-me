# Plan: Consolidate Task Extensions

**Status:** Draft  
**Created:** 2026-05-03  
**Scope:** core-tools: btw-task, todo, plan-tracker, subagent → single unified extension

---

## Current State Analysis

### 4 Extensions, ~15,500 lines, 99 TS files

| Extension | Lines | Files | Purpose | Key Features |
|-----------|-------|-------|---------|--------------|
| **btw-task** | ~800 | 8 | "/btw X, Y, Z" command dispatcher | Auto-dependency planning, topic-based sequencing, widget |
| **todo** | ~700 | 10 | Persistent task list | 4-state machine (pending→in_progress→completed→deleted), blockedBy deps, branch-replay |
| **plan-tracker** | ~600 | 3 | Simple task progress tracker | init/update/status/clear actions, icon widget, pure state in details |
| **subagent** | ~13,000 | 78 | Full agent orchestration | Single/chain/parallel dispatch, async jobs, agent manager UI, control notices |

### Overlap Points

1. **Task data model:** 3 different representations
   - btw-task: `{id, text, status, subtasks, agent}`
   - todo: `{id, text, status: 4-state, blockedBy: id[], ...}`
   - plan-tracker: `{index, text, status: 3-state}`
   
2. **Widget persistence:** Both todo and plan-tracker render overlays

3. **State management:** 
   - todo: branch-replay reconstruction
   - btw-task: local state.ts file
   - plan-tracker: tool result details (pure)
   - subagent: artifact directory trees + async tracker

4. **Dependency tracking:**
   - todo: explicit blockedBy array
   - btw-task: implicit (topic-based sequencing)
   - subagent: chain steps

5. **Execution:**
   - btw-task: simple sub-pi dispatch
   - subagent: complex (foreground/background, control notices, agent manager)

---

## Design Goals

1. **Single unified task/plan abstraction** — merge btw-task, todo, plan-tracker into one
2. **Preserve subagent complexity** — keep as separate plugin (agent orchestration ≠ task tracking)
3. **One widget** — unified overlay for all task types
4. **One state model** — flexible schema supporting both simple lists and DAG dependencies
5. **One persistence strategy** — choose best approach (branch-replay + optional file backup)
6. **Backward compatibility** — existing `/todo`, `/btw`, `/plan_tracker` commands still work

---

## Proposed Architecture: `task-orchestration` Plugin

```
core-tools/
├── task-orchestration/  ← NEW unified plugin
│   ├── src/
│   │   ├── core/
│   │   │   ├── task.ts           ← Unified task model
│   │   │   ├── state.ts          ← Global state manager
│   │   │   ├── dependency.ts     ← DAG resolver (blockedBy + topic sequencing)
│   │   │   └── executor.ts       ← Sub-pi dispatch + async tracking
│   │   ├── persistence/
│   │   │   ├── branch-replay.ts  ← Reconstruct from session history
│   │   │   └── state-file.ts     ← Optional ~/.pi/task-state.json
│   │   ├── widgets/
│   │   │   ├── task-overlay.ts   ← Unified overlay widget
│   │   │   ├── renderer.ts       ← ANSI formatting + icons
│   │   │   └── themes.ts         ← Color schemes
│   │   ├── tools/
│   │   │   ├── todo.ts           ← todo() tool (backward compat)
│   │   │   ├── plan-tracker.ts   ← plan_tracker() tool (backward compat)
│   │   │   └── btw.ts            ← /btw command (backward compat)
│   │   ├── types.ts              ← Shared types
│   │   └── index.ts              ← Extension entry point
│   ├── README.md
│   ├── package.json
│   ├── tsconfig.json
│   └── tests/
│       ├── task.test.ts
│       ├── dependency.test.ts
│       ├── executor.test.ts
│       └── persistence.test.ts
│
├── btw-task/                      ← (DELETE after migration)
├── todo/                          ← (DELETE after migration)
├── plan-tracker/                  ← (DELETE after migration)
│
└── subagent/                      ← (KEEP — separate concern)
```

---

## Task Model: Unified Schema

```typescript
// Single task representation
interface UnifiedTask {
  id: string;                     // UUID
  text: string;                   // Task description
  
  // Execution
  status: "pending" | "in_progress" | "completed" | "deleted";
  createdAt: string;              // ISO timestamp
  startedAt?: string;
  completedAt?: string;
  
  // Dependencies (combines todo + btw-task approaches)
  blockedBy?: string[];           // Explicit task IDs (from todo)
  topic?: string;                 // For implicit sequencing (from btw-task)
  sequenceOrder?: number;         // User-specified order
  
  // Execution context
  executor?: "sub-pi" | "shell" | "none";
  agent?: string;                 // For subagent dispatch
  agentArgs?: Record<string, any>;
  
  // Metadata
  source: "todo" | "btw" | "plan_tracker" | "manual";
  priority?: "low" | "normal" | "high";
  tags?: string[];
  
  // Results
  result?: {
    exitCode?: number;
    stdout?: string;
    error?: string;
  };
}

// Global task store
interface TaskState {
  tasks: UnifiedTask[];           // Master task list
  version: number;                // For migrations
  lastModified: string;           // ISO timestamp
  activeTaskId?: string;          // Currently displayed task
  
  // Widget state
  widget: {
    visible: boolean;
    collapsed: boolean;
    filter: "all" | "pending" | "in_progress" | "completed";
  };
}
```

---

## State Management Strategy

### Write Path
```
User input (todo/btw/plan_tracker command)
  ↓
Tool handler (tools/*.ts)
  ↓
StateManager.addTask() / updateTask()
  ↓
Update in-memory state
  ↓
Emit "task_changed" event
  ↓
Branch entry logged (by pi core)
  ↓
Optional: write to ~/.pi/task-state.json
```

### Read Path (on session_start)
```
Pi starts
  ↓
ReplayManager.reconstructFromBranch()
  ↓
Scan session history for tool calls
  ↓
Rebuild task list in memory
  ↓
Load widget from state
  ↓
Ready for queries
```

### Persistence Options
1. **Branch replay (primary):** No extra files, survives session fork/rebase
2. **State file backup (optional):** ~/.pi/task-state.json for offline inspection
3. **No DB/SQLite:** Keep simple (unlike model-registry would have been)

---

## Unified Dependency Resolver

```typescript
interface DependencyGraph {
  // Build graph from blockedBy + topic + sequenceOrder
  resolve(tasks: UnifiedTask[]): {
    canRun: string[];       // Task IDs unblocked
    blocked: string[];      // Task IDs waiting
    sequential: string[][];  // Topic-grouped batches
  };
  
  // Check if task A blocks task B
  isBlocked(taskId: string): boolean;
  
  // Auto-sequence tasks by topic similarity
  autoSequenceByTopic(tasks: UnifiedTask[]): string[][];
}
```

**Logic:**
- If task has `blockedBy: ["X"]`, it waits for X to complete
- If task has `topic: "auth"`, and another has `topic: "auth"`, they run sequentially
- If task has `sequenceOrder: 1`, enforce explicit order
- Otherwise: run in parallel

---

## Tools & Commands (Backward Compat Layer)

### Tool: `todo(task, status?, blockedBy?)`
Maps to: `UnifiedTask` with `source: "todo"`

```
todo(text="Fix login bug", blockedBy=["task-123"])
  ↓ StateManager.addTask({text, status: "pending", blockedBy})
  ✓ Stored in unified state
```

### Tool: `plan_tracker(action, tasks?, index?, status?)`
Maps to: `UnifiedTask[]` with `source: "plan_tracker"`

```
plan_tracker(action="init", tasks=["Step 1", "Step 2"])
  ↓ StateManager.initPlan([...])
  ✓ Stored in unified state
```

### Command: `/btw X, Y, Z`
Maps to: `UnifiedTask[]` with `source: "btw"`, auto `topic` assignment

```
/btw fix login bug, refactor db, update docs
  ↓ Parse "fix login" → topic: "auth"
  ↓ Parse "refactor db" → topic: "db"  (auto-group similar)
  ↓ Parse "update docs" → topic: "docs"
  ✓ Stored in unified state with implicit sequencing
```

### New unified commands (optional)
- `/tasks` — show all tasks
- `/tasks pending` — show pending only
- `/task <id> complete` — mark task done
- `/task <id> block <id2>` — add dependency
- `/task clear completed` — prune done tasks

---

## Widget: Unified Task Overlay

```
Tasks: ✓ ✓ → ○ ○   (5 total, 2 done, 1 running, 2 pending)
  ├─ [Running] Fix login bug (sub-pi: auth-test)
  ├─ [Pending] Refactor database (blocked by Fix login)
  └─ [Pending] Update docs
```

**Features:**
- One overlay for todo/btw/plan_tracker
- Color-coded status (✓ green, → yellow, ○ gray, × red)
- Click to expand/collapse
- Right-align metadata (agent, duration, error)
- Configurable "show only X tasks" limit

---

## Execution & Subagent Integration

### Simple execution (no subagent)
```
Task status: pending
User: /task <id> run
  ↓ StateManager.startTask(id)
  ↓ Sub-pi dispatch (simple, no agent manager)
  ✓ Status → in_progress
  ...poll for completion...
  ✓ Status → completed
```

### Complex execution (with subagent)
```
Task with agent specified:
  /btw agent=code-review review my PR

  ↓ DependencyResolver.canRun(taskId)
  ✓ Task unblocked
  
  ↓ Executor.dispatch({ agent, task, mode: "async" })
  ↓ Calls existing subagent tool
  ✓ Async job tracker hooks in
  
  ← Subagent finish event
  ✓ StateManager.updateTask(id, {status: "completed", result})
```

---

## Migration Path

### Phase 1: Create unified extension
```
1. Create task-orchestration/src/core/ skeleton
2. Define UnifiedTask type + StateManager
3. Write persistence layer (branch-replay)
4. Write dependency resolver
5. Write tests (core logic)
```

### Phase 2: Backward compat layer
```
1. Implement tools/todo.ts → UnifiedTask adapter
2. Implement tools/plan-tracker.ts → UnifiedTask adapter
3. Implement tools/btw.ts → UnifiedTask adapter + auto-topic
4. Verify all old command still work
5. Update tests from original extensions
```

### Phase 3: Unified widget
```
1. Create widgets/task-overlay.ts with combined rendering
2. Port styling from todo overlay + plan-tracker widget
3. Integrate with StateManager
4. Session lifecycle hooks (start/compact/shutdown)
```

### Phase 4: Cleanup & docs
```
1. Delete old: btw-task/, todo/, plan-tracker/
2. Update core-tools/index.ts (remove 3 imports, add 1)
3. Write README.md for task-orchestration
4. Migration guide in docs
```

---

## Why NOT Include Subagent?

| Aspect | Task-Orchestration | Subagent |
|--------|-------------------|----------|
| **Scope** | Task tracking + execution | Agent lifecycle + orchestration |
| **Complexity** | ~2,000 lines | ~13,000 lines |
| **Responsibility** | "What to do?" | "How to delegate?" |
| **Users** | Anyone listing tasks | Advanced workflows, agent managers |
| **Config** | Simple (~ 10 settings) | Complex (agent manager UI, control notices, intercom) |
| **Stability** | High (simple state) | Medium (background jobs, async) |

**Keeping separate allows:**
- Task-orchestration to be stable, boring, zero-maintenance
- Subagent to iterate on agent UX without breaking tasks
- Clear separation of concerns (tracking ≠ delegation)

---

## Benefits of Consolidation

| Benefit | Current | After |
|---------|---------|-------|
| **User confusion** | 3 different task UIs | 1 unified task center |
| **Code duplication** | Widget code in todo + plan-tracker | Single task-overlay.ts |
| **State inconsistency** | 3 different models | 1 UnifiedTask |
| **Maintenance burden** | Update 3 extensions separately | Update 1 |
| **New feature velocity** | Add feature to all 3 separately | Add feature once |
| **Lines of code** | ~2,100 (btw+todo+plan) | ~2,200 (unified, slightly more due to compat layer) |
| **Cognitive load** | "Do I use /todo or /btw?" | "Use /tasks" |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing sessions | Branch-replay reconstruction handles old tool calls |
| Complex dependency logic | Comprehensive unit tests + integration tests |
| Widget conflicts | Test overlapping task widget + other widgets (memory, etc) |
| Performance (many tasks) | Index by status/topic; lazy-render large lists |
| Backward compat | Backward compat layer maps old tools to new model |

---

## Implementation Effort Estimate

| Phase | Effort | Critical Path |
|-------|--------|--------------|
| 1 — Core skeleton | 2h | Yes |
| 2 — Compat layer | 3h | Yes |
| 3 — Widget | 2h | Yes |
| 4 — Cleanup + docs | 1h | Yes |
| Tests (concurrent) | 3h | Yes |
| **Total** | **~11h** | |

---

## Files to Create/Delete

### Create
```
task-orchestration/
├── src/
│   ├── core/task.ts
│   ├── core/state.ts
│   ├── core/dependency.ts
│   ├── core/executor.ts
│   ├── persistence/branch-replay.ts
│   ├── persistence/state-file.ts
│   ├── widgets/task-overlay.ts
│   ├── widgets/renderer.ts
│   ├── widgets/themes.ts
│   ├── tools/todo.ts
│   ├── tools/plan-tracker.ts
│   ├── tools/btw.ts
│   ├── types.ts
│   └── index.ts
├── tests/
│   ├── task.test.ts
│   ├── dependency.test.ts
│   ├── executor.test.ts
│   └── persistence.test.ts
├── README.md
├── package.json
└── tsconfig.json
```

### Delete
```
btw-task/          (entire directory)
todo/              (entire directory)
plan-tracker/      (entire directory)
```

### Update
```
core-tools/index.ts
  - Remove: import btwTask from "./btw-task/..."
  - Remove: import todo from "./todo/..."
  - Remove: import planTracker from "./plan-tracker/..."
  - Add: import taskOrchestration from "./task-orchestration/..."
  
  - Remove: btwTask(pi)
  - Remove: todo(pi)
  - Remove: planTracker(pi)
  - Add: taskOrchestration(pi)
```

---

## Open Questions

1. **Async mode:** Should tasks auto-run in background? Or always foreground + opt-in async?
2. **Widget position:** Stack above todo widget, or merge into one widget?
3. **Limit:** Max tasks before pagination? (Current btw-task: 3; todo: unlimited)
4. **Export:** CLI to export task history? (Could integrate with usage dashboard)

---

## Success Criteria

- [ ] `/todo` still works; tasks appear in unified widget
- [ ] `/btw X, Y, Z` still works; auto-sequencing by topic works
- [ ] `/plan_tracker init` still works; shown in unified widget
- [ ] Session fork/rebase preserves task list (branch-replay works)
- [ ] Widget renders all task types together
- [ ] Dependency resolver handles blockedBy + topic + explicit order
- [ ] All 99 original tests pass (or consolidated into 40-50 new tests)
- [ ] ≤ 2,500 lines of code (includes compat layer + docs)
- [ ] Zero external dependencies added

---

## Timeline

```
Week 1:
  Mon–Tue: Design + skeleton (phase 1)
  Wed–Thu: Compat layer + tests (phase 2)
  Fri: Widget + cleanup (phase 3–4)

Week 2:
  Mon–Tue: Integration testing, polish
  Wed: Documentation
  Thu: Review + merge
```

Estimated: **1.5–2 weeks** with minimal disruption to other extensions.

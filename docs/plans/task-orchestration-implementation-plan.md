# Task Orchestration v2: Implementation Plan

**Status:** Ready for execution  
**Created:** 2026-05-03  
**Duration:** ~18 hours, 1 week (5 phases)  
**Team:** 1 engineer (can be parallelized with 2 engineers)

---

## Executive Summary

This document breaks down the v2 specification into concrete, executable tasks with:
- Daily milestones
- Specific file lists (create/modify/delete)
- Code checkpoints
- Testing requirements
- Integration points

**Quick facts:**
- 18 modules to create
- ~2,000 lines of code to write
- 6 test suites
- 0 new dependencies
- Replaces 99 files (btw-task, todo, plan-tracker)

---

## Phase 1: Core Skeleton (Days 1-2, ~6 hours)

### Goal
Build the foundation: task model, state management, persistence, dependency resolution.

### Day 1A: Task Model + Types (2 hours)

**Deliverables:**
```
src/
├── core/
│   ├── task.ts          [NEW] Task model + DAG + enums
│   └── types.ts         [NEW] Shared type definitions
```

**Acceptance Criteria:**
- [ ] Task enum (status, intent)
- [ ] TaskResult interface
- [ ] UnifiedTask interface
- [ ] TaskDAG class with methods:
  - [ ] `topologicalSort(): string[][]` (returns execution batches)
  - [ ] `hasCycle(): boolean`
  - [ ] `getUnblocked(): Task[]`
- [ ] All exported types pass TypeScript strict mode

**Code Checkpoint:**
```typescript
// src/core/task.ts should have:
export enum TaskStatus { PENDING, RUNNING, DONE, FAILED, SKIPPED }
export enum TaskIntent { FIX, REFACTOR, TEST, DOCS, DEPLOY, ANALYZE }
export interface Task { id, text, status, intent, blockedBy?, ... }
export class TaskDAG { 
  topologicalSort() { } 
  hasCycle() { } 
}
```

**Tests to write:**
```
tests/core/task.test.ts (~120 lines)
  describe('TaskDAG')
    ✓ Create TaskDAG with tasks
    ✓ topologicalSort: single chain (A→B→C)
    ✓ topologicalSort: parallel tasks (A,B parallel, then C)
    ✓ topologicalSort: complex DAG (diamond pattern)
    ✓ hasCycle: detect simple cycle (A→B→A)
    ✓ hasCycle: detect complex cycle (A→B→C→A)
    ✓ hasCycle: no cycle in valid DAG
    ✓ getUnblocked: return tasks with no dependencies
    ✓ getUnblocked: filter by status (PENDING only)
    ✓ getUnblocked: handle missing dependencies gracefully
    ✓ Task creation with defaults
    ✓ Task enum values correct
```

**Test file structure:**
```typescript
// tests/core/task.test.ts
import { describe, it, expect } = require("@jest/globals");
import { TaskDAG, Task, TaskStatus, TaskIntent } from "../../src/core/task";

describe("TaskDAG", () => {
  describe("topologicalSort", () => {
    it("should sort single chain A->B->C", () => {
      const tasks = [
        { id: "A", text: "Fix", blockedBy: [] },
        { id: "B", text: "Test", blockedBy: ["A"] },
        { id: "C", text: "Deploy", blockedBy: ["B"] }
      ];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted).toEqual([["A"], ["B"], ["C"]]);
    });

    it("should batch parallel tasks A,B -> C", () => {
      const tasks = [
        { id: "A", text: "Fix", blockedBy: [] },
        { id: "B", text: "Docs", blockedBy: [] },
        { id: "C", text: "Deploy", blockedBy: ["A", "B"] }
      ];
      const dag = new TaskDAG(tasks);
      const sorted = dag.topologicalSort();
      expect(sorted).toEqual([["A", "B"], ["C"]]);
    });
  });

  describe("hasCycle", () => {
    it("should detect simple cycle A->B->A", () => {
      const tasks = [
        { id: "A", text: "Fix", blockedBy: ["B"] },
        { id: "B", text: "Test", blockedBy: ["A"] }
      ];
      const dag = new TaskDAG(tasks);
      expect(dag.hasCycle()).toBe(true);
    });

    it("should return false for acyclic DAG", () => {
      const tasks = [
        { id: "A", text: "Fix", blockedBy: [] },
        { id: "B", text: "Test", blockedBy: ["A"] }
      ];
      const dag = new TaskDAG(tasks);
      expect(dag.hasCycle()).toBe(false);
    });
  });
});
```

### Day 1B: State Management (2 hours)

**Deliverables:**
```
src/
├── persistence/
│   ├── state.ts         [NEW] TaskStore (in-memory + branch-replay)
│   └── events.ts        [NEW] EventLog (audit trail)
```

**Acceptance Criteria:**
- [ ] TaskStore class with methods:
  - [ ] `save(task: Task): Promise<void>`
  - [ ] `load(): Promise<Task[]>`
  - [ ] `get(id: string): Promise<Task>`
  - [ ] `getAll(): Promise<Task[]>`
  - [ ] `getPending(): Promise<Task[]>`
  - [ ] `getRunning(): Promise<Task[]>`
- [ ] EventLog class with:
  - [ ] `append(event): Promise<void>`
  - [ ] `since(timestamp): Promise<Event[]>`
- [ ] Branch-replay reconstruction logic
- [ ] In-memory cache for fast queries

**Code Checkpoint:**
```typescript
// src/persistence/state.ts
export class TaskStore {
  private tasks: Map<string, Task> = new Map();
  
  async save(task: Task): Promise<void> { }
  async load(): Promise<Task[]> { }
  async get(id: string): Promise<Task> { }
  async getAll(): Promise<Task[]> { }
}
```

**Tests to write:**
```
tests/persistence/state.test.ts (~200 lines)
  describe('TaskStore')
    ✓ Save task to store
    ✓ Load task by ID
    ✓ Load all tasks
    ✓ Update existing task
    ✓ Delete task (soft delete)
    ✓ Get by status: PENDING
    ✓ Get by status: RUNNING
    ✓ Get by status: DONE
    ✓ Get by status: FAILED
    ✓ Count tasks by status
    ✓ Handle task not found (throws)
    ✓ Handle concurrent saves
    ✓ Load from JSON file
    ✓ Persist to JSON file
    ✓ Event log append
    ✓ Event log query since timestamp
    ✓ Reconstruct state from event log
    ✓ Branch-replay reconstruction
```

**Test file structure:**
```typescript
// tests/persistence/state.test.ts
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import { TaskStore } from "../../src/persistence/state";
import { Task, TaskStatus } from "../../src/core/task";

describe("TaskStore", () => {
  let store: TaskStore;
  const testFile = "test-tasks.json";

  beforeEach(() => {
    store = new TaskStore(testFile);
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  describe("save/load", () => {
    it("should save and load task", async () => {
      const task: Task = {
        id: "task-1",
        text: "Fix login",
        status: TaskStatus.PENDING,
        intent: "FIX",
        blockedBy: []
      };
      await store.save(task);
      const loaded = await store.get("task-1");
      expect(loaded).toEqual(task);
    });

    it("should load all tasks", async () => {
      const task1 = { id: "1", text: "Fix", status: TaskStatus.PENDING };
      const task2 = { id: "2", text: "Test", status: TaskStatus.PENDING };
      await store.save(task1);
      await store.save(task2);
      const all = await store.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("query by status", () => {
    beforeEach(async () => {
      await store.save({ id: "1", status: TaskStatus.PENDING });
      await store.save({ id: "2", status: TaskStatus.RUNNING });
      await store.save({ id: "3", status: TaskStatus.DONE });
    });

    it("should get pending tasks", async () => {
      const pending = await store.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe("1");
    });

    it("should get running tasks", async () => {
      const running = await store.getRunning();
      expect(running).toHaveLength(1);
      expect(running[0].id).toBe("2");
    });
  });
});
```

### Day 1C: Dependency Resolver (2 hours)

**Deliverables:**
```
src/
├── core/
│   └── dependency.ts    [NEW] DependencyResolver class
```

**Acceptance Criteria:**
- [ ] DependencyResolver class with:
  - [ ] `build(tasks: Task[], context): TaskDAG`
  - [ ] Merge blockedBy + topic + sequenceOrder
  - [ ] Handle missing dependencies gracefully
  - [ ] Log resolution decisions (debug)
- [ ] Integration with TaskDAG
- [ ] Cycle detection with meaningful error messages

**Code Checkpoint:**
```typescript
// src/core/dependency.ts
export class DependencyResolver {
  build(tasks: Task[], context: SessionContext): TaskDAG {
    // 1. Merge all dependency types
    // 2. Validate (no cycles, no missing deps)
    // 3. Return TaskDAG
    return new TaskDAG(enrichedTasks);
  }
}
```

**Tests to write:**
```
tests/core/dependency.test.ts (~180 lines)
  describe('DependencyResolver')
    ✓ Build DAG from blockedBy explicit deps
    ✓ Build DAG from topic-based sequencing
    ✓ Build DAG from sequenceOrder explicit order
    ✓ Merge blockedBy + topic + sequenceOrder
    ✓ Topic sequencing: auto-order by topic
    ✓ Topic sequencing: respect explicit order within topic
    ✓ Cycle detection: simple A->B->A
    ✓ Cycle detection: complex 4-node cycle
    ✓ Cycle detection: error message includes cycle path
    ✓ Handle missing dependencies: log warning, skip
    ✓ Handle undefined blockedBy: treat as empty array
    ✓ Infer dependencies from code references
    ✓ Infer sequential deps from "then"/"after"
    ✓ Validate all tasks exist before building
    ✓ Return valid TaskDAG on success
```

**Test file structure:**
```typescript
// tests/core/dependency.test.ts
import { describe, it, expect } from "@jest/globals";
import { DependencyResolver } from "../../src/core/dependency";
import { Task, TaskStatus } from "../../src/core/task";

describe("DependencyResolver", () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe("build from blockedBy", () => {
    it("should build DAG with explicit blockedBy", () => {
      const tasks: Task[] = [
        { id: "A", text: "Fix", status: TaskStatus.PENDING, blockedBy: [] },
        { id: "B", text: "Test", status: TaskStatus.PENDING, blockedBy: ["A"] },
        { id: "C", text: "Deploy", status: TaskStatus.PENDING, blockedBy: ["B"] }
      ];
      const dag = resolver.build(tasks, {});
      expect(dag.hasCycle()).toBe(false);
      expect(dag.topologicalSort()).toEqual([["A"], ["B"], ["C"]]);
    });
  });

  describe("build from topic", () => {
    it("should auto-sequence tasks by topic", () => {
      const tasks: Task[] = [
        { id: "1", text: "Fix auth", topic: "auth", status: TaskStatus.PENDING },
        { id: "2", text: "Add auth tests", topic: "auth", status: TaskStatus.PENDING },
        { id: "3", text: "Update docs", topic: "docs", status: TaskStatus.PENDING }
      ];
      const dag = resolver.build(tasks, {});
      const sorted = dag.topologicalSort();
      // Within same topic, should be sequential
      const authTasks = sorted.flat().filter(id => ["1", "2"].includes(id));
      expect(authTasks).toEqual(["1", "2"]); // 1 before 2
    });
  });

  describe("cycle detection", () => {
    it("should detect and report cycle", () => {
      const tasks: Task[] = [
        { id: "A", text: "Fix", blockedBy: ["B"] },
        { id: "B", text: "Test", blockedBy: ["A"] }
      ];
      expect(() => resolver.build(tasks, {})).toThrow(
        /cycle.*A.*B/i
      );
    });
  });
});
```

### Day 2: Integration + Unit Tests (2 hours)

**Deliverables:**
- [ ] All Phase 1 unit tests passing (6 test suites)
- [ ] Code coverage > 80% for core modules
- [ ] Cyclomatic complexity < 3 per function

**Checkpoint:**
```bash
npm test -- --coverage core/
# Expected: task.test.ts (100%), state.test.ts (90%), dependency.test.ts (85%)
```

**File structure after Phase 1:**
```
src/
├── core/
│   ├── task.ts                 (~150 lines)
│   ├── dependency.ts           (~100 lines)
│   └── __tests__/
│       ├── task.test.ts        (~100 lines)
│       └── dependency.test.ts  (~150 lines)
├── persistence/
│   ├── state.ts                (~200 lines)
│   ├── events.ts               (~80 lines)
│   └── __tests__/
│       └── persistence.test.ts (~200 lines)
├── types.ts                    (~50 lines)
└── index.ts                    (empty, will fill in Phase 4)

Total Phase 1: ~1,030 lines + tests
```

**End-of-phase checklist:**
- [ ] All Phase 1 modules written
- [ ] TypeScript strict mode passes
- [ ] Unit tests passing (6 suites)
- [ ] Code coverage > 80%
- [ ] No lint errors
- [ ] Ready for Phase 2

---

## Phase 2: Execution Engine (Days 3-4, ~5 hours)

### Goal
Build task execution: capture from conversation, dispatch async, handle errors.

### Day 3A: Task Capture (2.5 hours)

**Deliverables:**
```
src/
├── core/
│   └── capture.ts       [NEW] TaskCapture class
├── inference/
│   ├── intent.ts        [NEW] Intent classifier
│   ├── code-analyzer.ts [NEW] Code reference extractor
│   └── context.ts       [NEW] SessionContext manager
```

**Acceptance Criteria:**
- [ ] TaskCapture class:
  - [ ] `infer(messages: Message[]): Task[]`
  - [ ] `segmentMessage(msg: string): string[]`
  - [ ] `classifyIntent(text: string): TaskIntent`
  - [ ] `extractText(segment: string): string`
  - [ ] `inferDependencies(text: string, tasks: Task[]): Task[]`
- [ ] RegexIntentClassifier (rules-based):
  - [ ] "fix" pattern: "Fix X", "Debug X", "Resolve X"
  - [ ] "refactor" pattern: "Refactor X", "Clean up X"
  - [ ] "test" pattern: "Add tests", "Test X"
  - [ ] "docs" pattern: "Document X", "Update docs"
  - [ ] "deploy" pattern: "Deploy X", "Release X"
- [ ] CodeAnalyzer:
  - [ ] Extract code references (imports, function names)
  - [ ] Match against previous tasks
- [ ] ContextManager:
  - [ ] Track conversation history
  - [ ] Provide context to dependency inference

**Code Checkpoint:**
```typescript
// src/core/capture.ts
export class TaskCapture {
  constructor(private classifier: IIntentClassifier) {}
  
  infer(messages: Message[]): Task[] {
    const tasks: Task[] = [];
    for (const msg of messages) {
      const segments = this.segmentMessage(msg.text);
      for (const segment of segments) {
        tasks.push(this.createTask(segment));
      }
    }
    return tasks;
  }
  
  private createTask(segment: string): Task {
    const intent = this.classifier.classify(segment);
    const text = this.extractText(segment);
    // ... dependencies inference
  }
}

// src/inference/intent.ts
export interface IIntentClassifier {
  classify(text: string): TaskIntent;
}

export class RegexIntentClassifier implements IIntentClassifier {
  classify(text: string): TaskIntent {
    // Pattern matching: fix, refactor, test, docs, deploy, analyze
  }
}
```

**Tests to write:**
```
tests/core/capture.test.ts (~250 lines)
  describe('TaskCapture')
    ✓ Infer single task from message
    ✓ Infer multiple tasks from compound message ("and")
    ✓ Infer multiple tasks from comma-separated list
    ✓ Segment message: "Fix X and test Y"
    ✓ Segment message: "Fix, refactor, test"
    ✓ Extract task text: strip quotes
    ✓ Extract task text: handle parenthetical info
    ✓ Classify "fix" intent: "Fix login"
    ✓ Classify "fix" intent: "Debug auth flow"
    ✓ Classify "refactor" intent: "Refactor module"
    ✓ Classify "test" intent: "Add tests"
    ✓ Classify "docs" intent: "Document API"
    ✓ Classify "deploy" intent: "Deploy to staging"
    ✓ Classify unknown intent: fallback
    ✓ Infer dependencies: explicit "after"
    ✓ Infer dependencies: code references
    ✓ Handle empty message
    ✓ Handle message with no actionable tasks
    ✓ Multi-turn conversation: accumulate tasks
    ✓ Multi-turn conversation: respect order

tests/inference/intent.test.ts (~120 lines)
  describe('RegexIntentClassifier')
    ✓ Classify fix intent (10 examples)
    ✓ Classify refactor intent (8 examples)
    ✓ Classify test intent (6 examples)
    ✓ Classify docs intent (5 examples)
    ✓ Classify deploy intent (5 examples)
    ✓ Classify analyze intent (4 examples)
    ✓ Handle ambiguous phrases
    ✓ Fallback to ANALYZE for unknown
    ✓ Case insensitive matching
    ✓ Handle punctuation

tests/inference/code-analyzer.test.ts (~100 lines)
  describe('CodeAnalyzer')
    ✓ Extract function references
    ✓ Extract file references
    ✓ Extract class references
    ✓ Match references to previous tasks
    ✓ Handle missing references gracefully
    ✓ Build implicit dependencies from refs
```

**Test file structure:**
```typescript
// tests/core/capture.test.ts
import { describe, it, expect } from "@jest/globals";
import { TaskCapture } from "../../src/core/capture";
import { RegexIntentClassifier } from "../../src/inference/intent";

describe("TaskCapture", () => {
  let capture: TaskCapture;

  beforeEach(() => {
    capture = new TaskCapture(new RegexIntentClassifier());
  });

  describe("infer", () => {
    it("should infer single task", () => {
      const tasks = capture.infer([
        { role: "user", content: "Fix the login bug" }
      ]);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toContain("login");
      expect(tasks[0].intent).toBe("FIX");
    });

    it("should infer multiple tasks with 'and'", () => {
      const tasks = capture.infer([
        { role: "user", content: "Fix login and update docs" }
      ]);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].intent).toBe("FIX");
      expect(tasks[1].intent).toBe("DOCS");
    });

    it("should infer multiple tasks from comma list", () => {
      const tasks = capture.infer([
        { role: "user", content: "Fix auth, refactor module, add tests" }
      ]);
      expect(tasks).toHaveLength(3);
      expect(tasks[0].intent).toBe("FIX");
      expect(tasks[1].intent).toBe("REFACTOR");
      expect(tasks[2].intent).toBe("TEST");
    });
  });

  describe("segment", () => {
    it("should segment compound message", () => {
      const segments = capture.segmentMessage("Fix X and test Y");
      expect(segments.length).toBeGreaterThan(1);
    });
  });

  describe("infer dependencies", () => {
    it("should infer sequential dependency", () => {
      const tasks = capture.infer([
        { role: "user", content: "Fix auth, then update docs" }
      ]);
      expect(tasks[1].blockedBy).toContain(tasks[0].id);
    });
  });
});

// tests/inference/intent.test.ts
import { describe, it, expect } from "@jest/globals";
import { RegexIntentClassifier } from "../../src/inference/intent";

describe("RegexIntentClassifier", () => {
  let classifier: RegexIntentClassifier;

  beforeEach(() => {
    classifier = new RegexIntentClassifier();
  });

  describe("classify", () => {
    it("should classify fix intent", () => {
      expect(classifier.classify("Fix the login bug")).toBe("FIX");
      expect(classifier.classify("Debug auth flow")).toBe("FIX");
      expect(classifier.classify("Resolve performance issue")).toBe("FIX");
    });

    it("should classify refactor intent", () => {
      expect(classifier.classify("Refactor the module")).toBe("REFACTOR");
      expect(classifier.classify("Clean up old code")).toBe("REFACTOR");
    });

    it("should classify test intent", () => {
      expect(classifier.classify("Add unit tests")).toBe("TEST");
      expect(classifier.classify("Test the API")).toBe("TEST");
    });

    it("should classify docs intent", () => {
      expect(classifier.classify("Document the API")).toBe("DOCS");
      expect(classifier.classify("Update README")).toBe("DOCS");
    });

    it("should classify deploy intent", () => {
      expect(classifier.classify("Deploy to staging")).toBe("DEPLOY");
      expect(classifier.classify("Release v1.0")).toBe("DEPLOY");
    });

    it("should fallback to ANALYZE", () => {
      expect(classifier.classify("Some random text")).toBe("ANALYZE");
    });
  });
});
```

### Day 3B: Executor (2.5 hours)

**Deliverables:**
```
src/
├── core/
│   └── executor.ts      [NEW] TaskExecutor class
```

**Acceptance Criteria:**
- [ ] TaskExecutor class:
  - [ ] `dispatch(dag: TaskDAG, options: ExecutorOptions): Promise<void>`
  - [ ] `on(event: string, handler)` (event emitter)
  - [ ] Error handling + retries (max 3 attempts)
  - [ ] Queue management (FIFO by execution batches)
- [ ] Integration with sub-pi:
  - [ ] `pi.exec("tsx", [...])` for simple scripts
  - [ ] Call subagent for complex tasks (agent specified)
- [ ] Event emissions:
  - [ ] `task_started(task)`
  - [ ] `task_completed(task, result)`
  - [ ] `task_failed(task, error)`
  - [ ] `task_update(task)` (for UI)
- [ ] Result handling:
  - [ ] Capture stdout, stderr, exit code
  - [ ] Store in task.result
  - [ ] Handle timeouts (30s default)

**Code Checkpoint:**
```typescript
// src/core/executor.ts
export class TaskExecutor extends EventEmitter {
  constructor(
    private store: ITaskStore,
    private pi: ExtensionAPI
  ) { super(); }
  
  async dispatch(dag: TaskDAG, options?: ExecutorOptions): Promise<void> {
    const batches = dag.topologicalSort();
    
    for (const batch of batches) {
      // Run batch in parallel (all tasks unblocked)
      const promises = batch.map(taskId => 
        this.executeTask(dag.tasks.get(taskId)!)
      );
      await Promise.all(promises);
    }
  }
  
  private async executeTask(task: Task): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date().toISOString();
    this.emit("task_started", task);
    
    try {
      const result = await this.run(task);
      task.status = TaskStatus.DONE;
      task.result = result;
    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.result = { error: error.message };
    }
    
    task.completedAt = new Date().toISOString();
    this.emit("task_update", task);
  }
}
```

**Tests to write:**
```
tests/core/executor.test.ts (~300 lines)
  describe('TaskExecutor')
    ✓ Dispatch single task
    ✓ Dispatch sequential tasks (respects blockedBy)
    ✓ Dispatch parallel tasks (batch execution)
    ✓ Execute task: success (exit code 0)
    ✓ Execute task: success with stdout
    ✓ Execute task: failure (non-zero exit code)
    ✓ Execute task: failure with stderr
    ✓ Retry on failure (max 3 attempts)
    ✓ Retry: backoff strategy (100ms, 200ms, 400ms)
    ✓ Timeout: kill task after 30s
    ✓ Timeout: emit error event
    ✓ Emit task_started event
    ✓ Emit task_completed event with result
    ✓ Emit task_failed event with error
    ✓ Emit task_update event on status change
    ✓ Store result in task.result
    ✓ Handle missing task
    ✓ Handle executor error (store not accessible)
    ✓ Parallel execution: concurrent tasks
    ✓ Parallel execution: respect batches
    ✓ Integration: execute sub-pi task
    ✓ Integration: execute shell script
    ✓ Event handler: on() and once()
    ✓ Priority queue: prioritize task
```

**Test file structure:**
```typescript
// tests/core/executor.test.ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import { TaskExecutor } from "../../src/core/executor";
import { TaskDAG, Task, TaskStatus } from "../../src/core/task";

describe("TaskExecutor", () => {
  let executor: TaskExecutor;
  let mockStore: any;
  let mockPi: any;

  beforeEach(() => {
    mockStore = {
      save: jest.fn().mockResolvedValue(void 0),
      get: jest.fn()
    };
    mockPi = {
      exec: jest.fn().mockResolvedValue({ exitCode: 0 })
    };
    executor = new TaskExecutor(mockStore, mockPi);
  });

  describe("dispatch", () => {
    it("should execute single task", async () => {
      const task: Task = {
        id: "t1",
        text: "Test task",
        status: TaskStatus.PENDING,
        blockedBy: []
      };
      const dag = new TaskDAG([task]);
      
      await executor.dispatch(dag);
      
      expect(mockPi.exec).toHaveBeenCalled();
      expect(mockStore.save).toHaveBeenCalled();
    });

    it("should execute sequential tasks in order", async () => {
      const tasks: Task[] = [
        { id: "t1", text: "First", status: TaskStatus.PENDING, blockedBy: [] },
        { id: "t2", text: "Second", status: TaskStatus.PENDING, blockedBy: ["t1"] }
      ];
      const dag = new TaskDAG(tasks);
      const execOrder: string[] = [];
      
      mockPi.exec.mockImplementation((cmd) => {
        execOrder.push(cmd);
        return Promise.resolve({ exitCode: 0 });
      });
      
      await executor.dispatch(dag);
      
      expect(execOrder[0]).toContain("t1");
      expect(execOrder[1]).toContain("t2");
    });

    it("should execute parallel tasks concurrently", async () => {
      const tasks: Task[] = [
        { id: "t1", text: "First", status: TaskStatus.PENDING, blockedBy: [] },
        { id: "t2", text: "Second", status: TaskStatus.PENDING, blockedBy: [] }
      ];
      const dag = new TaskDAG(tasks);
      
      const startTimes: number[] = [];
      mockPi.exec.mockImplementation(() => {
        startTimes.push(Date.now());
        return new Promise(r => setTimeout(() => r({ exitCode: 0 }), 100));
      });
      
      await executor.dispatch(dag);
      
      // Both should start within 10ms of each other
      expect(Math.abs(startTimes[0] - startTimes[1])).toBeLessThan(10);
    });
  });

  describe("error handling", () => {
    it("should handle task failure", async () => {
      const task: Task = {
        id: "t1",
        text: "Failing task",
        status: TaskStatus.PENDING,
        blockedBy: []
      };
      
      mockPi.exec.mockResolvedValue({ exitCode: 1, stderr: "Error" });
      
      await executor.dispatch(new TaskDAG([task]));
      
      const savedTask = mockStore.save.mock.calls[0][0];
      expect(savedTask.status).toBe(TaskStatus.FAILED);
      expect(savedTask.result.error).toBeDefined();
    });

    it("should retry failed task (max 3)", async () => {
      const task: Task = {
        id: "t1",
        text: "Flaky task",
        status: TaskStatus.PENDING,
        blockedBy: []
      };
      
      let attempts = 0;
      mockPi.exec.mockImplementation(() => {
        attempts++;
        return Promise.resolve({ 
          exitCode: attempts < 3 ? 1 : 0 
        });
      });
      
      await executor.dispatch(new TaskDAG([task]));
      
      expect(attempts).toBe(3);
    });
  });

  describe("events", () => {
    it("should emit task_started", async () => {
      const task: Task = {
        id: "t1",
        text: "Test",
        status: TaskStatus.PENDING,
        blockedBy: []
      };
      
      let emitted = false;
      executor.on("task_started", (t) => {
        if (t.id === "t1") emitted = true;
      });
      
      await executor.dispatch(new TaskDAG([task]));
      
      expect(emitted).toBe(true);
    });

    it("should emit task_completed with result", async () => {
      const task: Task = {
        id: "t1",
        text: "Test",
        status: TaskStatus.PENDING,
        blockedBy: []
      };
      
      mockPi.exec.mockResolvedValue({ exitCode: 0, stdout: "Done" });
      
      let result: any;
      executor.on("task_completed", (t, r) => {
        result = r;
      });
      
      await executor.dispatch(new TaskDAG([task]));
      
      expect(result).toEqual({ exitCode: 0, stdout: "Done" });
    });
  });
});
```

### Day 4: Integration + Tests (1 hour)

**Deliverables:**
- [ ] All Phase 2 unit tests passing
- [ ] Code coverage > 80%
- [ ] Integration test (capture + resolve + execute)

**File structure after Phase 2:**
```
src/
├── core/
│   ├── capture.ts       (~300 lines)
│   ├── executor.ts      (~250 lines)
│   └── ...
├── inference/
│   ├── intent.ts        (~80 lines)
│   ├── code-analyzer.ts (~100 lines)
│   └── context.ts       (~50 lines)
├── __tests__/
│   ├── capture.test.ts  (~200 lines)
│   ├── intent.test.ts   (~100 lines)
│   └── executor.test.ts (~250 lines)

Total Phase 2: ~1,330 lines + tests
```

**End-of-phase checklist:**
- [ ] All Phase 2 modules written
- [ ] Capture produces correct tasks from messages
- [ ] Executor dispatches and completes tasks
- [ ] Events emitted correctly
- [ ] Integration test passes (full capture → execute flow)
- [ ] Ready for Phase 3 (UI)

---

## Phase 3: User Interface (Day 5, ~3 hours)

### Goal
Build UI: notification inbox, task card, progress widget, smart filtering.

### Day 5A: Notification System (1.5 hours)

**Deliverables:**
```
src/
├── ui/
│   ├── notification-inbox.ts [NEW] NotificationInbox class
│   ├── task-card.ts          [NEW] TaskCard component
│   ├── renderer.ts           [NEW] TaskRenderer (shared)
│   └── progress-widget.ts    [NEW] ProgressWidget component
```

**Acceptance Criteria:**
- [ ] NotificationInbox class:
  - [ ] `update(tasks: Task[]): Promise<void>`
  - [ ] Smart filtering (selectNotifiable)
  - [ ] Show errors immediately (red)
  - [ ] Show completions briefly (5s flash)
  - [ ] Show long-running (>10s) with spinner
  - [ ] Hide queued/pending (not actionable)
- [ ] TaskCard component:
  - [ ] Render status icon + color
  - [ ] Show task text + elapsed time
  - [ ] Show blockers/dependencies
  - [ ] Action buttons (expand, skip, retry)
- [ ] TaskRenderer utility:
  - [ ] `statusIcon(task): string` (✓, →, ✗, ○)
  - [ ] `statusColor(task, theme): string`
  - [ ] `formatDuration(ms): string` (2m 30s)
- [ ] ProgressWidget:
  - [ ] Show summary: "3✓ 2→ 1○"
  - [ ] Update on task_update event
  - [ ] Minimal footer bar

**Code Checkpoint:**
```typescript
// src/ui/notification-inbox.ts
export class NotificationInbox implements INotifier {
  async update(tasks: Task[]): Promise<void> {
    const toNotify = this.selectNotifiable(tasks);
    if (toNotify.length === 0) {
      this.ui.setNotification("task_inbox", undefined);
      return;
    }
    
    const component = this.render(toNotify);
    this.ui.setNotification("task_inbox", component);
  }
  
  private selectNotifiable(tasks: Task[]): Task[] {
    // Only show: errors, long-running (>10s), recent completions
    return tasks.filter(t => {
      if (t.status === TaskStatus.FAILED) return true; // Always show errors
      if (t.status === TaskStatus.DONE) {
        return this.isRecentlyChanged(t); // Flash for 5s
      }
      if (t.status === TaskStatus.RUNNING) {
        const duration = Date.now() - new Date(t.startedAt!).getTime();
        return duration > 10000; // Only if >10s
      }
      return false; // Don't show pending/queued
    });
  }
}

// src/ui/renderer.ts
export class TaskRenderer {
  static statusIcon(task: Task): string {
    switch (task.status) {
      case TaskStatus.DONE: return "✓";
      case TaskStatus.RUNNING: return "→";
      case TaskStatus.FAILED: return "✗";
      case TaskStatus.SKIPPED: return "⊘";
      default: return "○";
    }
  }
}
```

**Tests to write:**
```
tests/ui.test.ts
  ✓ NotificationInbox filters errors (show)
  ✓ NotificationInbox filters pending (hide)
  ✓ NotificationInbox filters long-running (show)
  ✓ NotificationInbox filters recent completions (flash)
  ✓ TaskRenderer statusIcon
  ✓ TaskRenderer statusColor
  ✓ ProgressWidget summary
```

### Day 5B: Theme Integration (1.5 hours)

**Deliverables:**
- [ ] Integrate with pi theme system
- [ ] Handle light + dark mode
- [ ] Color mapping (success, warning, error, dim)
- [ ] Test rendering in different themes

**Code Checkpoint:**
```typescript
// src/ui/task-card.ts
export class TaskCard extends Component {
  constructor(
    private task: Task,
    private theme: Theme
  ) { super(); }
  
  render(): string {
    const icon = TaskRenderer.statusIcon(this.task);
    const color = TaskRenderer.statusColor(this.task, this.theme);
    const duration = TaskRenderer.formatDuration(
      Date.now() - new Date(this.task.startedAt!).getTime()
    );
    
    return `${color} ${this.task.text} [${duration}]`;
  }
}
```

**Tests:**
```
tests/ui-theme.test.ts
  ✓ Render with light theme
  ✓ Render with dark theme
  ✓ Color contrast adequate
```

**End-of-phase checklist:**
- [ ] NotificationInbox smart filtering works
- [ ] TaskCard renders correctly
- [ ] ProgressWidget shows summary
- [ ] Theme integration complete
- [ ] No notification spam (noise policy enforced)
- [ ] Ready for Phase 4

---

## Phase 4: Extension Integration (Day 6, ~2 hours)

### Goal
Wire everything together: hooks, tools, session lifecycle.

### Deliverables

**Acceptance Criteria:**
- [ ] Create complete `src/index.ts` (extension entry point):
  - [ ] Dependencies injected (store, capture, resolver, executor, inbox)
  - [ ] All hooks wired (agent_end, before_agent_start, etc)
  - [ ] register tool: `task_control`
  - [ ] Event handlers connected
  - [ ] Session lifecycle (start, shutdown)

**Code Checkpoint:**
```typescript
// src/index.ts
export default function (pi: ExtensionAPI) {
  const store = new TaskStore();
  const capture = new TaskCapture(new RegexIntentClassifier());
  const resolver = new DependencyResolver();
  const executor = new TaskExecutor(store, pi);
  const inbox = new NotificationInbox(pi.ui);
  
  // Hook 1: Capture tasks from agent
  pi.on("agent_end", async (event, ctx) => {
    const tasks = capture.infer(event.messages);
    if (tasks.length === 0) return;
    
    for (const task of tasks) await store.save(task);
    const dag = resolver.build(await store.getAll());
    await executor.dispatch(dag);
    ctx.ui.notify(`${tasks.length} tasks queued`, "info", { auto_close: 2000 });
  });
  
  // Hook 2: Inject context
  pi.on("before_agent_start", async (event, ctx) => {
    const pending = await store.getPending();
    const running = await store.getRunning();
    if (pending.length + running.length === 0) return;
    
    const info = `\n### Active Tasks\n- Running: ${running.map(t => t.text).join(", ")}\n- Pending: ${pending.map(t => t.text).join(", ")}`;
    return { systemPrompt: event.systemPrompt + info };
  });
  
  // Hook 3: Stream updates
  executor.on("task_update", async (task) => {
    await store.save(task);
    await inbox.update(await store.getAll());
  });
  
  // Hook 4: Persistent widget
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    
    const updateWidget = async () => {
      const tasks = await store.getAll();
      const summary = `${tasks.filter(t => t.status === TaskStatus.DONE).length}✓ ` +
        `${tasks.filter(t => t.status === TaskStatus.RUNNING).length}→ ` +
        `${tasks.filter(t => t.status === TaskStatus.PENDING).length}○`;
      
      ctx.ui.setWidget("task_progress", 
        new Text(`Tasks: ${summary}`, 0, 0)
      );
    };
    
    await updateWidget();
    executor.on("task_update", updateWidget);
  });
  
  // Hook 5: User control tool
  pi.registerTool("task_control", {
    description: "Skip, retry, or prioritize a task",
    parameters: Type.Object({
      taskId: Type.String(),
      action: StringEnum(["skip", "retry", "prioritize"])
    }),
    async execute(_id, params) {
      const task = await store.get(params.taskId);
      if (!task) return { error: "Task not found" };
      
      if (params.action === "skip") {
        task.status = TaskStatus.SKIPPED;
      } else if (params.action === "retry") {
        task.status = TaskStatus.PENDING;
        const dag = resolver.build(await store.getAll());
        await executor.dispatch(dag);
      } else if (params.action === "prioritize") {
        await executor.prioritize(params.taskId);
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

**Tests to write:**
```
tests/integration.test.ts
  ✓ agent_end hook captures tasks
  ✓ before_agent_start hook injects context
  ✓ task_update events propagate
  ✓ task_control tool works
  ✓ Full flow: message → capture → execute → notify

tests/e2e.test.ts
  ✓ Multi-turn conversation with multiple tasks
  ✓ Dependencies respected across turns
  ✓ Session persistence
```

**File structure after Phase 4:**
```
src/
├── index.ts             (~150 lines) COMPLETE EXTENSION

hooks/
├── agent-end.ts         [can extract from index.ts]
├── before-agent-start.ts [can extract from index.ts]
└── session-lifecycle.ts [can extract from index.ts]

tools/
└── task-control.ts      [can extract from index.ts]

Total Phase 4: ~150 lines (in index.ts), rest already done
```

**Checklist:**
- [ ] All hooks firing correctly
- [ ] task_control tool working
- [ ] Events propagating
- [ ] Integration tests passing
- [ ] Ready for Phase 5

---

## Phase 5: Documentation + Polish (Day 7, ~2 hours)

### Goal
Documentation, migration guide, performance optimization, code review.

### Deliverables

**1. Documentation Files:**
```
docs/
├── USAGE.md             [NEW] How agents use (not users)
├── ARCHITECTURE.md      [NEW] Design decisions + diagrams
└── MIGRATION.md         [NEW] From v1 to v2
```

**USAGE.md Contents:**
- [ ] Zero-config, automatic task detection
- [ ] Examples (Fix + docs, Refactor + test + deploy)
- [ ] How dependencies are inferred
- [ ] Error handling + retries
- [ ] Event log for debugging
- [ ] Common patterns + edge cases

**ARCHITECTURE.md Contents:**
- [ ] Module responsibilities
- [ ] Data flow diagrams
- [ ] Dependency injection pattern
- [ ] State management strategy
- [ ] Extension hooks
- [ ] Testing strategy

**MIGRATION.md Contents:**
- [ ] What changed from v1
- [ ] Backward compatibility notes
- [ ] Deprecation timeline (if any)
- [ ] How old /todo tasks are handled

**2. README.md Update:**
- [ ] Add task-orchestration to extension list
- [ ] Link to documentation
- [ ] "Zero-config task management" tagline

**3. Code Quality:**
- [ ] Lint check: `npm run lint`
- [ ] Format: `npm run format`
- [ ] Type check: `tsc --noEmit`
- [ ] Test coverage: `npm test -- --coverage`
- [ ] Remove any console.debug (keep only warnings/errors)

**4. Performance Optimization:**
- [ ] Task lookup: O(1) via Map
- [ ] DAG resolution: O(V + E) topological sort
- [ ] Notification filtering: O(n) single pass
- [ ] State persistence: async, non-blocking
- [ ] No unnecessary re-renders

**5. File Cleanup:**
- [ ] Delete old: `btw-task/`, `todo/`, `plan-tracker/`
- [ ] Update `core-tools/index.ts`:
  - Remove: `import btwTask from "./btw-task/..."`
  - Remove: `import todo from "./todo/..."`
  - Remove: `import planTracker from "./plan-tracker/..."`
  - Add: `import taskOrchestration from "./task-orchestration/..."`
  - Remove: `btwTask(pi)`, `todo(pi)`, `planTracker(pi)`
  - Add: `taskOrchestration(pi)`

**Checklist:**
- [ ] All documentation written
- [ ] README.md updated
- [ ] Lint + format passed
- [ ] Type check passed
- [ ] Test coverage > 80%
- [ ] Old extensions deleted
- [ ] core-tools/index.ts updated
- [ ] Code review completed
- [ ] Ready for merge

---

## Daily Breakdown

### Day 1: Task Model + State (4 hours)

**Morning (2h):**
- 8:00-8:30: Read v2 spec
- 8:30-9:30: Implement `src/core/task.ts` (Task, TaskStatus, TaskIntent, TaskDAG, TaskResult)
- 9:30-10:00: Write `tests/task.test.ts` (4 tests)

**Afternoon (2h):**
- 14:00-15:00: Implement `src/persistence/state.ts` (TaskStore)
- 15:00-16:00: Write `tests/persistence.test.ts` (5 tests)

**Checkpoint:**
```bash
npm test -- task persistence
# Expected: 9/9 tests passing
```

---

### Day 2: Dependency Resolution (4 hours)

**Morning (2h):**
- 8:00-9:00: Implement `src/core/dependency.ts` (DependencyResolver)
- 9:00-10:00: Write `tests/dependency.test.ts` (6 tests)

**Afternoon (2h):**
- 14:00-15:00: Implement `src/types.ts` (shared types)
- 15:00-16:00: Integration test (task + state + dependency)

**Checkpoint:**
```bash
npm test -- core persistence
npm run lint
tsc --noEmit
# Expected: All passing, ~80% coverage
```

**Deliverable:** Phase 1 complete, ready for Phase 2

---

### Day 3: Task Capture + Intent (4 hours)

**Morning (2h):**
- 8:00-9:00: Implement `src/inference/intent.ts` (RegexIntentClassifier)
- 9:00-10:00: Implement `src/core/capture.ts` (TaskCapture)

**Afternoon (2h):**
- 14:00-15:00: Write `tests/capture.test.ts` + `tests/intent.test.ts` (10 tests)
- 15:00-16:00: Implement `src/inference/code-analyzer.ts`, `context.ts`

**Checkpoint:**
```bash
npm test -- capture intent
# Expected: 10/10 tests passing
```

---

### Day 4: Task Executor (4 hours)

**Morning (2h):**
- 8:00-9:00: Implement `src/core/executor.ts` (TaskExecutor)
- 9:00-10:00: Write `tests/executor.test.ts` (8 tests)

**Afternoon (2h):**
- 14:00-15:00: Integration test (capture → resolve → execute)
- 15:00-16:00: Error handling + retries + timeouts

**Checkpoint:**
```bash
npm test -- executor
npm test -- __tests__/integration.test.ts
# Expected: All Phase 2 tests passing
```

**Deliverable:** Phase 2 complete, ready for UI

---

### Day 5: UI + Notifications (4 hours)

**Morning (2h):**
- 8:00-9:00: Implement `src/ui/renderer.ts` + `src/ui/notification-inbox.ts`
- 9:00-10:00: Write `tests/ui.test.ts` (7 tests)

**Afternoon (2h):**
- 14:00-15:00: Implement `src/ui/task-card.ts` + `src/ui/progress-widget.ts`
- 15:00-16:00: Theme integration + tests

**Checkpoint:**
```bash
npm test -- ui
# Expected: UI tests passing, no notification spam in manual test
```

**Deliverable:** Phase 3 complete, ready for integration

---

### Day 6: Extension Integration (3 hours)

**Morning (1.5h):**
- 8:00-8:30: Set up `src/index.ts` scaffolding
- 8:30-9:00: Wire agent_end hook
- 9:00-9:30: Wire before_agent_start hook

**Afternoon (1.5h):**
- 14:00-14:30: Wire executor events + UI updates
- 14:30-15:00: Implement task_control tool
- 15:00-15:30: Session lifecycle hooks

**Checkpoint:**
```bash
npm test -- integration e2e
# Expected: All hooks firing, tool working
```

**Deliverable:** Phase 4 complete, functional extension

---

### Day 7: Documentation + Cleanup (4 hours)

**Morning (2h):**
- 8:00-9:00: Write `USAGE.md`, `ARCHITECTURE.md`, `MIGRATION.md`
- 9:00-10:00: Update `README.md`

**Afternoon (2h):**
- 14:00-15:00: Delete old extensions, update `core-tools/index.ts`
- 15:00-15:30: Final lint, format, type check
- 15:30-16:00: Code review + merge prep

**Final Checklist:**
```bash
npm run lint
npm run format
tsc --noEmit
npm test -- --coverage
git diff --stat
# Expected: All passing, 99 files deleted, 18 files added
```

**Deliverable:** Phase 5 complete, ready for merge

---

## Testing Checklist

### Unit Tests (6 suites, >80% coverage)

```
tests/
├── task.test.ts              (100 lines, 4 tests)
├── persistence.test.ts       (200 lines, 5 tests)
├── dependency.test.ts        (150 lines, 6 tests)
├── capture.test.ts           (200 lines, 8 tests)
├── intent.test.ts            (100 lines, 4 tests)
├── executor.test.ts          (250 lines, 8 tests)
├── ui.test.ts                (150 lines, 7 tests)
├── ui-theme.test.ts          (80 lines, 3 tests)
├── integration.test.ts       (300 lines, 5 tests)
└── e2e.test.ts               (400 lines, 8 tests)

Total: ~1,930 lines of tests, 58+ test cases
```

### Test Coverage Targets

```
File                  Coverage Target
────────────────────────────────────
src/core/task.ts            100%
src/core/capture.ts         85%
src/core/dependency.ts      90%
src/core/executor.ts        80%
src/inference/intent.ts     90%
src/persistence/state.ts    85%
src/ui/renderer.ts          100%
src/ui/notification-inbox.ts 80%

Overall: >80%
```

### Manual Testing

```
Session 1: Single task
  User: "Fix the login bug"
  ✓ Task captured
  ✓ Executor started
  ✓ Notification shown
  ✓ Task completed

Session 2: Multi-task with dependencies
  User: "Fix auth and update docs"
  ✓ 2 tasks captured
  ✓ Dependency inferred (docs depends on fix)
  ✓ Sequential execution
  ✓ Both tasks completed

Session 3: Task failure + retry
  User: "Deploy to staging"
  ✓ Task starts
  ✓ Task fails
  ✓ Error notification shown
  ✓ User clicks retry
  ✓ Task re-queued and completes

Session 4: Async execution
  User: "Refactor module, add tests, deploy"
  ✓ 3 tasks captured in background
  ✓ User can continue typing
  ✓ Notifications appear as tasks complete
  ✓ No blocking on execution
```

---

## File Structure: Final

```
core-tools/task-orchestration/
├── src/
│   ├── core/
│   │   ├── task.ts           (~150 lines)
│   │   ├── capture.ts        (~300 lines)
│   │   ├── dependency.ts     (~100 lines)
│   │   └── executor.ts       (~250 lines)
│   │
│   ├── inference/
│   │   ├── intent.ts         (~80 lines)
│   │   ├── code-analyzer.ts  (~100 lines)
│   │   └── context.ts        (~50 lines)
│   │
│   ├── ui/
│   │   ├── notification-inbox.ts (~200 lines)
│   │   ├── task-card.ts      (~100 lines)
│   │   ├── progress-widget.ts (~80 lines)
│   │   └── renderer.ts       (~100 lines)
│   │
│   ├── persistence/
│   │   ├── state.ts          (~200 lines)
│   │   └── events.ts         (~80 lines)
│   │
│   ├── hooks/
│   │   ├── agent-end.ts      (~50 lines)
│   │   ├── before-agent-start.ts (~30 lines)
│   │   └── session-lifecycle.ts (~30 lines)
│   │
│   ├── tools/
│   │   └── task-control.ts   (~40 lines)
│   │
│   ├── types.ts              (~50 lines)
│   └── index.ts              (~150 lines)
│
├── tests/
│   ├── task.test.ts          (~100 lines)
│   ├── persistence.test.ts   (~200 lines)
│   ├── dependency.test.ts    (~150 lines)
│   ├── capture.test.ts       (~200 lines)
│   ├── intent.test.ts        (~100 lines)
│   ├── executor.test.ts      (~250 lines)
│   ├── ui.test.ts            (~150 lines)
│   ├── ui-theme.test.ts      (~80 lines)
│   ├── integration.test.ts   (~300 lines)
│   └── e2e.test.ts           (~400 lines)
│
├── docs/
│   ├── USAGE.md              (~500 words)
│   ├── ARCHITECTURE.md       (~800 words)
│   └── MIGRATION.md          (~300 words)
│
├── README.md
├── package.json
├── tsconfig.json
└── jest.config.js

Files Deleted:
  ✗ core-tools/btw-task/       (8 files)
  ✗ core-tools/todo/           (10 files)
  ✗ core-tools/plan-tracker/   (3 files)

Files Modified:
  ↔ core-tools/index.ts        (remove 3 imports, add 1)

Total Code: ~2,000 lines (main) + ~1,930 lines (tests) = ~3,930 lines
```

---

## Success Criteria: Final Validation

### Functional
- [ ] Agent automatically captures tasks from conversation
- [ ] Dependencies inferred correctly (90%+ accuracy on test cases)
- [ ] Tasks execute async (non-blocking)
- [ ] All execution batches complete
- [ ] Notifications shown for errors/long-running/completion only
- [ ] No notification spam (max 1 per task)
- [ ] task_control tool works (skip/retry/prioritize)
- [ ] Session persistence works (tasks survive reopen)

### Code Quality
- [ ] All tests passing (58+ test cases)
- [ ] Code coverage > 80%
- [ ] Cyclomatic complexity < 3 per function
- [ ] SOLID principles applied (dependency injection, segregation)
- [ ] DRY: No duplicate code (shared model, shared renderer)
- [ ] No linting errors
- [ ] TypeScript strict mode passes

### User Experience
- [ ] Zero commands needed for normal flow
- [ ] 1 tool (task_control) for overrides
- [ ] Notification inbox clean + non-intrusive
- [ ] Footer progress bar always visible
- [ ] Works with existing pi extensions (memory, subagent, etc)

### Documentation
- [ ] USAGE.md explains implicit task detection
- [ ] ARCHITECTURE.md documents design decisions
- [ ] MIGRATION.md guides users from v1
- [ ] README.md highlights "zero-config"
- [ ] Code comments explain complex logic

### Metrics
- [ ] ~2,000 lines of code (target: <2,500)
- [ ] 18 modules (vs 99 files before)
- [ ] 1 task model (vs 3 before)
- [ ] 1 notification system (vs 2 overlapping widgets)
- [ ] ~18 hours effort (actual vs estimate)

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| Task capture too noisy (false positives) | Filter: only action verbs + objects | Day 3 testing |
| Dependencies inferred incorrectly | Unit test with 20+ examples | Day 3 testing |
| Async execution too complex | Start with simple sub-pi, extend later | Day 4 |
| Notification spam | "No noise" policy enforced in tests | Day 5 testing |
| Session persistence breaks | Branch-replay reconstruction tested | Day 2 testing |
| Performance issues (many tasks) | Lazy render, indexed lookups | Day 7 optimization |
| Backward compatibility (old /todo calls) | Compat layer (optional, not required for v2) | Future |

---

## Communication Plan

### Daily Standup (5 min)
- What completed yesterday
- What's today's focus
- Blockers

### Daily Checkpoint (EOD)
- Tests passing: `npm test -- --coverage`
- Code quality: `npm run lint`
- Ready for next phase

### End-of-phase (Monday mornings)
- Full code review
- Merge to main branch
- Kickoff next phase

---

## Appendix: Code Templates

### Template 1: New Module Structure

```typescript
// src/core/my-module.ts

import type { Task, TaskStatus } from "../types";

export interface MyModuleConfig {
  // Configuration
}

export class MyModule {
  constructor(config?: MyModuleConfig) {}
  
  public async myMethod(): Promise<void> {
    // Implementation
  }
  
  private validateInput(): boolean {
    // Validation
    return true;
  }
}
```

### Template 2: Test Structure

```typescript
// tests/my-module.test.ts

import { describe, it, expect, beforeEach } from "@jest/globals";
import { MyModule } from "../src/core/my-module";

describe("MyModule", () => {
  let module: MyModule;
  
  beforeEach(() => {
    module = new MyModule();
  });
  
  it("should do something", async () => {
    const result = await module.myMethod();
    expect(result).toBeDefined();
  });
});
```

### Template 3: Extension Hook

```typescript
// In src/index.ts

pi.on("agent_end", async (event, ctx) => {
  // Your logic here
  ctx.ui.notify("Message", "info");
});
```

---

## Timeline Summary

```
Week 1:
  Mon 5/3: Phase 1 (Core)          6h ✓ (Days 1-2)
  Tue 5/4: Phase 2 (Execution)     5h ✓ (Days 3-4)
  Wed 5/5: Phase 3 (UI)            3h ✓ (Day 5)
  Thu 5/6: Phase 4 (Integration)   2h ✓ (Day 6)
  Fri 5/7: Phase 5 (Polish)        2h ✓ (Day 7)
           ────────────────────────────
           TOTAL:                  18h

Milestones:
  Fri 5/3: Phase 1 complete (core model + state)
  Tue 5/4: Phase 2 complete (task capture + execution)
  Wed 5/5: Phase 3 complete (UI + notifications)
  Thu 5/6: Phase 4 complete (extension wired)
  Fri 5/7: Ready for merge (all tests passing)
```

---

## Conclusion

This implementation plan is:
- ✅ **Detailed:** Daily breakdown with specific files + line counts
- ✅ **Testable:** 58+ test cases with coverage targets
- ✅ **Realistic:** 18 hours estimated, broken into 5 phases
- ✅ **Actionable:** Copy-paste code templates, clear acceptance criteria
- ✅ **Safe:** Risk mitigation, daily checkpoints, phase gates

**Next step:** Start Day 1 with `src/core/task.ts`

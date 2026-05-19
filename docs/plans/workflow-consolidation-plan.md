# Workflow Consolidation Implementation Plan

## Objective

Consolidate the current task planning and subprocess orchestration systems into one unified feature:

```text
core-tools/workflow/
```

Then remove the old modules:

```text
core-tools/task-plan/
core-tools/subprocess-orchestrator/
```

The new feature should provide a single user-facing workflow system for:

- task and plan management
- executable checklist steps
- subprocess execution
- background jobs
- review queues
- migration from old task data
- persistent checklist UI while work is active

The desired UX is checklist-first, not JSON-first.

---

## Product Requirements

### User-facing concept

A **workflow** is a checklist of steps. Some steps are manual, some are executable commands, and some can run in background.

### Checklist visibility rule

The checklist UI must always display while work is active so the user can track progress.

It should hide only when all active workflow steps are completed or skipped.

### Example UI

```text
📋 Workflow: Consolidate task-plan and subprocess-orchestrator
Progress: 3/8

✅ 1. Analyze existing modules
✅ 2. Design unified data model
🔄 3. Implement workflow runner
⏳ 4. Add checklist UI
⏳ 5. Add migration
⏳ 6. Add compatibility adapters
⏳ 7. Remove old modules
⏳ 8. Run tests and commit
```

### High-level behavior

- Normal workflow actions should return human-readable checklist output.
- Raw JSON should be reserved for `details`, debugging, or explicit machine-readable actions.
- The active checklist should be injected into session context before each agent run.
- UI status should show compact progress while a workflow is active.

---

## Current Problems

### `core-tools/task-plan/`

Currently owns:

- task store
- task capture
- plan steps
- review mode
- task execution
- active plan context injection
- `/task`, `/tasks`, `/plan` commands
- `task` tool

Problems:

- Tool output is often raw JSON.
- Execution is limited and separate from subprocess orchestration.
- Active progress is not presented as a persistent checklist UI.

### `core-tools/subprocess-orchestrator/`

Currently owns:

- subprocess execution
- chains
- loops
- background jobs
- `pi` subprocess spawning
- `subprocess` tool

Problems:

- It overlaps with task execution.
- Plan execution is not integrated.
- It has a different mental model from task-plan.
- It does not own user-visible workflow progress.

### Consolidation rationale

These two systems are really one system split in two:

- `task-plan` knows **what** should happen.
- `subprocess-orchestrator` knows **how** to run it.

The new `workflow` feature should own both.

---

## Target Package Layout

```text
core-tools/workflow/
├── index.ts              # Extension lifecycle and registration
├── tool.ts               # workflow tool actions
├── commands.ts           # /workflow, /plan, /tasks commands
├── types.ts              # Unified workflow/task/job types
├── store.ts              # Persistent workflow and job store
├── executor.ts           # Subprocess command execution
├── runner.ts             # Workflow and step runner
├── ui.ts                 # Checklist rendering and status formatting
├── migration.ts          # Migration from .pi/tasks to .pi/workflows
├── compatibility.ts      # Optional old task/subprocess adapters
├── README.md             # User/developer docs
├── store.test.ts
├── executor.test.ts
├── runner.test.ts
├── ui.test.ts
├── migration.test.ts
└── tool.test.ts
```

---

## Phase 1: Create New Package Skeleton

### Tasks

1. Create `core-tools/workflow/`.
2. Add empty module files.
3. Add initial tests for each module.
4. Do not remove old packages yet.

### Acceptance criteria

- `core-tools/workflow/` exists.
- Tests can discover workflow test files.
- No existing behavior is changed yet.

---

## Phase 2: Define Unified Types

Create `core-tools/workflow/types.ts`.

### Core types

```ts
export type WorkflowStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "archived";

export type StepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "blocked";

export type StepExecutor = "none" | "manual" | "shell" | "pi";

export interface Workflow {
  id: string;
  title: string;
  description?: string;
  status: WorkflowStatus;
  priority: "low" | "normal" | "high";
  source: "manual" | "auto" | "migrated";
  requiresReview?: boolean;
  assignedToSession?: string;
  intent?: string;
  steps: WorkflowStep[];
  currentStepId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkflowStep {
  id: string;
  text: string;
  status: StepStatus;
  executor: StepExecutor;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  retries?: number;
  critical?: boolean;
  dependsOn?: string[];
  startedAt?: string;
  completedAt?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface WorkflowJob {
  id: string;
  workflowId?: string;
  stepId?: string;
  label: string;
  command: string;
  args?: string[];
  cwd?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "timeout";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration?: number;
}
```

### Acceptance criteria

- Types compile.
- Type tests cover status values and basic construction.

---

## Phase 3: Implement Workflow Store

Create `core-tools/workflow/store.ts`.

### Storage path

```text
.pi/workflows/
├── workflows.jsonl
├── jobs.jsonl
├── events.jsonl
└── locks/
```

### Store API

```ts
class WorkflowStore {
  init(): Promise<void>;

  list(): Promise<Workflow[]>;
  get(id: string): Promise<Workflow | null>;
  save(workflow: Workflow): Promise<void>;
  delete(id: string): Promise<boolean>;

  search(query: WorkflowSearch): Promise<Workflow[]>;

  addStep(workflowId: string, step: WorkflowStep): Promise<Workflow>;
  updateStep(workflowId: string, stepId: string, patch: Partial<WorkflowStep>): Promise<Workflow>;

  listJobs(): Promise<WorkflowJob[]>;
  getJob(id: string): Promise<WorkflowJob | null>;
  saveJob(job: WorkflowJob): Promise<void>;

  appendEvent(event: WorkflowEvent): Promise<void>;
}
```

### Store behavior

- Use append-safe persistence where possible.
- Preserve old records when updating.
- Provide deterministic ordering by creation time.
- Support searching by status, title, source, review flag, and session assignment.

### Tests

- create workflow
- update workflow
- delete workflow
- add step
- update step
- persist and reload
- list active workflows
- list jobs

---

## Phase 4: Implement Executor

Create `core-tools/workflow/executor.ts`.

This replaces subprocess execution from `subprocess-orchestrator`.

### Executor API

```ts
class WorkflowExecutor {
  runCommand(task: CommandTask): Promise<CommandResult>;
  runBackground(task: CommandTask): Promise<WorkflowJob>;
  getJob(id: string): Promise<WorkflowJob | null>;
  cancelJob(id: string): Promise<boolean>;
}
```

### Required behavior

- real command execution via `node:child_process.spawn`
- stdout capture
- stderr capture
- exit code capture
- cwd support
- env support
- timeout and process kill
- retry support
- background job lifecycle
- cancellation
- structured command result

### Tests

- command success
- command failure
- stdout/stderr capture
- cwd support
- env support
- timeout
- retry
- background job status
- cancellation

---

## Phase 5: Implement Workflow Runner

Create `core-tools/workflow/runner.ts`.

The runner connects workflows, steps, store, and executor.

### Runner API

```ts
class WorkflowRunner {
  runWorkflow(id: string): Promise<WorkflowRunResult>;
  runStep(workflowId: string, stepId: string): Promise<StepRunResult>;
  retryStep(workflowId: string, stepId: string): Promise<StepRunResult>;
  skipStep(workflowId: string, stepId: string): Promise<Workflow>;
  completeStep(workflowId: string, stepId: string): Promise<Workflow>;
}
```

### Step execution rules

#### `executor: "shell"`

Run the command through `WorkflowExecutor`.

Store on the step:

- stdout
- stderr
- exit code-derived status
- startedAt
- completedAt
- error if failed

#### `executor: "manual"`

Mark step as `in_progress` and keep checklist visible until explicitly completed.

#### `executor: "none"`

Checklist-only step. It should not run automatically.

#### `executor: "pi"`

Spawn a `pi` subprocess using step text as prompt or a dedicated prompt field if added later.

### Workflow completion rules

After each step:

- if all steps are completed or skipped, mark workflow `completed`
- if a critical step fails, mark workflow `failed`
- otherwise advance `currentStepId` to next pending step

### Tests

- run one shell step
- run multiple shell steps
- critical failure stops workflow
- non-critical failure keeps workflow visible
- manual step becomes in progress
- completed workflow hides checklist

---

## Phase 6: Build Checklist UI

Create `core-tools/workflow/ui.ts`.

### UI API

```ts
renderChecklist(workflow: Workflow): string;
renderCompactStatus(workflow: Workflow): string;
renderWorkflowSummary(workflows: Workflow[]): string;
shouldShowChecklist(workflow: Workflow): boolean;
```

### Visibility rules

Show checklist if:

- workflow status is `active`, `paused`, or `failed`
- any step is `pending`, `in_progress`, `failed`, or `blocked`
- workflow requires review

Hide checklist if:

- workflow status is `completed`, `archived`, or `cancelled`
- all steps are `completed` or `skipped`

### Icons

```text
completed   ✅
in_progress 🔄
pending     ⏳
failed      ❌
skipped     ⏭️
blocked     🚧
```

### Tests

- active checklist renders
- failed step renders
- completed workflow hides
- compact status renders
- multiple workflows summarize correctly

---

## Phase 7: Implement Workflow Tool

Create `core-tools/workflow/tool.ts`.

### Tool name

```text
workflow
```

### Actions

```ts
type WorkflowAction =
  | "list"
  | "get"
  | "create"
  | "update"
  | "delete"
  | "activate"
  | "pause"
  | "resume"
  | "archive"
  | "add-step"
  | "update-step"
  | "complete-step"
  | "skip-step"
  | "next-step"
  | "run-step"
  | "run"
  | "run-command"
  | "run-bg"
  | "job-list"
  | "job-status"
  | "job-cancel"
  | "review"
  | "search"
  | "dedupe";
```

### Output rule

Any action that changes workflow state should return checklist-first text:

```ts
{
  content: [
    {
      type: "text",
      text: renderChecklist(workflow)
    }
  ],
  details: {
    workflow,
    nextStep
  }
}
```

### Validation rules

- `create` requires title or text
- `get/update/delete/activate/pause/resume/archive` require workflow id
- step actions require workflow id and step id
- `run-command` requires cmd
- `run-bg` requires cmd
- job actions require job id

### Tests

- create workflow
- list workflows
- add step
- complete step
- run step
- run command
- start background job
- checklist output is not raw JSON

---

## Phase 8: Implement Commands

Create `core-tools/workflow/commands.ts`.

### Commands

```text
/workflow
/workflow current
/workflow list
/workflow run
/workflow review

/plan
/plan current
/plan run
/plan list

/tasks
/tasks review
```

### Behavior

- `/workflow current` shows active checklist
- `/workflow run` runs active workflow
- `/plan current` aliases `/workflow current`
- `/tasks` aliases workflow list summary
- `/tasks review` shows review queue

### Acceptance criteria

- Commands produce checklist/summary UI, not JSON dumps.

---

## Phase 9: Persistent Checklist Lifecycle

Create lifecycle behavior in `workflow/index.ts`.

### `onSessionStart`

- Initialize store.
- Run migration if needed.
- Register tool and commands.
- Load active workflow.
- Set compact UI status if active workflow exists.

### `onBeforeAgentStart`

Inject active checklist into context:

```md
### Active Workflow

📋 Workflow: ...
Progress: ...
...
```

### `onAgentEnd`

- Refresh active workflow.
- Re-render compact status.
- Notify when workflow completes or fails.

### `onSessionShutdown`

- Persist any active jobs/workflows.
- Warn if active work remains.

### Acceptance criteria

- Active checklist appears before each agent run.
- Checklist remains visible while unfinished.
- Checklist hides when workflow is complete.

---

## Phase 10: Migrate Old Task Data

Create `core-tools/workflow/migration.ts`.

### Input

```text
.pi/tasks
```

### Output

```text
.pi/workflows
```

### Mapping

Old task with steps:

```text
Task -> Workflow
Step -> WorkflowStep
```

Old task without steps:

```text
Task -> Workflow with one manual step
```

Preserve:

- id
- title/text
- status
- priority
- source
- requiresReview
- assignedToSession
- currentStepId
- createdAt

Map old step `done: true` to `status: "completed"`.

### Migration marker

Write:

```text
.pi/workflows/migration.json
```

so migration only runs once.

### Tests

- migrate task with steps
- migrate task without steps
- migration is idempotent
- statuses map correctly

---

## Phase 11: Compatibility Adapters

Create `core-tools/workflow/compatibility.ts`.

Adapters are optional but recommended during transition.

### `task` adapter

Map old actions:

```text
task list              -> workflow list
task create            -> workflow create
task complete-step     -> workflow complete-step
task current-plan      -> workflow get active
task next-step         -> workflow next-step
task execute           -> workflow run-step or workflow run
```

### `subprocess` adapter

Map old actions:

```text
subprocess single      -> workflow run-command
subprocess bg          -> workflow run-bg
subprocess list        -> workflow job-list
subprocess status      -> workflow job-status
subprocess cancel      -> workflow job-cancel
subprocess chain       -> workflow direct sequential execution or create temporary workflow
```

### Policy decision

If compatibility aliases are kept, they should live inside `workflow/`, not in the old package directories.

---

## Phase 12: Register Workflow Extension

Create `core-tools/workflow/index.ts`.

Register:

- `workflow` tool
- commands
- lifecycle hooks
- migration
- persistent checklist context

Then update `core-tools/index.ts`.

Replace:

```ts
import taskPlan from "./task-plan/index.ts";
import subprocessOrchestrator from "./subprocess-orchestrator/index.ts";
```

with:

```ts
import workflow from "./workflow/index.ts";
```

Replace:

```ts
taskPlan(pi);
subprocessOrchestrator(pi);
```

with:

```ts
workflow(pi);
```

Update telemetry metadata:

```ts
tools: ["workflow", "commit_message", ...]
```

---

## Phase 13: Remove Old Modules

After workflow passes tests and migration is validated, delete:

```text
core-tools/task-plan/
core-tools/subprocess-orchestrator/
```

Then remove stale imports and references.

Search for old references:

```text
task-plan
subprocess-orchestrator
createTaskPlanTool
SubprocessExecutor
```

Update tests and docs accordingly.

---

## Phase 14: Documentation

Create `core-tools/workflow/README.md`.

Recommended sections:

```md
# workflow

## Overview
## Features
## Checklist UI
## Tool Actions
## Commands
## Examples
## Migration
## Development
```

Include examples for:

- creating a workflow
- adding steps
- running a workflow
- running one command
- running a background command
- checking job status

---

## Phase 15: Test Suite

Run targeted tests:

```sh
bun test core-tools/workflow
```

Run full repo tests:

```sh
npm test -- --test-reporter=spec
```

Minimum required coverage:

- store tests
- executor tests
- runner tests
- UI rendering tests
- migration tests
- tool tests
- compatibility tests if adapters are kept
- full repo test pass

---

## Phase 16: Commit Strategy

Recommended commit sequence:

```text
feat(workflow): add unified workflow model and store
feat(workflow): add executor and runner
feat(workflow): add persistent checklist UI
feat(workflow): add workflow tool and commands
feat(workflow): migrate legacy task data
refactor(core-tools): replace task-plan and subprocess with workflow
test(workflow): cover workflow consolidation
docs(workflow): document unified workflow feature
```

If using a single final commit:

```text
refactor(workflow): consolidate task planning and subprocess orchestration
```

---

## Final Success Criteria

The project is done when:

- `core-tools/workflow/` exists and owns planning plus execution.
- `workflow` tool replaces normal `task` and `subprocess` usage.
- Active workflows render as checklists, not raw JSON.
- Checklist remains visible while work is active.
- Checklist hides automatically when all steps are done.
- Shell commands execute through workflow steps.
- Background jobs are tracked through workflow.
- Old `.pi/tasks` data migrates to `.pi/workflows`.
- `core-tools/task-plan/` is removed.
- `core-tools/subprocess-orchestrator/` is removed.
- Full test suite passes.
- No stale imports reference old modules.

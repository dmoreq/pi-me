# Task & Plan Implementation Plan

Date: 2026-05-18
Status: Ready for implementation
Scope: `core-tools/task-plan/`, shared lifecycle hooks, task-plan tests, README/docs updates

## Goals

Build on the active unified `task-plan` backend and restore the best UX from the legacy planning system without reactivating duplicate tools.

Primary outcomes:

1. Fix context injection so pending tasks and review reminders reach the agent.
2. Make the `task` tool schema match actual behavior.
3. Restore rich task/plan UI around the unified store.
4. Improve auto-capture accuracy and review safety.
5. Strengthen persistence, locking, audit logging, and tests.
6. Keep test coverage high and make one conventional commit after each implementation step.

## Ground rules

- Use TDD for every behavior change.
- For each step:
  1. Write or update tests first.
  2. Run the focused test and confirm it fails for the expected reason.
  3. Implement the minimal code.
  4. Run focused tests until green.
  5. Run the broader relevant suite.
  6. Commit with a conventional commit message.
- Do not stage unrelated existing changes. Current known pre-existing change to leave untouched unless intentionally included:
  - `core-tools/task-plan/src/index.ts`
- Prefer small commits over broad commits.
- Legacy `core-tools/planning/` has been removed after migrating active behavior into task-plan.

## Current architecture summary

Active extension path:

```txt
package.json
└── core-tools/index.ts
    └── core-tools/task-plan/index.ts
        └── core-tools/task-plan/src/index.ts
```

Active registered user surface:

- Tool: `task`
- Commands: `/tasks`, `/tasks-review`, `/task <description>`

Legacy planning assets migrated and removed:

- `core-tools/planning/plan-mode.ts`
- `core-tools/planning/plan-mode-core.ts`

Important active files:

- `shared/lifecycle.ts`
- `core-tools/task-plan/src/index.ts`
- `core-tools/task-plan/src/tool.ts`
- `core-tools/task-plan/src/store.ts`
- `core-tools/task-plan/src/executor.ts`
- `core-tools/task-plan/src/capture.ts`
- `core-tools/task-plan/src/types.ts`
- `core-tools/task-plan/src/*.test.ts`

---

## Step 1 — Register `before_agent_start` lifecycle hook

### Problem

`TaskPlanExtension` defines `onBeforeAgentStart`, but `ExtensionLifecycle` does not register that hook. The active-task context injection is likely inactive.

### Implementation

Files:

- `shared/lifecycle.ts`
- `shared/lifecycle.test.ts`
- `core-tools/task-plan/src/index.ts` if event return shape needs adjustment

Changes:

- Add optional lifecycle method:

```ts
onBeforeAgentStart?(event: any, ctx: ExtensionContext): Promise<any>;
```

- Add hook mapping:

```ts
["onBeforeAgentStart", "before_agent_start"]
```

- Confirm `TaskPlanExtension.onBeforeAgentStart` is registered and returns the expected context payload.

### Tests first

Add tests in `shared/lifecycle.test.ts`:

- `register() wires before_agent_start when subclass defines onBeforeAgentStart`
- `register() does not wire before_agent_start when subclass omits it`

Expected red failure:

- Test fails because `before_agent_start` is not in `HOOK_EVENT_MAP`.

### Verification

```bash
npm test -- shared/lifecycle.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add shared/lifecycle.ts shared/lifecycle.test.ts core-tools/task-plan/src/index.ts
git commit -m "fix(lifecycle): register before agent start hooks"
```

---

## Step 2 — Fix `task` review schema

### Problem

`handleReview` reads `params.approve`, but `TaskPlanParams` does not expose `approve`. The model/user cannot discover how to approve tasks through the tool schema.

### Implementation

Files:

- `core-tools/task-plan/src/tool.ts`
- `core-tools/task-plan/src/tool.test.ts` or new focused test file

Changes:

- Add schema field:

```ts
approve: Type.Optional(Type.Boolean({ description: "Approve task/plan for execution" }))
```

- Consider adding `reject` or `reviewDecision` later, but keep this step minimal.

### Tests first

Add tests that assert:

- `TaskPlanParams` includes optional `approve`.
- Review approval clears `requiresReview`.
- Review without approval reports the current review state.

Expected red failure:

- Schema test fails because `approve` is missing.

### Verification

```bash
npm test -- core-tools/task-plan/src/tool.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/tool.ts core-tools/task-plan/src/tool.test.ts
git commit -m "fix(task-plan): expose review approval parameter"
```

---

## Step 3 — Add task-plan tool handler tests

### Problem

Core store, capture, executor, and DAG have tests, but the unified tool handlers are mostly untested.

### Implementation

Files:

- `core-tools/task-plan/src/tool.test.ts`
- `core-tools/task-plan/src/tool.ts` if testability requires exported helpers

Changes:

- Prefer testing through `createTaskPlanTool(deps).execute(...)`.
- Avoid exporting every private handler unless necessary.
- Use temporary task store directories.
- Use a fake executor for deterministic execution behavior.

### Tests first

Cover:

- create task
- create plan with steps
- list summary counts
- add-step
- complete-step auto-completes when all steps are done
- claim/release assignment
- execute rejects other-session assignment without `force`
- review approval
- search text query

Expected red failure:

- New tests may expose missing behavior or schema gaps.

### Verification

```bash
npm test -- core-tools/task-plan/src/tool.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/tool.test.ts core-tools/task-plan/src/tool.ts
git commit -m "test(task-plan): cover unified task tool actions"
```

---

## Step 4 — Deduplicate auto-captured tasks against persisted tasks

### Problem

`TaskCapture` deduplicates only within one capture call. `onAgentEnd` can recapture older messages if `ctx.messages` includes previous turns.

### Implementation

Files:

- `core-tools/task-plan/src/index.ts`
- `core-tools/task-plan/src/capture.ts` if normalization helper belongs there
- `core-tools/task-plan/src/capture.test.ts`
- optional `core-tools/task-plan/src/index.test.ts`

Changes:

- Normalize candidate task text:

```ts
text.toLowerCase().replace(/\s+/g, " ").trim()
```

- Before saving captured tasks, compare normalized text against existing active and review tasks.
- Skip duplicates.
- Prefer not to skip terminal archived/completed tasks unless they are very recent.

### Tests first

Add tests for:

- duplicate persisted task is not saved again
- same text with different whitespace/case is not saved again
- distinct task is saved

Expected red failure:

- Duplicate tasks are currently saved.

### Verification

```bash
npm test -- core-tools/task-plan/src/capture.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/index.ts core-tools/task-plan/src/capture.ts core-tools/task-plan/src/capture.test.ts
git commit -m "fix(task-plan): deduplicate captured tasks"
```

---

## Step 5 — Limit auto-capture to the latest user turn

### Problem

Capturing all messages from context on every `agent_end` risks repeated extraction from old conversation history.

### Implementation

Files:

- `core-tools/task-plan/src/index.ts`
- `core-tools/task-plan/src/capture.ts`
- tests as needed

Changes:

- In `onAgentEnd`, pass only the most recent user message or messages since the previous agent start.
- If pi context exposes turn-scoped messages, use that.
- Otherwise, select the last user message from `ctx.messages`.

### Tests first

Add tests for:

- only latest user message is captured from a multi-turn context
- no capture when latest user message has no task-like content

Expected red failure:

- Capture currently processes all user messages.

### Verification

```bash
npm test -- core-tools/task-plan/src/capture.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/index.ts core-tools/task-plan/src/capture.ts core-tools/task-plan/src/capture.test.ts
git commit -m "fix(task-plan): capture only latest user turn"
```

---

## Step 6 — Add captured-task suggestion state

### Problem

Auto-captured tasks are immediately pending and require review. That is safe, but it still pollutes active task lists with low-confidence suggestions.

### Implementation

Files:

- `core-tools/task-plan/src/types.ts`
- `core-tools/task-plan/src/capture.ts`
- `core-tools/task-plan/src/store.ts`
- `core-tools/task-plan/src/tool.ts`
- tests

Changes:

Option A, minimal:

- Add `source: "auto"` tasks with `status: "pending"` but `requiresReview: true` and `suggested: true`.

Option B, cleaner:

- Add status `suggested`.
- Review approval moves `suggested` to `pending`.
- Reject deletes or archives the task.

Recommended: Option B if type changes are acceptable.

### Tests first

Add tests for:

- auto-captured tasks start as `suggested`
- approved suggested tasks become `pending` and `requiresReview=false`
- rejected suggested tasks become `archived` or are deleted
- `/tasks-review` includes suggested tasks

Expected red failure:

- `suggested` status does not exist yet.

### Verification

```bash
npm test -- core-tools/task-plan/src/types.test.ts
npm test -- core-tools/task-plan/src/capture.test.ts
npm test -- core-tools/task-plan/src/tool.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/types.ts core-tools/task-plan/src/capture.ts core-tools/task-plan/src/store.ts core-tools/task-plan/src/tool.ts core-tools/task-plan/src/*.test.ts
git commit -m "feat(task-plan): add suggested captured tasks"
```

---

## Step 7 — Persist task events to JSONL audit log

### Problem

`TaskStore` keeps events in memory only. Restarting the session loses the audit trail.

### Implementation

Files:

- `core-tools/task-plan/src/store.ts`
- `core-tools/task-plan/src/store.test.ts`

Changes:

- Add event log path:

```txt
.pi/tasks/events.jsonl
```

- `appendEvent(event)` appends one JSON line.
- `loadFromDisk()` skips `events.jsonl`.
- `getEvents(taskId?)` reads persisted events and merges with in-memory events or uses persisted source only.
- Ensure corrupt JSONL lines are skipped safely.

### Tests first

Add tests for:

- event persists across store instances
- `getEvents(taskId)` filters persisted events
- corrupt event log line does not crash store

Expected red failure:

- Events are not persisted after a new store instance.

### Verification

```bash
npm test -- core-tools/task-plan/src/store.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/store.ts core-tools/task-plan/src/store.test.ts
git commit -m "feat(task-plan): persist task event audit log"
```

---

## Step 8 — Use locks for mutating task operations

### Problem

`acquireLock` exists but normal mutations do not use it. Concurrent sessions can overwrite each other.

### Implementation

Files:

- `core-tools/task-plan/src/store.ts`
- `core-tools/task-plan/src/tool.ts`
- tests

Changes:

- Add store helper:

```ts
async withTaskLock<T>(id: string, sessionId: string | undefined, fn: () => Promise<T>): Promise<T>
```

- Use it in mutating handlers:
  - update
  - delete
  - add-step
  - complete-step
  - claim
  - release
  - execute assignment/status update
  - review
  - skip/retry if they mutate task state

### Tests first

Add tests for:

- locked task mutation returns useful error
- stale lock can be stolen when UI allows it, or returns stable error without UI
- lock is released after successful mutation
- lock is released after failed mutation

Expected red failure:

- Mutating handlers currently ignore locks.

### Verification

```bash
npm test -- core-tools/task-plan/src/store.test.ts
npm test -- core-tools/task-plan/src/tool.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/store.ts core-tools/task-plan/src/tool.ts core-tools/task-plan/src/*.test.ts
git commit -m "fix(task-plan): lock mutating task operations"
```

---

## Step 9 — Improve search/filter API

### Problem

`TaskStore.search()` supports many filters, but the `task` tool exposes only a text `query`.

### Implementation

Files:

- `core-tools/task-plan/src/tool.ts`
- `core-tools/task-plan/src/store.ts` if needed
- `core-tools/task-plan/src/tool.test.ts`

Changes:

Expose optional tool params:

- `filterStatus`
- `filterIntent`
- `filterPriority`
- `filterTags`
- `filterSource`
- `filterAssignedToSession`
- `filterHasReview`

Or use existing names if compatible:

- `status`
- `intent`
- `priority`
- `tags`
- `source`
- `assignedToSession`
- `hasReview`

Recommended: reuse existing store query names when no action-specific conflict exists.

### Tests first

Add tests for:

- search by status
- search by priority
- search by tags
- search by `hasReview`
- combined text + status query

Expected red failure:

- Tool search ignores these filters.

### Verification

```bash
npm test -- core-tools/task-plan/src/tool.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/tool.ts core-tools/task-plan/src/tool.test.ts
git commit -m "feat(task-plan): expose structured task search filters"
```

---

## Step 10 — Clarify plan execution semantics

### Problem

For plans, `execute` does not execute each step. It activates/assigns and returns remaining steps. This can confuse users and agents.

### Implementation

Files:

- `core-tools/task-plan/src/tool.ts`
- `core-tools/task-plan/src/tool.test.ts`
- README/docs

Changes:

Option A, minimal:

- Keep action `execute` but change message to:

```txt
Activated plan <id>. Remaining manual steps:
...
Use complete-step after each step is done.
```

Option B, richer:

- Add action `activate` as explicit alias for current plan behavior.
- Keep `execute` for actual single task execution.

Recommended: Option B, with backwards-compatible `execute` support for plans.

### Tests first

Add tests for:

- plan `execute`/`activate` sets assignment and status appropriately
- response says “activated” or “manual steps”, not misleading “executing”
- completed plan reports all steps complete

Expected red failure:

- Current response says `Executing task` for plans.

### Verification

```bash
npm test -- core-tools/task-plan/src/tool.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/tool.ts core-tools/task-plan/src/tool.test.ts README.md
git commit -m "fix(task-plan): clarify plan activation flow"
```

---

## Step 11 — Port legacy status and active-plan widgets

### Problem

Legacy `/plan` displayed active progress in the status bar and a plan-step widget. Unified `task-plan` has no equivalent.

### Implementation

Files:

- `core-tools/task-plan/src/index.ts`
- `core-tools/task-plan/src/ui.ts` new recommended file
- tests if UI can be faked

Port concepts from:

- Legacy `updateStatus` behavior from the removed planner
- Legacy `updateWidget` behavior from the removed planner

Changes:

- Track active plan/task ID from persisted tasks.
- Status examples:
  - `📋 2/5` for current active plan
  - `⚠ 3 review` for review queue
- Widget examples:
  - done steps shown with check mark and muted text
  - pending steps shown with empty checkbox

### Tests first

Add UI fake tests for:

- status is cleared with no active plan
- status shows active plan progress
- widget shows checklist lines
- completed active plan clears or changes status

Expected red failure:

- No unified task-plan UI updater exists.

### Verification

```bash
npm test -- core-tools/task-plan/src/ui.test.ts
npm test -- core-tools/task-plan
npm test
```

### Commit

```bash
git add core-tools/task-plan/src/index.ts core-tools/task-plan/src/ui.ts core-tools/task-plan/src/ui.test.ts
git commit -m "feat(task-plan): show active plan status widget"
```

---

## Step 12 — Build interactive `/tasks` manager

### Problem

Current `/tasks` is plain markdown output. Legacy `/plan` had a searchable TUI manager with action menus.

### Implementation

Files:

- `core-tools/task-plan/src/tool.ts` or move commands to `commands.ts`
- `core-tools/task-plan/src/task-manager-ui.ts` new recommended file
- `core-tools/task-plan/src/task-manager-ui.test.ts` if possible

Port/adapt concepts from:

- `PlanSelectorComponent`
- `PlanActionMenuComponent`
- `PlanDetailOverlayComponent`

Unified manager requirements:

- Group by:
  - Review needed
  - Active
  - Pending
  - Completed/archived
- Search across:
  - id
  - title/text
  - status
  - intent
  - tags
  - steps
- Actions:
  - view
  - approve
  - reject/archive
  - execute/activate
  - complete step
  - edit
  - claim
  - release
  - delete
- Keyboard:
  - arrows select
  - enter action menu
  - esc close/back
  - shortcut approve/execute where safe

### Tests first

UI may be difficult to fully test, so split pure functions:

- grouping tasks
- rendering task heading
- filtering/searching tasks
- action availability per task status

Tests:

- active tasks sort before pending
- review tasks are highlighted/grouped first
- completed tasks are collapsed/limited
- task with steps renders progress
- current-session assignment marker renders correctly

Expected red failure:

- Pure UI helpers do not exist.

### Verification

```bash
npm test -- core-tools/task-plan/src/task-manager-ui.test.ts
npm test -- core-tools/task-plan
npm test
```

Manual verification:

```txt
/tasks
```

Check:

- search input filters correctly
- action menu works
- review approve updates list
- active plan widget updates after execute/complete-step

### Commit

```bash
git add core-tools/task-plan/src/tool.ts core-tools/task-plan/src/task-manager-ui.ts core-tools/task-plan/src/task-manager-ui.test.ts
git commit -m "feat(task-plan): add interactive task manager"
```

---

## Step 13 — Add `/plan` compatibility alias on unified backend

### Problem

Users familiar with legacy planning may expect `/plan`. README says old `plan` tool is replaced, but command compatibility improves adoption.

### Implementation

Files:

- `core-tools/task-plan/src/tool.ts` or `commands.ts`
- tests

Changes:

- `/plan` opens the same manager filtered to tasks with steps.
- `/plan on` optionally enables read-only planning mode if Step 14 is implemented.
- `/plan off` disables planning mode.
- `/plan <query>` opens manager with initial query.

Do not re-register legacy `plan` tool unless explicitly needed.

### Tests first

Add command registration tests if command registration is testable with fake `pi`.

Pure helper tests:

- parse `/plan on`
- parse `/plan off`
- parse `/plan <query>`
- identify plan tasks as `steps.length > 0`

Expected red failure:

- Unified task-plan has no `/plan` alias.

### Verification

```bash
npm test -- core-tools/task-plan/src/commands.test.ts
npm test -- core-tools/task-plan
npm test
```

Manual verification:

```txt
/plan
/plan auth
```

### Commit

```bash
git add core-tools/task-plan/src/tool.ts core-tools/task-plan/src/commands.ts core-tools/task-plan/src/commands.test.ts
git commit -m "feat(task-plan): add unified plan command alias"
```

---

## Step 14 — Restore read-only planning mode safely

### Problem

Legacy planning mode restricted tools and blocked destructive bash commands. Unified `task-plan` currently does not expose this safety UX.

### Implementation

Files:

- `core-tools/task-plan/src/index.ts`
- `core-tools/task-plan/src/planning-mode.ts` new recommended file
- `core-tools/task-plan/src/planning-mode.test.ts`

Port concepts from:

- `PLAN_MODE_TOOLS`
- `NORMAL_MODE_TOOLS`
- `SAFE_COMMANDS`
- `DESTRUCTIVE_PATTERNS`
- `isSafeCommand`
- `/plan on` and `/plan off`
- `--plan` flag if still desired

Adjust tool lists for current pi-me tools. The legacy list only contains:

```ts
["read", "bash", "grep", "find", "ls"]
```

Current pi has richer safe tools like `search`, `find_files`, `read_enhanced`, etc. Decide the allowlist explicitly.

### Tests first

Add tests for:

- destructive commands are blocked
- safe read-only commands are allowed
- shell redirection is blocked
- allowed tool list switches on/off
- planning context is injected when mode is active

Expected red failure:

- Unified task-plan has no planning mode safety gate.

### Verification

```bash
npm test -- core-tools/task-plan/src/planning-mode.test.ts
npm test -- core-tools/task-plan
npm test
```

Manual verification:

```txt
/plan on
bash rm -rf tmp   # should be blocked
bash ls           # should be allowed
/plan off
```

### Commit

```bash
git add core-tools/task-plan/src/index.ts core-tools/task-plan/src/planning-mode.ts core-tools/task-plan/src/planning-mode.test.ts
git commit -m "feat(task-plan): restore read-only planning mode"
```

---

## Step 15 — Update documentation and remove inaccurate claims

### Problem

README says planning/orchestration/intent were removed, but the directories still exist and `task-plan` still imports shared intent code.

### Implementation

Files:

- `README.md`
- `docs/index.md` if relevant
- this plan if status updates are desired

Changes:

- Say `task-plan` is active unified entrypoint.
- Say legacy planning/orchestration modules remain as migration/reference code until fully removed.
- Say `core-tools/intent` remains shared infrastructure.
- Document actual commands:
  - `/tasks`
  - `/tasks-review`
  - `/task <desc>`
  - `/plan` if implemented
- Document review flow and safety mode.
- Document storage:
  - `.pi/tasks/*.json`
  - `.pi/tasks/events.jsonl`

### Tests first

Docs-only step does not require TDD, but run link/format checks if available.

### Verification

```bash
git diff --check
npm test
```

### Commit

```bash
git add README.md docs/index.md docs/plans/2026-05-18-task-plan-ux-implementation.md
git commit -m "docs(task-plan): document unified task plan workflow"
```

---

## Step 16 — Decide legacy code cleanup

### Problem

After migration, `core-tools/planning/` became redundant and has been removed.

### Implementation

Files:

- `core-tools/planning/**`
- imports/tests/docs as needed

Decision options:

1. Keep legacy planning as archived source material.
2. Move it to `docs/archive/` as reference.
3. Delete it after all useful behavior is migrated and tested.

Recommended:

- Do not delete until Steps 11–14 are complete and verified.
- Then run content searches for remaining imports.

### Tests first

No production behavior should change if it is unregistered. Add/keep tests proving active entrypoint still loads only `task-plan`.

### Verification

```bash
npm test
git status --short
```

### Commit

```bash
git add core-tools/planning README.md
git commit -m "refactor(task-plan): remove migrated legacy planner"
```

---

## Final verification checklist

Before declaring the implementation complete:

- [ ] `npm test` passes freshly.
- [ ] Focused task-plan tests pass freshly.
- [ ] Lifecycle hook tests cover `before_agent_start`.
- [ ] Tool schema tests cover `approve` and structured search filters.
- [ ] Capture tests cover deduplication and latest-turn behavior.
- [ ] Store tests cover persisted audit events and lock behavior.
- [ ] UI helper tests cover grouping, filtering, action availability, headings, and progress.
- [ ] Manual `/tasks` manager verification completed.
- [ ] Manual `/plan` alias verification completed if implemented.
- [ ] Manual planning mode safety check completed if implemented.
- [ ] README accurately describes actual loaded behavior.
- [ ] Every step has its own conventional commit.
- [ ] No unrelated pre-existing changes are included in commits.

## Suggested commit sequence

1. `fix(lifecycle): register before agent start hooks`
2. `fix(task-plan): expose review approval parameter`
3. `test(task-plan): cover unified task tool actions`
4. `fix(task-plan): deduplicate captured tasks`
5. `fix(task-plan): capture only latest user turn`
6. `feat(task-plan): add suggested captured tasks`
7. `feat(task-plan): persist task event audit log`
8. `fix(task-plan): lock mutating task operations`
9. `feat(task-plan): expose structured task search filters`
10. `fix(task-plan): clarify plan activation flow`
11. `feat(task-plan): show active plan status widget`
12. `feat(task-plan): add interactive task manager`
13. `feat(task-plan): add unified plan command alias`
14. `feat(task-plan): restore read-only planning mode`
15. `docs(task-plan): document unified task plan workflow`
16. `refactor(task-plan): remove migrated legacy planner`

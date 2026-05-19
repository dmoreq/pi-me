# pi-me Codebase Value, Activation, and Dead-Code Review

Date: 2026-05-19

## Executive summary

This review examined the current repository structure, Pi package manifest, umbrella entry points, registered commands/tools/hooks, tests, dependency usage, and static import graph.

**Bottom line:** the repository is much smaller than the README claims and has several high-value live features, but it is **not fully activated as documented**. The biggest problems are activation drift and stale compatibility remnants:

1. **Memory is implemented and tested but not loaded by `core-tools/index.ts`.** All `memory_*` tools and memory context injection are currently dormant.
2. **Thinking Steps is implemented and tested but not loaded by `core-tools/index.ts`.** `/thinking-steps` and `alt+t` are currently dormant.
3. **Workflow is live, but its background-job feature is incomplete.** `run-bg` starts a process but does not persist the job, so `job-list`/`job-status` do not reflect it.
4. **Context Monitor is live, but its message/turn counters are not wired.** The `context-depth` trigger cannot fire because `recordMessage()` and `recordTurn()` have no callers.
5. **Several modules are pure test-only or compatibility leftovers:** `authoring/index.ts`, `shared/command-builder.ts`, `shared/lazy-package.ts`, `foundation/secrets/scanner.ts`, `core-tools/memory/src/bootstrap.ts`, and several workflow stub files.
6. **Documentation is substantially stale.** README and `core-tools/CODE_REVIEW.md` refer to removed modules such as `task-plan`, `subprocess-orchestrator`, `code-quality`, and `file-intelligence`.
7. **Many package dependencies appear unused by current production code.** Several remain from removed web/content/adopted modules.

The test suite is healthy for what it covers: **244 tests passing**. However, tests do not catch the activation gaps because dormant modules can still have passing unit tests.

---

## Methodology

Actions performed:

- Inspected `package.json` Pi manifest.
- Inspected umbrella entry points:
  - `foundation/index.ts`
  - `session-lifecycle/index.ts`
  - `core-tools/index.ts`
  - `content-tools/index.ts`
  - `authoring/index.ts`
- Searched registered commands, tools, and event hooks.
- Built a simple static import graph over production TypeScript files.
- Checked dependency references in production TypeScript.
- Ran the full test suite.
- Reviewed live modules for feature value and activation status.

Test result:

```text
244 tests passed, 0 failed
```

Repository size excluding dependencies/worktrees, counted over main feature folders:

```text
TypeScript: 93 files, 10,935 lines, 8,627 code lines
Markdown:   36 files,  5,455 lines
JSON:        3 files,    199 lines
Shell:       5 files,    325 lines
JavaScript:  1 file,     168 lines
```

---

## Package activation model

`package.json` currently exposes the package to Pi like this:

```json
"pi": {
  "extensions": [
    "pi-telemetry",
    "./foundation/index.ts",
    "./session-lifecycle/index.ts",
    "./core-tools/index.ts",
    "./content-tools/index.ts",
    "./authoring/index.ts",
    "pi-web-providers/dist/index.js"
  ],
  "skills": ["./skills"],
  "themes": [
    "./themes/minimal.json",
    "./themes/minimal-light.json"
  ]
}
```

### Profile behavior

`shared/profile.ts` defaults to `full` if no global `~/.pi/agent/settings.json` profile is set.

| Profile | Actually loaded |
|---|---|
| `full` | foundation, session-lifecycle, core-tools, content-tools, authoring no-op, pi-web-providers, skills, themes |
| `dev` | foundation, session-lifecycle, core-tools subset, authoring no-op, pi-web-providers, skills, themes. `content-tools` internally skips. |
| `minimal` | foundation still loads, authoring no-op still loads, pi-web-providers still loads, skills/themes still exposed. `session-lifecycle`, `core-tools`, and `content-tools` skip internally. |

**Important discrepancy:** README says minimal loads “Nothing from pi-me”, but the package manifest always loads foundation, authoring no-op, external web providers, skills, and themes. If minimal is intended to mean truly minimal, the package/profile strategy needs redesign.

---

## Feature inventory and value assessment

### 1. Foundation umbrella

Entry point: `foundation/index.ts`

Loaded in all profiles.

#### 1.1 Secrets obfuscation

Files:

- `foundation/secrets/secrets.ts`
- `foundation/secrets/loader.ts`
- `foundation/secrets/obfuscator.ts`
- `foundation/secrets/regex.ts`
- `foundation/secrets/types.ts`

Status: **Live**

Value: **High**

What it does:

- Loads configured project/global secrets and environment secrets.
- Obfuscates secrets from tool results and context messages.
- Provides a useful safety layer for assistant sessions.

Concerns:

- `foundation/secrets/scanner.ts` is not used by the live secrets extension. It is only tested. That scanner detects hardcoded secrets in arbitrary content, but the active extension only obfuscates configured/env secrets.
- If proactive secret scanning before writes or tool calls is still desired, wire `scanner.ts` into `tool_call`, `before_agent_start`, or a command. Otherwise remove it and its tests.

Recommendation: **Keep secrets obfuscation. Decide whether to wire or delete `scanner.ts`.**

#### 1.2 Context Monitor

Files:

- `foundation/context-monitor/index.ts`
- `foundation/context-monitor/context-monitor.ts`
- `foundation/context-monitor/types.ts`

Status: **Partially live**

Value: **Medium to high if fixed**

What works:

- Resets per session.
- Tracks tool result count.
- Attempts to track touched files from edit/write tool result text.
- Accepts token usage events if the expected event exists.
- Fires telemetry notifications for tool/file/message thresholds.

What is broken/incomplete:

- `ContextMonitor.recordMessage()` has no callers.
- `ContextMonitor.recordTurn()` has no callers.
- `recordPruning()` and `markRecap()` have no callers.
- Therefore `messageCount` remains 0 and the `context-depth` trigger cannot fire.
- The file-write extraction depends on tool result text matching `/(?:wrote|written to|edit|modified):\s*(\S+)/i`, which is likely brittle.

Recommendation: **Keep but fix wiring.** Add event handlers for message/turn events, or remove counters/triggers that cannot be populated.

---

### 2. Session lifecycle umbrella

Entry point: `session-lifecycle/index.ts`

Loaded in `dev` and `full`; skipped in `minimal`.

#### 2.1 Welcome/session naming

File: `session-lifecycle/welcome/welcome.ts`

Status: **Live in dev/full**

Value: **Medium**

What it does:

- Sets welcome UI/header.
- Tracks first user message for session naming.
- Provides `/welcome-toggle` and `/welcome-builtin`.

Recommendation: **Keep if UX customization matters.** If the project is being aggressively slimmed, this is optional but not dead.

#### 2.2 Skill args

File: `session-lifecycle/skill-args.ts`

Status: **Live in dev/full**

Value: **High for skill usability**

What it does:

- Substitutes `$1`, `$2`, `$ARGUMENTS`, `$@`, and slice forms in skill invocations.
- Invalidates skill index on reload/startup.

Recommendation: **Keep.** This is small, tested, and directly supports the package’s large skill surface.

---

### 3. Core tools umbrella

Entry point: `core-tools/index.ts`

Loaded in `dev` and `full`; skipped in `minimal`.

Current live imports from `core-tools/index.ts`:

```ts
smartCommit(pi);
workflow(pi);
registerClipboard(pi);

if (profile === "full") {
  fileCollector(pi);
  codeReview(pi);
}
```

Dormant despite existing implementation:

- `core-tools/memory/index.ts`
- `core-tools/thinking-steps/thinking-steps.ts`

#### 3.1 Smart Commit

Files:

- `core-tools/smart-commit/index.ts`
- `git.ts`, `grouper.ts`, `prompt.ts`, `quality.ts`, `validation.ts`, `types.ts`

Status: **Live in dev/full**

Value: **High**

Exposed:

- `/commit`
- `commit_message` tool

Strengths:

- Handles dirty file discovery and grouping.
- Stages only a selected group.
- Validates conventional commit messages.
- Tests cover validation, grouping, prompt generation, and git integration.

Concerns:

- The command only prepares the first group and asks the model to call `commit_message`; this is intentional but should be documented as “repeat `/commit` for next group”.
- `activeCommitContext` is process-global. It is acceptable for a single interactive session, but risky if multiple sessions share one extension runtime.

Recommendation: **Keep.** Consider session-scoping `activeCommitContext` if Pi can run concurrent sessions in the same process.

#### 3.2 Workflow

Files:

- `core-tools/workflow/index.ts`
- `tool.ts`, `store.ts`, `executor.ts`, `runner.ts`, `types.ts`, `ui.ts`, `migration.ts`

Status: **Live in dev/full, but incomplete**

Value: **High conceptually, medium currently**

Exposed:

- `workflow` tool
- `/workflow`
- `/plan`
- `/tasks`

Strengths:

- Provides checklist/workflow persistence under `.pi/workflows`.
- Can run shell/pi/manual steps.
- Has a compact checklist UI and tool-driven CRUD.

Major issues:

1. **Background jobs are not persisted.**
   - `runBackgroundAsWorkflow()` calls `deps.executor.runBackground(...)` but ignores the returned job and never calls `store.saveJob(job)`.
   - `job-list` and `job-status` read from `store.listJobs()` / `store.getJob()`, so they will not show jobs launched by `run-bg`.
   - `WorkflowExecutor` updates jobs in memory on child close, but those updates are not written to disk.

2. **`job-cancel` only cancels in-memory processes.**
   - After reload, no process handles exist.
   - Persistent job status cannot be cancelled or updated.

3. **Several workflow files appear unused/stub-like.**
   - `capture.ts`
   - `commands.ts`
   - `compatibility.ts`
   - `intent.ts`

4. **Tool naming drift.**
   - `core-tools/index.ts` telemetry advertises `subprocess` and `task`, but the actual registered tool is `workflow`.

Recommendation: **Keep workflow, but either finish background jobs or remove `run-bg`/job actions.** Also delete unused workflow stubs if they are not part of the near-term design.

#### 3.3 Clipboard

File: `core-tools/clipboard.ts`

Status: **Live in dev/full**

Value: **Medium**

Exposed:

- `copy_to_clipboard` tool

Recommendation: **Keep.** It is small and useful.

#### 3.4 File Collector

Files:

- `core-tools/file-collector/index.ts`
- `core-tools/file-collector/extension.ts`

Status: **Live only in full profile**

Value: **Medium, situational**

What it does:

- Captures paths and snippets from read/write/edit/bash/assistant output.
- Adds file collection guidance to system prompt.
- Configurable through `file-collector.jsonc`.

Concerns:

- It is the largest single production module by far.
- It adds hooks to several high-frequency events.
- Value depends on whether users rely on sidecar file collection.

Recommendation: **Keep only if actively used.** If the goal is a lean package, consider moving to an optional package or full-only is acceptable.

#### 3.5 Code Review

Files:

- `core-tools/code-review/index.ts`
- `complexity.ts`, `todo-scanner.ts`, `tdi.ts`, `reporter.ts`

Status: **Live only in full profile**

Value: **Medium**

Exposed:

- `/code-review`

Strengths:

- Runs simple complexity/TODO/TDI analysis.
- Saves reports to `.pi/reviews/`.
- Has unit tests.

Issues:

- `filteredFiles` is computed from `scope.focusPatterns` but never used. Complexity analysis always runs on all source files.
- `const emoji = ...` is computed and never used.
- The `security` module is listed in the `ReviewScope` type but never implemented in any scope.
- The scanner is homegrown and shallow compared to external tools.

Recommendation: **Keep as a lightweight local report generator, but fix the unused focus filter or remove the focus feature.**

#### 3.6 Memory

Files:

- `core-tools/memory/index.ts`
- `core-tools/memory/src/*`

Status: **Dormant / not activated**

Value: **High if activated and desired**

Implemented capabilities:

- Persistent SQLite-backed semantic memory.
- Memory context injection before agent start.
- Consolidation from session messages.
- Tools: `memory_search`, `memory_remember`, `memory_forget`, `memory_lessons`, `memory_stats`.
- Command: `/memory-consolidate`.

Activation problem:

- `core-tools/index.ts` never imports or calls `memory(pi)`.
- Therefore none of the memory tools/hooks are registered.
- README still advertises memory commands and behavior.

Additional code issue:

- `core-tools/memory/index.ts` defines `isAutoInjectDisabled()` but never uses it; `readGlobalSettings()` supersedes it.
- `core-tools/memory/src/bootstrap.ts` appears unimported by production code.

Recommendation: **Choose one:**

1. Re-activate memory in `core-tools/index.ts` for dev/full, or
2. Remove memory implementation, tests, README claims, and dependencies related to it.

Given its functionality and test coverage, re-activation is likely preferable if persistent memory is still a product goal.

#### 3.7 Thinking Steps

Files:

- `core-tools/thinking-steps/thinking-steps.ts`
- `core-tools/thinking-steps/thinking-utils.ts`
- `core-tools/thinking-steps/README.md`

Status: **Dormant / not activated**

Value: **Medium**

Implemented capabilities:

- `/thinking-steps`
- `alt+t` shortcut
- Per-project/global preference files
- Thinking label/status rendering

Activation problem:

- `core-tools/index.ts` never imports or calls `thinkingSteps(pi)`.

Recommendation: **Either re-activate or remove.** Since it is small and documented, re-activating is probably better.

#### 3.8 Intent detector

Files:

- `core-tools/intent/detector.ts`
- `core-tools/intent/types.ts`

Status: **Partially live**

Value: **Low to medium**

Used by:

- `core-tools/code-review/index.ts`

Not used by:

- Workflow, despite having `workflow/intent.ts`.

Recommendation: **Keep if code-review intent focus stays.** If code-review focus is simplified, this can be folded into code-review or removed.

---

### 4. Content tools umbrella

Entry point: `content-tools/index.ts`

Loaded only in `full`; skipped in `dev` and `minimal`.

#### 4.1 Repeat

File: `content-tools/repeat/repeat.ts`

Status: **Live only in full profile**

Value: **Medium**

Exposed:

- `/repeat`

What it does:

- Replays previous `bash`, `edit`, and `write` calls from the current branch.
- Supports opening edits/writes in `$EDITOR`.
- Provides a custom TUI picker.

Concerns:

- The whole `content-tools` umbrella now exists only for `/repeat`.
- Old web/github content tools are gone or externalized through `pi-web-providers`.

Recommendation: **Keep only if `/repeat` is valued.** If not, delete `content-tools/`, remove it from `package.json`, remove its test glob, and delete `skills/repeat-command`.

---

### 5. Authoring umbrella

Entry point: `authoring/index.ts`

Status: **Live as a no-op**

Value: **Very low**

What it does:

- Nothing. It is a compatibility stub after commit-helper moved to smart-commit.

Recommendation: **Remove unless external users explicitly import it.** Remove `./authoring/index.ts` from `package.json.pi.extensions` and remove `authoring/**/*.test.ts` from the test script. There are no tests under `authoring` currently.

---

### 6. External web providers

Entry point: `pi-web-providers/dist/index.js` from dependency.

Status: **Live via package manifest**

Value: **High if web search/fetch is desired**

Concerns:

- This is always loaded regardless of profile, including `minimal`.
- README still describes `content-tools/web-tools`, but current web functionality is externalized.

Recommendation: **Keep if web search/fetch is core.** If profiles should be strict, wrap web providers in a local profile-aware entry point instead of listing the external extension directly.

---

### 7. Skills

Manifest exposes the entire `./skills` directory.

Status: **Live package resource**

Value: **Mixed**

High-value skills likely worth keeping:

- `development-workflow`
- `extending-pi`
- `plugin-guide`
- `secrets`
- `systematic-debugging`
- `test-driven-development`
- `web-research`
- `workflow`
- `writing-skills`

Potentially stale or redundant skills:

- `commit-helper` — name is stale; functionality now lives in smart-commit. It may still be useful as a usage guide for `/commit`, but should be renamed to `smart-commit` or updated.
- `repeat-command` — only valuable if `/repeat` stays.
- Skills and prompts that say “subprocess” may be stale if there is no active `subprocess` tool and only workflow remains.
- `a-nach-b` appears domain-specific and may not belong in a general Pi extension suite unless intentionally bundled.

Recommendation: **Audit skills separately.** Skills are user-facing product surface; stale skills can cause more confusion than stale code.

---

### 8. Themes

Files:

- `themes/minimal.json`
- `themes/minimal-light.json`

Status: **Live package resources**

Value: **Low to medium**

How they work:

- They are not TS imports.
- Pi package manager reads `package.json.pi.themes` and registers these JSON files as selectable themes.

Recommendation: **Keep if custom Pi appearance is desired.** They are tiny and harmless.

---

## Static dead-code / unused-code candidates

The following production TypeScript files were not imported by other production TypeScript files, excluding package entry points. Some are intentionally external resources or test utilities; each needs a decision.

| File | Current status | Recommendation |
|---|---|---|
| `core-tools/memory/index.ts` | Dormant because not called by core umbrella | Re-activate or delete memory |
| `core-tools/memory/src/bootstrap.ts` | Unimported | Delete unless intended future CLI/bootstrap |
| `core-tools/test-utils.ts` | Test utility only | Move under tests or keep if conventions allow |
| `core-tools/thinking-steps/thinking-steps.ts` | Dormant because not called by core umbrella | Re-activate or delete |
| `core-tools/workflow/capture.ts` | Unimported | Delete unless planned |
| `core-tools/workflow/commands.ts` | Unimported | Delete unless planned |
| `core-tools/workflow/compatibility.ts` | Unimported stub | Delete |
| `core-tools/workflow/intent.ts` | Unimported | Delete or wire into workflow capture |
| `foundation/secrets/scanner.ts` | Test-only | Wire into active secrets flow or delete |
| `shared/command-builder.ts` | Unimported | Wire into command-heavy extensions or delete |
| `shared/index.ts` | Package barrel, not used internally | Keep only if external consumers import it; otherwise remove |
| `shared/lazy-package.ts` | Test-only | Delete unless upcoming adopted-package lazy loading needs it |
| `authoring/index.ts` | Manifest entry but no-op | Remove from manifest and delete |

---

## Dependency review

Production TypeScript references only these direct dependencies:

- `pi-telemetry`
- `pi-web-providers` through package manifest
- `zod`
- `jsonc-parser`
- `@mariozechner/pi-coding-agent` peer
- `@mariozechner/pi-tui` peer
- `@sinclair/typebox` peer

Dependencies that appear unused by current production code:

- `defuddle`
- `linkedom`
- `lodash`
- `mime-types`
- `pi-docparser`
- `pi-link`
- `pi-markdown-preview`
- `shell-quote`
- `wreq-js`

Likely reason: leftovers from removed `file-intelligence`, web/content tooling, markdown preview, or adopted packages.

Recommendation: **Remove unused dependencies after confirming they are not required by skills, external runtime loading, or planned package adoption.** At minimum, remove unused dependencies in a separate commit and run `npm install` + `npm test`.

---

## Documentation drift

### README is stale

Examples of mismatches:

- Mentions `task-plan`, but current live module is `workflow`.
- Mentions `subprocess-orchestrator`, but current live module is `workflow`; no `subprocess` tool is registered.
- Mentions `file-intelligence`, but it is absent.
- Mentions `memory` and `/memory-consolidate`, but memory is not loaded.
- Mentions `thinking-steps`, but thinking-steps is not loaded.
- Mentions `content-tools/web-tools` and `github.ts`, but web is externalized and github was removed.
- Says “18 extensions” and “840+ tests”; current test run found 244 tests.
- Says minimal profile loads nothing from pi-me, but foundation/external resources still load.

Recommendation: **Rewrite README after deciding the activation/removal plan.** Do not update it before deciding whether to re-activate memory/thinking.

### `core-tools/CODE_REVIEW.md` is obsolete

It discusses removed modules and old architecture:

- `code-quality/`
- `subprocess-orchestrator/`
- `task-plan/`
- `memory-mode`
- old lifecycle issues that have since changed

Recommendation: **Move to `docs/archive/` or delete.** Keeping it at `core-tools/CODE_REVIEW.md` makes the current architecture harder to understand.

### `CLEANUP_PLAN.md` is partly completed and now stale

It lists many modules that appear already removed, but also identifies still-relevant cleanup items such as `ext-state` and obsolete stubs.

Recommendation: **Replace with a current cleanup checklist generated from this report.**

---

## Critical activation findings

### A. Memory is not fully activated

Evidence:

- `core-tools/memory/index.ts` exists and calls `memory(pi, globalSettings)`.
- `core-tools/memory/src/index.ts` registers memory tools and hooks.
- `core-tools/index.ts` does not import memory.

Impact:

- No memory context injection.
- No memory tools.
- README commands are misleading.

Fix option:

```ts
import memory from "./memory/index.ts";
import thinkingSteps from "./thinking-steps/thinking-steps.ts";

// inside default function, after clipboard/workflow/smartCommit:
memory(pi);
thinkingSteps(pi);
```

Decide whether these should be dev/full or full-only.

### B. Thinking Steps is not fully activated

Evidence:

- `thinking-steps.ts` registers command, shortcut, and hooks.
- It is not imported in `core-tools/index.ts`.

Impact:

- `/thinking-steps` absent.
- UI shortcut absent.
- README claim is wrong.

Recommendation: re-activate or remove.

### C. Workflow background jobs are nonfunctional as persisted jobs

Evidence:

- `runBackgroundAsWorkflow()` calls `deps.executor.runBackground(...)` and returns the workflow.
- It never calls `store.saveJob(job)`.
- `job-list` reads `store.listJobs()`.

Impact:

- `workflow` `run-bg` action starts a process but `job-list` likely returns empty.
- Job completion status/stdout/stderr are not persisted.

Recommendation:

- Add a job lifecycle callback to `WorkflowExecutor`, or move background execution into `WorkflowRunner` with `store.saveJob()` updates on start/close/error.
- Alternatively remove `run-bg`, `job-list`, `job-status`, and `job-cancel` until properly implemented.

### D. Context Monitor counters are incomplete

Evidence:

- `ContextMonitor` has `recordMessage()` and `recordTurn()`.
- Only `recordToolCall()` and `recordFileWrite()` are called by `index.ts`.

Impact:

- Context-depth trigger cannot fire.
- Stats under-report session activity.

Recommendation:

- Wire `message_end` or `turn_end` events to counters.
- If Pi event names differ, align with actual API.

---

## Recommended cleanup plan

### Phase 1 — Fix activation drift

1. Decide whether memory should be product surface.
   - If yes, import and call memory in `core-tools/index.ts`.
   - If no, delete memory module and docs.
2. Decide whether thinking-steps should be product surface.
   - If yes, import and call it in `core-tools/index.ts`.
   - If no, delete module, tests, and README references.
3. Fix workflow background job persistence or remove background-job actions.
4. Wire context-monitor message/turn counters or remove dead counters/triggers.

### Phase 2 — Remove clear dead code

Safe deletion candidates if not externally supported:

- `authoring/index.ts` plus manifest entry.
- `core-tools/memory/src/bootstrap.ts`.
- `core-tools/workflow/compatibility.ts`.
- `core-tools/workflow/capture.ts`, `commands.ts`, `intent.ts` if no near-term plan.
- `shared/lazy-package.ts` and tests if adopted-package lazy loading is not used.
- `foundation/secrets/scanner.ts` and tests if proactive scanning will not be wired.

Conditional deletion candidates:

- `content-tools/` if `/repeat` is not needed.
- `shared/command-builder.ts` if no extension will use it.
- `shared/ext-state.ts` if workflow/background persistence uses `WorkflowStore` instead.

### Phase 3 — Dependency cleanup

Remove unused dependencies one group at a time:

1. Web/content leftovers: `defuddle`, `linkedom`, `mime-types`, `wreq-js`.
2. Removed tooling leftovers: `pi-docparser`, `pi-link`, `pi-markdown-preview`.
3. General leftovers: `lodash`, `shell-quote`.

Run `npm install` and `npm test` after each group or after the full removal.

### Phase 4 — Documentation reset

Update:

- `README.md`
- `skills/*` that mention removed tools
- `CLEANUP_PLAN.md`
- Archive/delete `core-tools/CODE_REVIEW.md`

README should reflect current actual product surface, test count, and profiles.

---

## Suggested target architecture

A cleaner package split would be:

### Always-on foundation

- secrets
- context-monitor

### Dev/full core

- smart-commit
- workflow
- clipboard
- memory, if re-activated
- thinking-steps, if re-activated

### Full-only extras

- file-collector
- code-review
- repeat
- external web providers, if not globally desired

### Resources

- skills
- themes

### Remove/no-op

- authoring stub
- old workflow/task/subprocess compatibility stubs
- stale docs
- unused dependencies

---

## Feature-by-feature decision table

| Feature/module | Activation | Value | Decision |
|---|---:|---:|---|
| Secrets obfuscation | Live | High | Keep |
| Context monitor | Partial | Medium/high | Fix wiring |
| Welcome/session naming | Live dev/full | Medium | Keep or optional |
| Skill args | Live dev/full | High | Keep |
| Smart commit | Live dev/full | High | Keep |
| Workflow | Live dev/full | High concept | Keep, fix background jobs |
| Clipboard | Live dev/full | Medium | Keep |
| File collector | Live full | Medium | Keep only if used |
| Code review | Live full | Medium | Keep, fix focus-filter bug |
| Memory | Dormant | High | Re-activate or delete |
| Thinking steps | Dormant | Medium | Re-activate or delete |
| Repeat | Live full | Medium | Keep only if used |
| Authoring | No-op | Very low | Delete |
| Web providers | Live all profiles | High if needed | Keep, but make profile-aware if desired |
| Themes | Live resource | Low/medium | Keep |
| Skills | Live resource | Mixed | Audit/update |

---

## Final recommendation

Do **not** treat the codebase as fully activated. The codebase is in a halfway state after consolidation: many old modules were removed, but entry points, docs, metadata, dependencies, and tests still describe a larger product.

Recommended near-term path:

1. Re-activate `memory` and `thinking-steps` if they are still wanted.
2. Fix `workflow` background jobs or remove those actions.
3. Fix context-monitor counters.
4. Delete `authoring` no-op and obvious unused stubs.
5. Clean unused dependencies.
6. Rewrite README and skills to match reality.

After those changes, the package will be much easier to understand: a compact foundation + workflow/smart-commit core + optional full-profile UX tools/resources.

# Adoption Plan: pi-subagents → pi-me

**Source**: https://github.com/nicobailon/pi-subagents  
**Version**: 0.21.5 · **License**: MIT · **Files**: ~88 source files  
**Entry point**: `src/extension/index.ts`  
**Executables**: `install.mjs` (setup script)

---

## Comparison Matrix

### Extension Registration (`src/extension/index.ts`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/extension/index.ts` | `core-tools/ralph-loop/ralph-loop.ts` + `core-tools/sub-pi/index.ts` | **Complementary** — pi-subagents is much richer (parallel, chain, background modes, TUI status, agent manager, slash commands). Merge ralph-loop concepts into it. |
| `src/extension/schemas.ts` | (none — partial in ralph-loop types) | **Adopt** — comprehensive TypeBox schema for subagent parameters |
| `src/extension/control-notices.ts` | (none) | **Adopt** — control event handling for long-running subagents |
| `src/extension/doctor.ts` | (none) | **Adopt** — diagnostics command for subagent health |

### Agent System (`src/agents/`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/agents/agents.ts` | `core-tools/ralph-loop/agents.ts` | **Merge** — pi-subagents is more comprehensive (agent discovery from user/project/builtin dirs, overrides, settings). Replace ralph-loop agents.ts. |
| `src/agents/agent-templates.ts` | (none) | **Adopt** — builtin agent templates (Scout, Code Reviewer, Planner, Implementer) |
| `src/agents/agent-selection.ts` | (none) | **Adopt** — merge logic for user vs project agents |
| `src/agents/agent-scope.ts` | (none) | **Adopt** — scope resolution for agent directories |
| `src/agents/agent-serializer.ts` | (none) | **Adopt** — agent config serialization for UI |
| `src/agents/agent-management.ts` | (none) | **Adopt** — agent CRUD operations |
| `src/agents/chain-serializer.ts` | (none) | **Adopt** — chain workflow serialization |
| `src/agents/identity.ts` | (none) | **Adopt** — package/agent naming utilities |
| `src/agents/frontmatter.ts` | (none) | **Adopt** — YAML frontmatter parsing for agent markdown files |
| `src/agents/skills.ts` | (none) | **Adopt** — skill resolution for agents |

### Run Execution (`src/runs/`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/runs/foreground/subagent-executor.ts` | `ralph-loop/ralph-loop.ts` (partial) | **Replace** — pi-subagents is more sophisticated (single/parallel/chain, streaming, TUI rendering) |
| `src/runs/foreground/execution.ts` | (none) | **Adopt** — foreground subagent execution |
| `src/runs/foreground/chain-execution.ts` | (none — ralph-loop has `chain` mode but less sophisticated) | **Adopt** — chain pipeline execution with {previous} variable |
| `src/runs/foreground/chain-clarify.ts` | (none) | **Adopt** — TUI preview/edit before chain execution |
| `src/runs/background/async-job-tracker.ts` | (none) | **Adopt** — background job tracking |
| `src/runs/background/async-execution.ts` | (none) | **Adopt** — background execution |
| `src/runs/background/async-resume.ts` | (none) | **Adopt** — resume background jobs |
| `src/runs/background/async-status.ts` | (none) | **Adopt** — status polling |
| `src/runs/background/result-watcher.ts` | (none) | **Adopt** — watch for background job completion |
| `src/runs/background/notify.ts` | `session-lifecycle/notifications.ts` | **Complementary** — pi-subagents' notify is subagent-specific |
| `src/runs/background/run-status.ts` | (none) | **Adopt** — inspect subagent status |
| `src/runs/background/subagent-runner.ts` | (none) | **Adopt** — background pi process runner |
| `src/runs/background/parallel-groups.ts` | (none) | **Adopt** — parallel group management |
| `src/runs/background/completion-dedupe.ts` | (none) | **Adopt** — deduplicate completion events |
| `src/runs/background/stale-run-reconciler.ts` | (none) | **Adopt** — handle stale background runs |
| `src/runs/background/top-level-async.ts` | (none) | **Adopt** — top-level async dispatch |
| `src/runs/shared/` (10 files) | (various partial) | **Adopt** — shared run utilities (pi-args, pi-spawn, worktree, model-fallback, etc.) |

### TUI (`src/tui/`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/tui/render.ts` | `ralph-loop/ralph-render.ts` | **Replace** — pi-subagents has richer TUI rendering (widget, animations, progress bars) |
| `src/tui/render-helpers.ts` | (none) | **Adopt** — TUI helper utilities |
| `src/tui/subagents-status.ts` | (none) | **Adopt** — status display component |
| `src/tui/text-editor.ts` | (none) | **Adopt** — TUI text editor for editing agent configs |

### Slash Commands (`src/slash/`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/slash/slash-commands.ts` | (partial — ralph-loop has no slash commands) | **Adopt** — `/run`, `/agents`, `/doctor`, `/status` |
| `src/slash/slash-bridge.ts` | (none) | **Adopt** — bridge from slash commands to subagent |
| `src/slash/slash-live-state.ts` | (none) | **Adopt** — live state tracking for slash results |
| `src/slash/prompt-template-bridge.ts` | (none) | **Adopt** — prompt template delegation |

### Shared Utilities (`src/shared/`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/shared/artifacts.ts` | `authoring/output-artifacts/` | **Complementary** — subagent-specific artifact management |
| `src/shared/types.ts` | `ralph-loop/ralph-types.ts` | **Replace** — pi-subagents types are much richer |
| `src/shared/atomic-json.ts` | (none) | **Adopt** — atomic JSON file writes |
| `src/shared/file-coalescer.ts` | (none) | **Adopt** — coalesced file writes |
| `src/shared/formatters.ts` | (none) | **Adopt** — formatting utilities |
| `src/shared/fork-context.ts` | (none) | **Adopt** — session forking for subagents |
| `src/shared/jsonl-writer.ts` | (none) | **Adopt** — JSONL session log writer |
| `src/shared/model-info.ts` | (none) | **Adopt** — model metadata resolution |
| `src/shared/session-identity.ts` | (none) | **Adopt** — session ID resolution |
| `src/shared/session-tokens.ts` | (none) | **Adopt** — token counting |
| `src/shared/settings.ts` | (none) | **Adopt** — config file management |
| `src/shared/utils.ts` | (none) | **Adopt** — general utilities |

### Intercom (`src/intercom/`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/intercom/intercom-bridge.ts` | (none) | **Adopt** — child↔parent agent communication |
| `src/intercom/result-intercom.ts` | (none) | **Adopt** — result-based intercom |

### Manager UI (`src/manager-ui/`)

| pi-subagents Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/manager-ui/*` (6 files) | (none) | **Adopt** — TUI agent manager for browsing/editing agents |

### Agent Definitions (`agents/*.md`)

| pi-subagents File | pi-me Equivalent | Verdict |
|---|---|---|
| `agents/scout.md` | (none — pi-me has scout-like skills) | **Adopt** — dedicated agent config |
| `agents/researcher.md` | (none) | **Adopt** — researcher agent |
| `agents/planner.md` | `skills/writing-plans/` | **Complementary** — dedicated planner agent vs skill |
| `agents/worker.md` | (none — pi-me has ralph-loop worker) | **Adopt** — standardized worker config |
| `agents/reviewer.md` | `skills/requesting-code-review/` | **Complementary** — reviewer agent |
| `agents/oracle.md` | `core-tools/oracle.ts` (slash command) | **Merge** — combine oracle approaches |
| `agents/context-builder.md` | (none) | **Adopt** — context builder agent |
| `agents/delegate.md` | (none) | **Adopt** — general delegate agent |

### Prompts (`prompts/*.md`)

| pi-subagents File | pi-me Equivalent | Verdict |
|---|---|---|
| `prompts/parallel-context-build.md` | (none) | **Adopt** — parallel context building prompt |
| `prompts/parallel-cleanup.md` | (none) | **Adopt** — parallel cleanup prompt |
| `prompts/parallel-research.md` | (none) | **Adopt** — parallel research prompt |
| `prompts/parallel-review.md` | (none) | **Adopt** — parallel review prompt |
| `prompts/parallel-handoff-plan.md` | (none) | **Adopt** — handoff plan prompt |
| `prompts/gather-context-and-clarify.md` | (none) | **Adopt** — context clarification prompt |

---

## Adopted File Layout in pi-me

```
core-tools/subagent/                      # New directory for subagent extension
├── extension/index.ts                    # Main extension (tool registration, lifecycle)
├── extension/schemas.ts                  # TypeBox params for subagent tool
├── extension/control-notices.ts          # Control event handling
├── extension/doctor.ts                   # Diagnostics
├── agents/agents.ts                      # Agent discovery (replaces ralph-loop/agents.ts)
├── agents/agent-templates.ts             # Agent templates
├── agents/agent-selection.ts             # Scope merge logic
├── agents/agent-scope.ts                 # Directory resolution
├── agents/agent-serializer.ts            # Config serialization
├── agents/agent-management.ts            # CRUD operations
├── agents/chain-serializer.ts            # Chain serialization
├── agents/identity.ts                    # Naming utilities
├── agents/frontmatter.ts                 # YAML frontmatter parser
├── agents/skills.ts                      # Skill resolution
├── runs/foreground/subagent-executor.ts  # Foreground execution
├── runs/foreground/execution.ts          # Subagent spawn
├── runs/foreground/chain-execution.ts    # Chain pipeline
├── runs/foreground/chain-clarify.ts      # Chain preview TUI
├── runs/background/async-job-tracker.ts  # Background job tracking
├── runs/background/async-execution.ts    # Background execution
├── runs/background/async-resume.ts       # Resume jobs
├── runs/background/async-status.ts       # Status polling
├── runs/background/result-watcher.ts     # Completion watcher
├── runs/background/notify.ts             # Subagent notifications
├── runs/background/run-status.ts         # Status inspection
├── runs/background/subagent-runner.ts    # Pi process runner
├── runs/background/parallel-groups.ts    # Parallel groups
├── runs/background/completion-dedupe.ts  # Dedup events
├── runs/background/stale-run-reconciler.ts # Stale cleanup
├── runs/background/top-level-async.ts    # Top-level async
├── runs/shared/pi-args.ts                # Pi CLI argument building
├── runs/shared/pi-spawn.ts               # Pi process spawning
├── runs/shared/run-history.ts            # Run tracking
├── runs/shared/worktree.ts               # Git worktree setup
├── runs/shared/single-output.ts          # Output handling
├── runs/shared/model-fallback.ts         # Model fallback
├── runs/shared/subagent-control.ts       # Control events
├── runs/shared/subagent-prompt-runtime.ts # Prompt runtime
├── runs/shared/completion-guard.ts       # Completion guards
├── runs/shared/long-running-guard.ts     # Long-running detection
├── runs/shared/parallel-utils.ts         # Parallel utilities
├── tui/render.ts                         # TUI rendering (replaces ralph-loop/ralph-render.ts)
├── tui/render-helpers.ts                 # TUI helpers
├── tui/subagents-status.ts               # Status component
├── tui/text-editor.ts                    # Text editor component
├── slash/slash-commands.ts               # Slash command registration
├── slash/slash-bridge.ts                 # Slash→subagent bridge
├── slash/slash-live-state.ts             # Live state
├── slash/prompt-template-bridge.ts       # Prompt template bridge
├── intercom/intercom-bridge.ts           # Child↔parent communication
├── intercom/result-intercom.ts           # Result-based intercom
├── manager-ui/agent-manager.ts           # Agent manager TUI
├── manager-ui/agent-manager-list.ts      # Agent list
├── manager-ui/agent-manager-detail.ts    # Agent detail view
├── manager-ui/agent-manager-edit.ts      # Agent edit view
├── manager-ui/agent-manager-chain-detail.ts # Chain detail
├── manager-ui/agent-manager-parallel.ts  # Parallel config view
├── shared/types.ts                       # Types (replaces ralph-loop/ralph-types.ts)
├── shared/artifacts.ts                   # Artifact management
├── shared/atomic-json.ts                 # Atomic JSON writes
├── shared/file-coalescer.ts             # Coalesced writes
├── shared/formatters.ts                  # Formatting
├── shared/fork-context.ts               # Session fork
├── shared/jsonl-writer.ts               # JSONL logging
├── shared/model-info.ts                  # Model metadata
├── shared/session-identity.ts           # Session ID
├── shared/session-tokens.ts             # Token counting
├── shared/settings.ts                    # Config management
├── shared/utils.ts                       # Utilities
├── shared/post-exit-stdio-guard.ts      # Exit guard
└── tests/                                # Unit + integration tests
```

---

## Strategy

| Category | Decision | Rationale |
|---|---|---|
| **Unique to pi-subagents** | Adopt as-is | Agent management, background execution, slash commands, manager UI, intercom, TUI rendering |
| **Complementary with pi-me** | Merge into unified module | Combine ralph-loop(loop control) + sub-pi(subprocess dispatch) + pi-subagents(parallel/chain orchestration) into one unified subagent system |
| **pi-me has similar (pi-subagents better)** | Replace pi-me version | `agents.ts`, `ralph-types.ts` → types.ts, `ralph-render.ts` → tui/render.ts |
| **pi-me better / no overlap** | Skip | Nothing identified — pi-subagents is strictly a superset |

### Merge Plan for Overlapping Modules

1. **ralph-loop** → merged into `core-tools/subagent/`
   - ralph-loop's loop control (`ralph_loop` tool) maps to subagent's single + chain modes
   - ralph-loop's render helpers mapped to `tui/render.ts`
   - Keep `ralph_loop` tool name for backward compatibility, alias to subagent
   - ralph-loop's `agents.ts` replaced by pi-subagents' agent discovery

2. **sub-pi** → merged into `core-tools/subagent/`
   - sub-pi's `subpi()` exec function maps to pi-subagents' pi-spawn
   - sub-pi's skill integration (`sub-pi-skill`) maps to slash bridge + prompt template bridge
   - Keep `/sub-pi` skill accessible via slash alias

3. **oracle** (pi-me slash command) → integrated with pi-subagents' oracle agent
   - pi-subagents' `agents/oracle.md` agent definition + pi-me's `/oracle` slash command
   - Keep `/oracle` as alias for `subagent oracle`

### Optimization Opportunities

- **Replace child process spawns** in ralph-loop with pi-subagents' `pi-spawn.ts` (already well-designed)
- **Extract types** from large files into `shared/types.ts`
- **Merge config loading** — pi-subagents uses `~/.pi/agent/extensions/subagent/config.json`; integrate with pi-me's `shared/pi-config.ts` pattern
- **Remove redundant formatters** — pi-subagents has its own formatters; check against pi-me's existing formatters

### Dependencies to Add

- `typebox` — already a transitive dep (used in pi-subagents schemas, pi-me uses zod)
  → Decision: keep both or convert pi-subagents schemas to TypeBox (preferred — TypeBox is the pi ecosystem standard)
  → Actually, pi-me already has `zod` and `typebox` as deps via `@sinclair/typebox`. pi-subagents uses `typebox` (the standalone package, different from `@sinclair/typebox`). Need to verify compatibility.

---

## Implementation Steps

### Phase 1: Foundation

1. Copy all `src/shared/` files → `core-tools/subagent/shared/`
2. Copy all `src/extension/` files → `core-tools/subagent/extension/`
3. Copy all `src/agents/` files → `core-tools/subagent/agents/`
4. Copy all `src/runs/` files → `core-tools/subagent/runs/`
5. Copy all `src/tui/` files → `core-tools/subagent/tui/`
6. Copy all `src/slash/` files → `core-tools/subagent/slash/`
7. Copy all `src/intercom/` files → `core-tools/subagent/intercom/`
8. Copy all `src/manager-ui/` files → `core-tools/subagent/manager-ui/`
9. Copy agent definitions → `core-tools/subagent/agents/definitions/`
10. Copy prompts → `core-tools/subagent/prompts/`

### Phase 2: Merge

1. Replace `core-tools/ralph-loop/agents.ts` with new agent discovery system
2. Replace `core-tools/ralph-loop/ralph-types.ts` with new types
3. Replace `core-tools/ralph-loop/ralph-render.ts` with new TUI rendering
4. Merge ralph-loop loop control → subagent single/chain modes
5. Merge sub-pi's `subpi()` → pi-spawn
6. Create backward-compatible alias: `ralph_loop` → `subagent`
7. Integrate oracle slash command with oracle agent

### Phase 3: Cleanup

1. Remove deprecated `core-tools/ralph-loop/` files that were fully replaced
2. Remove deprecated `core-tools/sub-pi/` if fully merged
3. Update `package.json` `pi.extensions` — add subagent entry, remove old ones
4. Update tests for merged modules

### Phase 4: Tests

1. Port unit tests from pi-subagents test suite
2. Add integration tests for merged ralph-loop + sub-pi + subagent modes
3. Run `npm test` — fix regressions

### Phase 5: Documentation

1. Add `skills/subagent/SKILL.md` referencing the new tool
2. Update `skills/ralph-loop/SKILL.md` to point to subagent
3. Update `README.md`

---

## Migration Notes

### Backward Compatibility

| Old Tool/Command | New Path | Status |
|---|---|---|
| `ralph_loop(agent, task, ...)` | `subagent(agent, task, ...)` with same params | Aliased — both work |
| `/sub-pi` | Built into subagent's slash commands | Aliased |
| `/oracle` | Maps to subagent oracle agent | Retained |
| `sub-pi` tool in system prompt | merged into subagent tool description | Updated |

### Config File Migration

- Old: `~/.pi/agent/extensions/sub-pi/config.jsonc`
- New: `~/.pi/agent/extensions/subagent/config.json`

### What to Remove After Migration

- `core-tools/sub-pi/` — fully replaced
- `core-tools/ralph-loop/agents.ts` — replaced
- `core-tools/ralph-loop/ralph-types.ts` — replaced
- `core-tools/ralph-loop/ralph-render.ts` — replaced

---

## Skill Mapping

| pi-subagents Feature | pi-me Skill Equivalent |
|---|---|
| Builtin agent: scout | (add `skills/scout/SKILL.md`) |
| Builtin agent: researcher | (add `skills/researcher/SKILL.md`) |
| Builtin agent: planner | `skills/writing-plans/SKILL.md` (update) |
| Builtin agent: worker | `skills/ralph-loop/SKILL.md` (update) |
| Builtin agent: reviewer | `skills/requesting-code-review/SKILL.md` (update) |
| Builtin agent: oracle | `skills/oracle/SKILL.md` (update) |

---

## Effort Estimate

| Phase | Files | Est. Effort |
|---|---|---|
| Copy & foundation | ~60 files | 1 day |
| Merge ralph-loop | ~6 files | 0.5 day |
| Merge sub-pi | ~4 files | 0.5 day |
| Merge oracle | ~2 files | 0.25 day |
| Cleanup old modules | ~10 files | 0.25 day |
| Tests | ~50 tests | 1 day |
| Documentation | ~5 files | 0.5 day |
| **Total** | | **~4 days** |

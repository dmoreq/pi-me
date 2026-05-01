# pi-hooks → pi-me Adoption & Optimization Plan

**Branch:** `adopt-plugin`  
**Date:** 2026-05-01  
**Status:** Proposal

---

## Executive Summary

`pi-hooks` (https://github.com/prateekmedia/pi-hooks) is a community package of 7 pi extensions. `pi-me` is our own package of 17 extensions. The two codebases have some overlapping functionality but are largely complementary. This plan proposes adoption of all pi-hooks extensions into pi-me with optimizations and strategic refactoring of overlap areas.

---

## 1. Functionality Comparison Matrix

### 1.1 Direct Overlap

| pi-hooks Extension | pi-me Equivalent | Overlap Assessment |
|---|---|---|
| `checkpoint` (~1700 lines) | `git-checkpoint` (~60 lines) | **Same purpose.** pi-hooks checkpoint is vastly more capable — captures tracked + staged + untracked files, persists as git refs, full restore UI. pi-me's is a minimal `git stash create` wrapper. |
| `permission` (~2500 lines) | `permission-gate` (~80 lines) + `protected-paths` (~120 lines) | **Partial overlap.** Different design philosophies: pi-hooks is tier-based (minimal→high), pi-me is pattern-based safety nets for dangerous commands and sensitive paths. |

### 1.2 Unique to pi-hooks (No pi-me Equivalent)

| Extension | Lines | Description | Verdict |
|---|---|---|---|
| `lsp` (hook) | ~800 | Auto-diagnostics: runs LSP diagnostics at agent end or after each edit/write | **Adopt** |
| `lsp` (tool) | ~700 | On-demand LSP queries: definition, references, hover, symbols, rename, code actions | **Adopt** |
| `ralph-loop` | ~2000 | Looped subagent execution with steering/follow-up/pause/resume controls | **Adopt** |
| `repeat` | ~600 | Replay past bash/edit/write tool calls with type-to-search UI | **Adopt** |
| `token-rate` | ~60 | Shows TPS (tokens per second) in footer status line | **Adopt** |

### 1.3 Unique to pi-me (No pi-hooks Equivalent)

| Extension | Lines | Description | Verdict |
|---|---|---|---|
| `secrets` | ~350 | Secret obfuscation via plain/regex patterns in `secrets.yml` | **Keep** |
| `context-window` | ~90 | Context usage bar widget with warn/critical thresholds | **Keep** |
| `auto-compact` | ~60 | Automatic context compaction at threshold | **Keep** |
| `session-name` | ~60 | Auto-names sessions from first user message | **Keep** |
| `web-search` | ~80 | Web search via Brave/SerpAPI/Kagi backends | **Keep** |
| `todo` | ~150 | Stateful todo tracker with branch-persistent state | **Keep** |
| `calc` | ~80 | Safe math expression evaluator with sandboxing | **Keep** |
| `ask` | ~50 | Follow-up question tool (text/confirm/choice) | **Keep** |
| `notebook` | ~90 | Jupyter notebook (.ipynb) cell read/edit/insert/delete | **Keep** |
| `github` | ~120 | GitHub API tool (issues, PRs, search, files) | **Keep** |
| `mermaid` | ~70 | Mermaid diagram rendering via mmdc | **Keep** |
| `commit-helper` | ~100 | `/commit` command + `commit_message` tool | **Keep** |
| `skill-bootstrap` | ~140 | `/bootstrap-skill` project scan + SKILL.md generator | **Keep** |
| `output-artifacts` | ~90 | Truncated output → disk artifact storage + read tool interception | **Keep** |

---

## 2. Optimization Analysis

### 2.1 Overlap: Checkpoint

**pi-hooks `checkpoint` strengths:**
- Captures tracked files (HEAD tree), staged files (index tree), AND untracked files (worktree tree) into a git commit on a dedicated ref (`refs/pi-checkpoints/`)
- Persists across sessions (git refs survive restarts)
- Saves current state before restore (never loses work)
- Three restore modes: files+conversation, conversation only, files only
- Handles large file/dir exclusion (>10 MiB files, >200 files per dir, ignores `node_modules`, `.venv`, `dist`, etc.)
- Sliding window cleanup: prunes old checkpoints beyond 10 per session, max 50 per branch
- Restore prompt on `session_before_fork`, `session_before_tree`, and manual `/checkpoint` command
- Named checkpoints via `/checkpoint.identify`

**pi-me `git-checkpoint` limitations:**
- Only uses `git stash create` (loses untracked files on restore)
- No persistence (stash refs are ephemeral)
- No restore-mode options
- No size/dir filtering
- No cleanup/pruning
- No fork/tree integration

**Optimization opportunities in pi-hooks checkpoint:**
- `parseArgs()` duplicates logic from `shell-quote` (already a dependency); could use shell-quote directly
- `readFirstLine()` uses `spawn("head", ...)` — simpler to use `fs.readFileSync` + split for line 1
- `getSessionIdFromFile()` has two implementations (inline and in `updateSessionInfo`); deduplicate
- `loadAllCheckpoints()` does batch loading (3 at a time) for low-priority mode; batch size could be configurable
- Inline type definitions duplicate `@mariozechner/pi-coding-agent` exports

**Verdict:** Replace pi-me's `git-checkpoint` entirely with pi-hooks `checkpoint`. Optimize `parseArgs` and `readFirstLine`.

### 2.2 Overlap: Permission / Protection

**pi-hooks `permission` design:**
- Tier system: minimal (read-only) → low (file ops) → medium (dev ops) → high (full)
- Comprehensive command classification: 100+ categorized command patterns
- Shell injection detection (backticks, `$()`, shell metacharacters)
- Persistent global + session-level settings
- Write/edit protection integrated (at low tier)
- Mode: ask vs block
- Non-interactive mode fallback

**pi-me `permission-gate` + `protected-paths` design:**
- `permission-gate`: Pattern-based dangerous command detection (18 patterns: sudo, rm -rf, fork bomb, pipe-to-shell, etc.)
- `protected-paths`: Glob-based file write protection (`.env`, `*.key`, lock files, etc.)
- Both are safety nets, not access control
- No tier system
- No non-interactive fallback granularity

**These solve different problems:**
- pi-hooks: "What should the agent be _allowed_ to do at all?" (access control)
- pi-me: "What is _always dangerous_ regardless of context?" (safety net)

**Optimization opportunities:**
- pi-hooks permission-core.ts uses `parse()` from `shell-quote` for command parsing but also implements `parseCommand()` inline — could simplify
- pi-hooks classifies commands into 4 tiers with massive regex tables. Many patterns are unused/rare. Could trim to common ones.
- pi-hooks permission has large inline regex cache management; the `getCachedRegex()`/`regexCache` could be extracted

**Proposal:** Merge into a unified `permission` extension with two layers:
1. **Tier system** (from pi-hooks): access control — minimal/low/medium/high
2. **Hard safety nets** (from pi-me): always-on dangerous command detection + protected path write protection

This gives users the best of both worlds: configurable tier-based access + unbypassable safety nets.

### 2.3 Unique: LSP

**pi-hooks LSP is the largest extension (~3500 lines total):**
- `lsp-core.ts` (~1500 lines): LSP server lifecycle, client management, diagnostics, queries
- `lsp.ts` (~800 lines): Hook extension — auto-diagnostics at agent_end or per-edit
- `lsp-tool.ts` (~700 lines): Tool extension — on-demand queries

**Supported language servers:** Dart, TypeScript/JavaScript, Vue, Svelte, Python (pyright), Go (gopls), Kotlin (kotlin-ls), Swift (sourcekit-lsp), Rust (rust-analyzer), Astro

**Optimization opportunities:**
- Large inline type definitions (repeated from vscode-languageserver-protocol) — could import directly
- `findRoot()` logic is duplicated across server configs
- Server warm-up (touching `.dart`/`.ts` files on startup) is aggressive and unnecessary
- Diagnostics timeout table is hardcoded per extension; could be configurable via `/lsp` command
- Idle shutdown timer (2 min) is hardcoded

**Verdict:** Adopt as-is. The code is well-structured but large. Optimization can happen incrementally.

### 2.4 Unique: Ralph Loop

**Pi-hooks `ralph-loop` (~2000 lines):**
- Single-mode and chain-mode subagent execution
- Condition-driven loop (bash command or inferred)
- Interactive steering/followup/pause/resume/stop commands
- Agent discovery (user/project/both scopes) from `.md` frontmatter files
- Model/provider lookup via `pi --list-models`
- Session file persistence for subagent results
- Rich TUI rendering with steering/followup panels

**Optimization opportunities:**
- `agents.ts` has `parseFrontmatter()` reimplemented; could use a standard YAML library if needed
- `lookupProviderForModel()` uses `spawnSync` which blocks; acceptable for one-time call but suboptimal
- Session file reconstruction for viewer is complex and fragile
- Default `conditionCommand` inference from task text is heuristic-based

**Verdict:** Adopt as-is. Minimal optimization needed.

### 2.5 Unique: Repeat

**Pi-hooks `repeat` (~600 lines):**
- Collects past bash/edit/write calls from branch history
- `/repeat` command with type-to-search SelectList UI
- Bash: loads as `!command` in editor
- Write: opens `$EDITOR` temp file, applies on save
- Edit: either re-executes or opens `$EDITOR` at first changed line

**Optimization opportunities:**
- `splitCommand()` reimplements shell-quote parsing; `shell-quote` is already a dependency
- `buildEditorInvocation()` hardcodes terminal editor list for `+line` handling
- Uses inline `createEditTool`/`createWriteTool` — depends on pi runtime APIs being stable

**Verdict:** Adopt as-is.

### 2.6 Unique: Token Rate

**Pi-hooks `token-rate` (~60 lines):**
- Tracks cumulative output tokens and elapsed time across turns
- Shows average TPS in footer status line
- Resets on session_start/session_switch

**Optimization opportunities:**
- None significant. This is a minimal, clean extension.

**Verdict:** Adopt as-is.

---

## 3. Refactoring Plan

### Phase 1: Adopt Unique Extensions (No Conflicts)

Copy the following from pi-hooks into pi-me with minor path adjustments:

```
pi-hooks/                        → pi-me/
  lsp/lsp.ts                     → foundation/lsp/lsp-hook.ts
  lsp/lsp-tool.ts                → foundation/lsp/lsp-tool.ts
  lsp/lsp-core.ts                → foundation/lsp/lsp-core.ts
  ralph-loop/ralph-loop.ts       → core-tools/ralph-loop.ts
  ralph-loop/agents.ts           → core-tools/ralph-loop-agents.ts
  ralph-loop/types.d.ts          → core-tools/ralph-loop-types.d.ts
  token-rate/token-rate.ts       → session-lifecycle/token-rate.ts
  repeat/repeat.ts               → content-tools/repeat.ts
  repeat/types.d.ts              → content-tools/repeat-types.d.ts
```

Add to `package.json`:
- `shell-quote` and `vscode-languageserver-protocol` as dependencies
- Register new extensions in `pi.extensions` array

### Phase 2: Replace/Refactor Overlapping Extensions

#### 2a. Checkpoint

1. **Delete** `pi-me/session-lifecycle/git-checkpoint/git-checkpoint.ts`
2. **Adopt** `pi-hooks/checkpoint/checkpoint.ts` and `checkpoint-core.ts` → `pi-me/session-lifecycle/git-checkpoint/`
3. **Optimize** `checkpoint-core.ts`:
   - Replace `parseArgs()` with `shell-quote` (already a dependency)
   - Replace `readFirstLine` → `spawn("head", ...)` with `fs.readFileSync` + line split
   - Deduplicate `getSessionIdFromFile` implementations (two exist)
4. Keep `checkpoint/tests/` for test coverage

#### 2b. Permission → Unified Permission + Safety

1. **Adopt** `pi-hooks/permission/permission.ts` and `permission-core.ts` → `pi-me/foundation/permission/`
2. **Merge** `pi-me/permission-gate/patterns.ts` dangerous patterns into permission-core's classification system as a hard safety layer (unbypassable dangerous commands)
3. **Merge** `pi-me/protected-paths/path-guard.ts` glob-based protection into permission as a file-write safety layer
4. **Optimize** permission-core.ts:
   - Extract regex cache to a shared utility
   - Remove unused/rare command patterns from classification tables
   - Simplify `parseCommand()` to use shell-quote's `parse()` directly
5. **Delete** standalone `pi-me/foundation/permission-gate/` and `pi-me/foundation/protected-paths/`

### Phase 3: Integration & Polish

1. Update `package.json` to register all extensions in correct load order:
   - Foundation first (secrets, permission, lsp)
   - Session lifecycle (checkpoint, auto-compact, session-name, token-rate)
   - Core tools (web-search, todo, calc, ask, ralph-loop)
   - Content tools (notebook, mermaid, github, repeat)
   - Authoring (commit-helper, skill-bootstrap, output-artifacts)

2. Update skill documentation files to reflect new tool availability

3. Add `.gitignore` entries for LSP cache and checkpoint refs

---

## 4. File Structure After Adoption

```
pi-me/
├── package.json                          # Updated with all extensions + deps
├── foundation/
│   ├── secrets/                          # [KEEP]
│   │   ├── secrets.ts
│   │   ├── obfuscator.ts
│   │   ├── loader.ts
│   │   ├── regex.ts
│   │   └── types.ts
│   ├── permission/                       # [MERGED from pi-hooks + pi-me]
│   │   ├── permission.ts                 # Unified: tier system + safety nets
│   │   ├── permission-core.ts            # Command classification + patterns
│   │   ├── path-guard.ts                 # From pi-me protected-paths
│   │   └── tests/
│   ├── lsp/                              # [NEW from pi-hooks]
│   │   ├── lsp-hook.ts                   # Auto-diagnostics hook
│   │   ├── lsp-tool.ts                   # On-demand LSP tool
│   │   ├── lsp-core.ts                   # LSP client management
│   │   └── tests/
│   └── context-window/                   # [KEEP]
│       └── context-window.ts
├── session-lifecycle/
│   ├── git-checkpoint/                   # [REPLACED with pi-hooks version]
│   │   ├── checkpoint.ts
│   │   ├── checkpoint-core.ts
│   │   └── tests/
│   ├── auto-compact/                     # [KEEP]
│   │   └── auto-compact.ts
│   ├── session-name/                     # [KEEP]
│   │   └── session-name.ts
│   └── token-rate/                       # [NEW from pi-hooks]
│       └── token-rate.ts
├── core-tools/
│   ├── web-search.ts                     # [KEEP]
│   ├── todo.ts                           # [KEEP]
│   ├── calc.ts                           # [KEEP]
│   ├── ask.ts                            # [KEEP]
│   ├── ralph-loop.ts                     # [NEW from pi-hooks]
│   ├── ralph-loop-agents.ts              # [NEW from pi-hooks]
│   └── ralph-loop-types.d.ts            # [NEW from pi-hooks]
├── content-tools/
│   ├── notebook.ts                       # [KEEP]
│   ├── mermaid.ts                        # [KEEP]
│   ├── github.ts                         # [KEEP]
│   ├── repeat.ts                         # [NEW from pi-hooks]
│   └── repeat-types.d.ts                # [NEW from pi-hooks]
├── authoring/
│   ├── commit-helper/                    # [KEEP]
│   │   └── commit-helper.ts
│   ├── skill-bootstrap/                  # [KEEP]
│   │   └── skill-bootstrap.ts
│   └── output-artifacts/                 # [KEEP]
│       └── output-artifacts.ts
├── skills/                               # [KEEP]
│   ├── commit-helper/SKILL.md
│   ├── secrets/SKILL.md
│   ├── output-artifacts/SKILL.md
│   └── skill-bootstrap/SKILL.md
└── tests/                                # [KEEP]
```

---

## 5. Extension Count Summary

| | Before | After |
|---|---|---|
| pi-me extensions | 17 | 23 |
| pi-hooks extensions adopted | 0 | 6 |
| Extensions removed (pi-me) | 0 | 2 (permission-gate, protected-paths → merged into permission) |
| Net new tools/hooks | — | +5 tools (LSP, ralph-loop, repeat, token-rate, enhanced checkpoint) |

---

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| LSP server spawn failures | Medium | pi-hooks has error handling + idle shutdown; add `try/catch` on startup |
| Checkpoint restore corrupts working tree | High | pi-hooks saves state before restore; keep existing test suite |
| Permission merge breaks command classification | Medium | Keep pi-me patterns as hard safety layer (always-on); tests |
| Ralph-loop subagent exhaustion | Low | maxIterations config + abort signal handling already implemented |
| `vscode-languageserver-protocol` peer dependency on Node types | Low | Already a dependency of pi-hooks; add to pi-me `peerDependencies` |
| Repeat tool reliance on pi runtime internals (`createEditTool`) | Medium | Test against latest pi version; add runtime version check |

---

## 7. Migration Steps (Ordered)

1. **Create `adopt-plugin` branch** ✅ (done)
2. **Copy LSP extension files** and register in package.json
3. **Copy ralph-loop files** and register in package.json
4. **Copy token-rate** and register in package.json
5. **Copy repeat** and register in package.json
6. **Replace git-checkpoint** with pi-hooks checkpoint
7. **Merge permission systems** into unified permission
8. **Update package.json** dependencies and extension list
9. **Update skills** to document new tools
10. **Test** each extension in isolation
11. **Integration test** full stack
12. **Review** → **Merge** to main

---

## 8. Key Optimization Wins

| Optimization | File | Impact |
|---|---|---|
| Use `shell-quote.parse()` instead of `parseArgs()` | checkpoint-core.ts | Removes ~20 lines of custom parsing |
| Use `fs.readFileSync` instead of `spawn("head")` | checkpoint.ts | Simpler, faster, no child process |
| Deduplicate `getSessionIdFromFile` | checkpoint.ts | Removes ~30 duplicate lines |
| Extract shared regex cache | permission-core.ts | Reusable across extensions |
| Merge dangerous patterns as hard safety layer | permission.ts | Single permission extension instead of 3 |
| Remove unused command patterns | permission-core.ts | Smaller classification table |

---

## 9. Questions for Discussion

1. **Permission default level:** pi-hooks defaults to `minimal` (read-only). Should pi-me adopt this or keep a more permissive default?
2. **LSP auto-diagnostics:** Defaults to `agent_end`. Should we keep this or change to `edit_write` for faster feedback?
3. **Checkpoint cleanup:** 10 per session, max 50 per branch. Are these limits appropriate?
4. **Ralph-loop default agent scope:** `"user"` or `"both"` (user + project agents)?
5. **Token-rate vs context-window:** Both show in status bar. Could they conflict? Should token-rate be a sub-widget of context-window?

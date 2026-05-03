# Adopt pi-lens Features into pi-me

**Date:** 2026-05-03  
**Status:** Draft  
**Based on:** pi-lens at `/Users/quy.doan/Workspace/personal/pi-lens` (~48K LOC)

---

## Overview

Extract 6 high-value, self-contained features from pi-lens and integrate them into pi-me's modular extension architecture. Each feature fills a clear gap in pi-me's current capabilities.

**Principle:** Extract only the feature, not the architecture. Where pi-lens uses a heavy dispatch/fact/runner system, we write a standalone implementation that follows pi-me's simpler patterns.

---

## Feature 1 — Read-Before-Edit Guard

**Source:** `pi-lens/clients/read-guard.ts`, `read-guard-logger.ts`, `read-guard-tool-lines.ts`, `file-time.ts`  
**Target:** `pi-me/core-tools/read-guard/`  
**Priority:** P0 — High value, self-contained, fixes real bug class

### What it does
- Tracks every file read (offset, limit, enclosing symbol)
- Checks every edit against read history at `tool_call` time
- Blocks edits that: have no prior read, touch stale files, or target unread ranges
- Provides `/lens-allow-edit <path>` override command
- Supplies statistics for health dashboard

### Implementation

**New files:**

| File | Source | Purpose |
|------|--------|---------|
| `core-tools/read-guard/guard.ts` | `read-guard.ts` | `ReadGuard` class with `recordRead()`, `checkEdit()`, `isNewFile()` |
| `core-tools/read-guard/logger.ts` | `read-guard-logger.ts` | Optional debug logging of guard events |
| `core-tools/read-guard/file-time.ts` | `file-time.ts` | Tracks file mtime to detect stale reads |
| `core-tools/read-guard/lines.ts` | `read-guard-tool-lines.ts` | Extracts touched lines from edit events |
| `core-tools/read-guard/index.ts` | — | Extension entry: registers tool_call handler + `/read-guard-allow` command |

**Simplifications vs pi-lens:**
- No LSP expansion exemption (no tree-sitter client in pi-me yet)
- No `--no-read-guard` flag (flag system doesn't exist in pi-me yet)
- Use `shared/profile.ts` for config, not a separate `ReadGuardConfig`
- Exempt `.md`, `.txt`, `.log` by default (same as pi-lens)

**Integration in core-tools umbrella:**
- Register guard in `core-tools/index.ts` subset B (full profile only)
- Hook into `tool_call` event to record reads and check edits
- Register `/read-guard-allow` command
- Return `{ block: true, reason: "..." }` on guard violation

### Testing
- Unit tests for: zero-read, stale-file, out-of-range, exemption, new-file
- Test with mock `tool_call` events

---

## Feature 2 — Secrets Scanner (Write-Time)

**Source:** `pi-lens/clients/secrets-scanner.ts`  
**Target:** `pi-me/foundation/secrets/` (extend existing module)  
**Priority:** P1 — High value, tiny code, natural extension of `foundation/secrets`

### What it does
- Scans file content for secret patterns (API keys, tokens, private keys) at write time
- Pattern detection: Stripe/OpenAI `sk-*`, GitHub `ghp_*`, AWS `AKIA*`, Slack `xox*`, private keys, hardcoded passwords
- Skips test files, filters HTTP header false positives, filters env-var-name values
- Returns block with line-level findings

### Implementation

**Modified file:**
- `foundation/secrets/secrets.ts` — add `scanForSecrets(content, filePath)` function

**New file:**
- `foundation/secrets/scanner.ts` — extracted from pi-lens `secrets-scanner.ts` (~175 lines)

Or simpler: **inline the ~175 lines directly into `foundation/secrets/secrets.ts`** since secrets is already 350+ lines and the scanner is a cohesive addition.

**Integration:**
- Called from the tool_call handler on write events (same hook as read-guard)
- Returns `{ block: true, reason: formatSecrets(...) }` when secrets found
- Available to all profiles (foundation is always loaded)

### Testing
- Unit tests for each pattern type
- False positive tests (HTTP headers, env var names)
- Test file exclusion

---

## Feature 3 — AST-grep as Registered Tool

**Source:** `pi-lens/tools/ast-grep-search.ts`, `ast-grep-replace.ts`, `shared.ts`  
**Target:** `pi-me/core-tools/ast-grep-tool/`  
**Priority:** P1 — Converts skill into discoverable tool

### What it does
- Registers `ast_grep_search` and `ast_grep_replace` as pi tools (auto-discoverable by LLM)
- Provides structured parameters (pattern, lang, paths, selector, context)
- Validates input (rejects plain text / rule YAML passed as AST patterns)
- Uses pi-me's existing ast-grep infrastructure via `pi-sherlock-ast-grep` skill

### Implementation

**New files:**

| File | Source | Purpose |
|------|--------|---------|
| `core-tools/ast-grep-tool/search.ts` | `ast-grep-search.ts` | Tool definition with Type params + execute handler |
| `core-tools/ast-grep-tool/replace.ts` | `ast-grep-replace.ts` | Replace tool definition |
| `core-tools/ast-grep-tool/shared.ts` | `shared.ts` | `LANGUAGES` constant + helpers |
| `core-tools/ast-grep-tool/index.ts` | — | Extension entry: registers both tools |

**Simplifications vs pi-lens:**
- pi-lens uses a custom `AstGrepClient` class with auto-install + `SgRunner`. pi-me should wrap the existing `@mariozechner/pi-coding-agent` ast-grep APIs or shell out to `sg` CLI directly.
- pi-lens has `ensureAvailable()` auto-install. pi-me should just fail gracefully if `sg` is not found.
- No YAML rule support (pi-me's semgrep handles that).

**Integration in core-tools:**
- Register both tools in `core-tools/index.ts` subset B (full profile only)
- Register `/ast-grep` command that delegates to the skill

### Testing
- Tool registration smoke test
- Mock execute handler for basic pattern matching
- Verify error output for missing CLI

---

## Feature 4 — `/code-review` Command (Booboo)

**Source:** `pi-lens/commands/booboo.ts`, `complexity-client.ts`, `todo-scanner.ts`, `project-index.ts`  
**Target:** `pi-me/core-tools/code-review/`  
**Priority:** P1 — Integrated codebase health assessment

### What it does
- Scans the entire project and reports:
  - **Complexity hotspots** — cognitive complexity, cyclomatic complexity, nesting depth
  - **AI slop signals** — placeholder comments, unnecessary wrappers, error swallowing
  - **TODO/FIXME/HACK inventory** — count and categorize markers
  - **Dead code** — via knip (if available) or basic export analysis
  - **Duplicates** — via pi-me's built-in `find_duplicates` tool
  - **Type coverage** — TypeScript strictness gaps
  - **Technical Debt Index (TDI)** — composite score (0–100)
- Saves report to `.pi/reviews/<timestamp>.md`

### Implementation

**New files:**

| File | Purpose |
|------|---------|
| `core-tools/code-review/index.ts` | Extension entry: registers `/code-review` command |
| `core-tools/code-review/complexity.ts` | Cognitive/cyclomatic complexity analysis (standalone, ~200 lines) |
| `core-tools/code-review/todo-scanner.ts` | Scan for TODO/FIXME/HACK with severity classification (~100 lines) |
| `core-tools/code-review/tdi.ts` | Technical Debt Index calculator (~150 lines) |
| `core-tools/code-review/reporter.ts` | Formats report and saves to `.pi/reviews/` (~100 lines) |

**Simplifications vs pi-lens's booboo:**
- No dispatch/fact system — run checks sequentially
- No production-readiness validation
- No knip integration (pi-me doesn't have knip) — skip dead-code analysis
- No type-coverage analysis (pi-me doesn't have type-coverage client)
- No review-graph or cascade analysis
- **But:** use pi-me's existing `find_duplicates` tool, `semgrep` skill, and `ast-grep` tool
- Save report to `.pi/reviews/` instead of `.pi-lens/reviews/`

**Integration:**
- Register `/code-review` command in `core-tools/index.ts` subset B (full profile only)
- Optional: register `/code-review-tdi` standalone command

### Testing
- Unit tests for complexity analysis
- Unit tests for TODO scanner
- Integration test: run on pi-me itself

---

## Feature 5 — Structural Similarity Check on Write

**Source:** pi-lens `index.ts` `tool_call` handler (inline export-redefinition + similarity check)  
**Target:** Inline in `core-tools/read-guard/guard.ts`  
**Priority:** P2 — Cheap wins, low code volume

### What it does
- Two checks triggered on write/edit:
  1. **Export redefinition:** detects if new content defines a function/class/const that already exists in another file → blocks with "import instead" guidance
  2. **Structural similarity (advisory):** detects if a new function is >90% similar to an existing function in the project → warns

### Implementation
- **Export redefinition check:** ~50 lines, pure regex (`export\s+(?:async\s+)?(?:function|class|const|let|type|interface)\s+(\w+)`)
- **Structural similarity check:** ~100 lines, uses simple token-count-based Jaccard similarity (not full state-matrix from pi-lens)

**Integration:**
- Add export-redefinition check as a block in the read-guard's edit handler
- Add similarity check as a non-blocking advisory (warn, not block)
- Build `cachedExports` map at startup by scanning all source files

### Testing
- Unit test: redefining existing export is blocked
- Unit test: new export on unique name is allowed
- Unit test: similar function triggers advisory

---

## Feature 6 — Post-Write Auto-Fix Pipeline

**Source:** `pi-lens/clients/pipeline.ts` (steps 2–3), `tool-policy.ts`  
**Target:** Extend `pi-me/core-tools/formatter/`  
**Priority:** P2 — Extends existing formatter

### What it does
After each write/edit, run:
1. Secrets scan (→ Feature 2, already blocks before write)
2. Auto-format (pi-me's existing `formatter` handles this)
3. **Auto-fix** — run Biome `--fix`, Ruff `--fix`, ESLint `--fix` on the written file

### Implementation

**Modified files:**
- `core-tools/formatter/extensions/formatter/dispatch.ts` — add auto-fix step after format
- `core-tools/formatter/extensions/formatter/runners/biome.ts` — add `--fix` variant
- `core-tools/formatter/extensions/formatter/runners/ruff-format.ts` — add `--fix` variant
- `core-tools/formatter/extensions/formatter/runners/eslint.ts` — add `--fix` variant

**New files:**
- `core-tools/formatter/extensions/formatter/autofix.ts` — auto-fix policy (which tools to run, config detection)

**Simplifications vs pi-lens:**
- No cascade diagnostics (too coupled to LSP)
- No test runner on write (too expensive, might surprise user)
- No format service abstraction — use pi-me's existing `formatFile()` directly

**Integration:**
- Auto-fix runs after format in the `formatter` extension's existing post-write handler
- Configurable via settings (disabled by default, opt-in with `"autoFix": true`)

---

## Execution Order

```
Phase 1 — Core defensive features (P0)
  ├── Feature 1: Read-Before-Edit Guard
  └── Feature 2: Secrets Scanner (inline in foundation/secrets/)

Phase 2 — Developer tooling (P1)
  ├── Feature 3: AST-grep as registered tool
  └── Feature 4: /code-review command

Phase 3 — Polish (P2)
  ├── Feature 5: Structural similarity check (inline in guard)
  └── Feature 6: Post-write auto-fix pipeline (extend formatter)
```

---

## What Does NOT Change

| Aspect | Status |
|--------|--------|
| Existing pi-me extensions | ✅ Unchanged |
| Tool names / slash commands | ✅ Unchanged (new commands added only) |
| Test files | ✅ Unchanged (new tests added) |
| `package.json` extension entries | ✅ Unchanged (features go into existing umbrellas) |
| pi-lens source | ✅ Unchanged — extract, don't modify |

---

## Dependencies Between Features

```
Feature 1 (read-guard)    → sets up tool_call hook that Features 2, 5 reuse
Feature 2 (secrets)       → independent, inline in foundation/
Feature 3 (ast-grep tool) → independent
Feature 4 (code-review)   → uses Feature 3 (ast-grep tool) for slop detection
Feature 5 (similarity)    → depends on Feature 1's tool_call hook
Feature 6 (autofix)       → extends existing formatter, independent
```

Phases are designed to be independently shippable.

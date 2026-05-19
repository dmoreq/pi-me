# smart-commit Architecture

This document describes the design and implementation of the `smart-commit` extension.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User runs /commit                        │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  [git.ts] listDirtyFiles() → git status --porcelain=v1          │
│  Returns: DirtyFile[] { absPath, relPath, status, staged }      │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  [grouper.ts] groupDirtyFiles() → CommitGroup[]                 │
│  ├─ Compute scope path (first 2 segments of relPath)            │
│  ├─ Group files by scope path                                   │
│  ├─ Derive conventional-commit scope from scope path            │
│  └─ Sort: by file count (desc), then alphabetically             │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
    ┌──────────────────────────────────────────────────────────┐
    │ For each CommitGroup (sequential, one LLM round per):    │
    └──────────────────────┬───────────────────────────────────┘
                           ▼
    ┌─────────────────────────────────────────────────────────┐
    │  [quality.ts] runQualityOnFiles() → QualityResult[]      │
    │  ├─ formatFile(pi, cwd, file)                            │
    │  │  ├─ Formatter discovery (biome, prettier, etc.)       │
    │  │  └─ Optional: may skip if tool unavailable            │
    │  └─ for each FixRunner:                                  │
    │     ├─ biome check --write                               │
    │     ├─ eslint --fix                                      │
    │     └─ ruff check --fix                                  │
    │        └─ Optional: may skip if config not found         │
    └──────────────────────┬───────────────────────────────────┘
                           ▼
    ┌─────────────────────────────────────────────────────────┐
    │  [git.ts] stageFiles() → git add -- <files>              │
    └──────────────────────┬───────────────────────────────────┘
                           ▼
    ┌─────────────────────────────────────────────────────────┐
    │  [git.ts] getDiffStatForFiles() + getDiffForFiles()      │
    │  ├─ git diff --cached --stat                             │
    │  └─ git diff --cached (truncate to 8000 chars)           │
    └──────────────────────┬───────────────────────────────────┘
                           ▼
    ┌─────────────────────────────────────────────────────────┐
    │  [prompt.ts] buildCommitPrompt()                         │
    │  └─ Build LLM prompt: files + diff + quality notes       │
    │                                                           │
    │  Contents:                                                │
    │  ├─ Conventional commit format instructions              │
    │  ├─ Files in group with status labels                   │
    │  ├─ Diff --stat output                                   │
    │  ├─ Quality changes (formatted, fixed)                   │
    │  ├─ Diff body (first 6000 chars)                         │
    │  └─ Instruction to call commit_message tool              │
    └──────────────────────┬───────────────────────────────────┘
                           ▼
    ┌─────────────────────────────────────────────────────────┐
    │  [index.ts] pi.sendUserMessage(prompt)                   │
    │  └─ LLM responds with conventional commit message        │
    │                                                           │
    │  LLM then calls: commit_message tool                     │
    └──────────────────────┬───────────────────────────────────┘
                           ▼
    ┌─────────────────────────────────────────────────────────┐
    │  commit_message Tool Execute                              │
    │  ├─ Validate message: matches conventional format        │
    │  ├─ If invalid: return error, LLM retries                │
    │  └─ If valid: run git commit -m <message>                │
    │     ├─ Return SHA on success                             │
    │     └─ Return error on git failure                       │
    └──────────────────────┬───────────────────────────────────┘
                           ▼
    ┌──────────────────────────────────────────────────────────┐
    │ Continue with next group (back to quality stage)  OR      │
    │ All groups committed → return and wait for next /commit   │
    └──────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### `types.ts`
Defines all TypeScript interfaces:
- `DirtyFile` — a single changed file (status, path, staged flag)
- `CommitGroup` — a logical group of files with a scope
- `QualityResult` — result of format+fix on one file
- `CommitResult` — overall result of one group's commit

### `git.ts`
Pure git command abstractions. All functions:
- Take `cwd: string` parameter (working directory for git commands)
- Execute via `execFile("git", ...)` with 30s timeout, 10MB buffer
- Throw on non-zero exit (except safe variants return `""`)
- Accept relative paths (relative to repo root)

Key functions:
- `getRepoRoot(cwd)` — `git rev-parse --show-toplevel`
- `listDirtyFiles(cwd, repoRoot)` — `git status --porcelain=v1 -u`
- `stageFiles(paths, cwd)` — `git add -- <paths>`
- `getDiffForFiles(relPaths, cwd)` — `git diff --cached -- <paths>`
- `commitWithMessage(message, cwd)` — `git commit -m <message>`
- `isValidConventionalCommit(message)` — regex validation before commit

### `grouper.ts`
Pure functional grouping logic (no I/O, no side effects).

**Algorithm:**
1. Parse each file's relPath into segments by `/`
2. Take first two segments as "scope path"
   - `core-tools/memory/src/store.ts` → `core-tools/memory`
   - `README.md` → `root`
3. Group files by scope path using `Map`
4. Derive conventional-commit scope:
   - Take the last meaningful segment of the scope path
   - `core-tools/memory` → scope: `memory`
   - `root` → scope: `` (empty)
5. Sort groups:
   - Primary: by file count descending (larger groups first)
   - Secondary: alphabetically by label

**Properties:**
- **Deterministic**: same input always produces same output
- **Stable**: order of input files doesn't affect grouping
- **Fast**: O(n) for n files, O(g log g) for g groups

### `quality.ts`
Orchestrates format + lint-fix.

**Architecture:**
```
for each non-deleted file:
  ├─ formatFile(pi, cwd, file, timeout)
  │  └─ Delegates to code-quality/runners/formatter/dispatch.ts
  │     ├─ Try project formatters (treefmt, treefmt-nix)
  │     └─ Fall back to per-language formatters
  │
  └─ for each FixRunner (biome, eslint, ruff):
     ├─ Check if runner.isAvailable(file, cwd)
     │  └─ Looks for config file (biome.json, .eslintrc, pyproject.toml, etc.)
     └─ Run runner.fix(file, timeout)
        └─ Calls tool with --fix/--write flag
```

**Error handling:**
- Failures (exit != 0) are caught and logged as warnings
- Warnings are included in QualityResult.errors[]
- Never blocks the commit

**Imports from code-quality:**
- `formatFile()` from `runners/formatter/dispatch.ts`
- `FIX_RUNNERS` from `runners/fix/index.ts` (array of: biomeFix, eslintFix, ruffFix)

### `prompt.ts`
Pure string builder for LLM prompts.

**Input:**
- `group: CommitGroup` — files, scope, label
- `diffStat: string` — output of `git diff --cached --stat`
- `diffBody: string` — truncated output of `git diff --cached`
- `quality: QualityResult[]` — format+fix results

**Output:**
- A multi-section markdown prompt:
  1. Format instructions (conventional commit spec)
  2. File list with status labels (added, modified, deleted)
  3. Diff summary (--stat)
  4. Quality notes (only if changes occurred)
  5. Diff body (truncated to 6000 chars)
  6. Instruction to call `commit_message` tool

**No side effects**, pure string concatenation.

### `index.ts`
Extension registration and command/tool implementation.

**Command: `/commit`**
- Handler orchestrates the full pipeline
- Sequential: one group at a time
- Calls `pi.sendUserMessage(prompt)` to start the LLM round
- Returns after first group (LLM drives subsequent groups via tool calls)

**Tool: `commit_message`**
- Validates message via `isValidConventionalCommit()`
- If invalid: returns error, LLM retries
- If valid: runs `git commit -m <message>`
- Returns SHA and details on success

## Data Flow

### File states during /commit

```
Initial (dirty):
  ├─ core-tools/memory/store.ts     (M, unstaged or staged)
  ├─ core-tools/memory/index.ts     (A, unstaged or staged)
  ├─ README.md                       (M, unstaged or staged)

After grouping:
  ├─ Group "core-tools/memory"
  │  ├─ file: core-tools/memory/store.ts
  │  ├─ file: core-tools/memory/index.ts
  │
  └─ Group "root"
     └─ file: README.md

After quality (format + fix):
  ├─ Group "core-tools/memory"
  │  ├─ core-tools/memory/store.ts (formatted, fixed)
  │  ├─ core-tools/memory/index.ts (formatted, fixed)
  │
  └─ Group "root"
     └─ README.md (formatted, fixed)

After staging:
  ├─ Group "core-tools/memory"
  │  ├─ core-tools/memory/store.ts (staged)
  │  ├─ core-tools/memory/index.ts (staged)
  │
  └─ Group "root"
     └─ README.md (staged)

After commit (Group 1):
  ├─ core-tools/memory/store.ts     (committed, SHA=abc123...)
  ├─ core-tools/memory/index.ts     (committed, SHA=abc123...)
  │
  └─ README.md                       (still staged, not yet committed)
     └─ Waiting for next /commit for Group "root"
```

## Error Handling

### Quality tool failures
Caught at line `try/catch` in `runQualityOnFile()`. Errors logged in `QualityResult.errors[]`. Commit always proceeds.

### Git command failures
Caught at `execFile` callback. Non-zero exit throws `Error`. Caller (command handler) can catch and report.

### Message validation failures
Checked at `commit_message` tool entry. If regex fails, return error object (not throw). LLM sees error and can retry with corrected message.

### Large diffs
Truncated by `getDiffForFiles()` to 8000 chars (tool output limit). Full diff is shown in the LLM prompt (no limit).

### Missing git
Caught at `getRepoRoot()` — throws if not in a git repo.

## Performance Characteristics

| Operation | Complexity | Time |
|-----------|------------|------|
| `listDirtyFiles()` | O(n) | ~100ms for 1000 files |
| `groupDirtyFiles()` | O(n log g) | ~5ms for 1000 files |
| `runQualityOnFiles()` | O(n * t) | ~1-5s per file (depends on formatters) |
| `buildCommitPrompt()` | O(n) | <1ms |

Note: Format+fix dominates the pipeline.

## Testing Strategy

### Unit tests (no I/O, pure functions)
- `grouper.test.ts` — determinism, sorting, edge cases
- `git.test.ts` — message validation regex
- `prompt.test.ts` — prompt structure and content

### Integration tests (realistic multi-group workflows)
- `integration.test.ts` — grouping + quality + prompts for realistic scenarios
- Validates sorting, scope derivation, prompt completeness

### Validation tests (error handling, boundaries)
- `validation.test.ts` — edge cases, special characters, large inputs, boundary conditions
- Verifies robustness (no crashes on edge inputs)

### Total: 83 tests across 5 files, all passing

## Extension Points

### Adding a new fixer
1. Create a new file in `runners/fix/` (e.g., `myfix.ts`)
2. Export a `FixRunner` object
3. Add to `FIX_RUNNERS` array in `runners/fix/index.ts`
4. No changes needed to `smart-commit/` — `runQualityOnFiles()` dynamically iterates `FIX_RUNNERS`

### Adding a new formatter
1. Create a new `RunnerDefinition` in `runners/formatter/runners/`
2. Add to `RUNNERS` in `runners/formatter/runners/index.ts`
3. Add format plan entries in `runners/formatter/plan.ts`
4. Again, no changes to `smart-commit/` — `formatFile()` handles discovery

### Changing grouping logic
Edit `grouper.ts`. Grouping is pure, so changes are easy to test.

### Changing commit message prompt
Edit `prompt.ts`. Prompt is pure, so changes can be tested in isolation.

## Security Considerations

### Git command execution
- All `execFile` calls use explicit argument arrays (not string concatenation)
- Timeout prevents hung processes (30s)
- Buffer limit prevents memory exhaustion (10MB)

### Message validation
- Before committing, message is validated against strict regex
- LLM is not trusted to produce valid format

### File path handling
- Paths are read from `git status` output (git-controlled)
- Paths are passed as explicit arguments to `git add`, `git diff`, `git commit` (not interpolated into shell strings)

## Future Improvements

### Batch LLM mode
Currently, one `sendUserMessage` per group. Could batch all groups into one LLM call and execute commits sequentially.

### Dry-run mode
Add a flag to preview commits without actually running `git commit`.

### Filtering
Add `--only <scope>` to commit only one group.

### Custom hooks
Before/after commit scripts or plugins.

### Recency-based grouping
Group by last-modified time instead of path (for more logical boundaries).

## Debugging

### Enable logging
Edit `index.ts` to add `console.log()` statements in the command handler.

### Test specific group
Edit `integration.test.ts` to isolate one scenario.

### Manual git workflow
For troubleshooting, `smart-commit` is essentially:
```bash
git status --porcelain=v1 -u
# group files
# format + fix each file
git add -- <files for group 1>
git diff --cached
# (LLM proposes message)
git commit -m "<message>"
# repeat for remaining groups
```

You can run these commands manually to understand what `smart-commit` is doing.

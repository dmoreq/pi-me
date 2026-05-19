# Plan: `smart-commit` — Group → Format → Fix → Commit

## 1. Goal

Replace three separate tools with a single **`smart-commit`** extension that:

1. Discovers all dirty files and **groups them by logical scope** (package/directory boundary)
2. For each group, runs **auto-format + auto-fix lint** (reusing code-quality runners)
3. Stages the cleaned files and commits each group with an **LLM-generated conventional commit message**
4. Exposes a `commit_message` tool so the LLM can read diff details when building its message

After the new extension is verified, **delete**:
- `content-tools/github.ts` (and remove its registration from `content-tools/index.ts`)
- `authoring/commit-helper/` (entire directory) + remove from `authoring/index.ts`; if `authoring/` becomes empty, delete it too
- `core-tools/code-quality/` (entire directory) + remove from `core-tools/index.ts`

---

## 2. What We Keep From Each Source

| Source | What we reuse | What we discard |
|--------|--------------|-----------------|
| `authoring/commit-helper/commit-helper.ts` | `execGit()` pattern (Promise wrapper around `execFile`), `buildCommitPrompt()` structure, `commit_message` tool shape | `getDiffs()` — replaced by per-group staging; the `/commit` command handler — replaced wholesale |
| `content-tools/github.ts` | Nothing code-wise — it's a GitHub REST tool unrelated to local commits. Its `ok()`/`err()` helper pattern is useful style. | Everything; the tool is deleted entirely |
| `core-tools/code-quality/` | `formatFile()` from `runners/formatter/dispatch.ts`, `FIX_RUNNERS` (biome/eslint/ruff), `findConfigFileFromPath()` from `runners/formatter/context.ts`, `FixRunner` interface | `CodeQualityPipeline`, `RunnerRegistry`, `CodeQualityExtension` — all replaced by direct calls in the new module's pipeline helper |

---

## 3. Architecture of the New Extension

```
core-tools/smart-commit/
├── index.ts            — registerSmartCommit(pi): registers /commit command + commit_message tool
├── git.ts              — all git primitives (execGit, listDirtyFiles, stageFiles, commitFiles, getDiffForFiles)
├── grouper.ts          — group dirty files into logical commit groups
├── quality.ts          — run format + fix on a list of files (thin wrapper over formatFile + FIX_RUNNERS)
├── prompt.ts           — buildCommitPrompt(group, diffStat) → string sent to LLM
└── types.ts            — CommitGroup, DirtyFile, QualityResult
```

Registered from `core-tools/index.ts` (replaces both `code-quality` and the `authoring` commit-helper).

---

## 4. Detailed Component Design

### 4.1 `types.ts`

```ts
export interface DirtyFile {
  absPath: string;     // absolute path
  relPath: string;     // relative to repo root
  status: "M" | "A" | "D" | "R" | "?";  // git status XY
  staged: boolean;
}

export interface CommitGroup {
  label: string;         // human-readable: e.g. "core-tools/memory"
  files: DirtyFile[];
  scope: string;         // conventional-commit scope derived from label
}

export interface QualityResult {
  file: string;
  formatted: boolean;
  fixed: boolean;
  fixCount: number;
  errors: string[];
}

export interface CommitResult {
  group: CommitGroup;
  quality: QualityResult[];
  committed: boolean;
  sha?: string;
  message?: string;
  error?: string;
}
```

### 4.2 `git.ts`

Functions (all async, all take `cwd: string`):

```ts
execGit(args: string[], cwd: string): Promise<string>
  // Promise-wrapped execFile, 30s timeout, 10MB buffer
  // Throws on non-zero exit (unlike original which swallowed errors)

listDirtyFiles(cwd: string): Promise<DirtyFile[]>
  // Runs: git status --porcelain=v1 -u
  // Parses each line: XY path → DirtyFile
  // Includes both staged and unstaged; marks staged=true if X != ' ' and X != '?'
  // Skips deleted files (status D) from format/fix, includes them in commit group

getRepoRoot(cwd: string): Promise<string>
  // git rev-parse --show-toplevel

getDiffStatForFiles(files: string[], cwd: string): Promise<string>
  // git diff --cached --stat -- <files>
  // Used to build the commit prompt

getDiffForFiles(files: string[], cwd: string): Promise<string>
  // git diff --cached -- <files>, sliced to 8000 chars
  // Used as tool output for commit_message tool

stageFiles(files: string[], cwd: string): Promise<void>
  // git add -- <files>

commitWithMessage(message: string, cwd: string): Promise<string>
  // git commit -m <message>
  // Returns the new commit SHA (git rev-parse HEAD)

hasAnyStagedFiles(cwd: string): Promise<boolean>
  // git diff --cached --quiet → exit 1 means staged changes exist
```

### 4.3 `grouper.ts`

**Grouping strategy** — deterministic, no LLM needed:

```
Algorithm:
  1. Get repo root
  2. For each dirty file, compute its "scope path":
     - Strip repo root prefix from absPath
     - Take the first two path segments (e.g. "core-tools/memory" from "core-tools/memory/src/store.ts")
     - If only one segment exists, use it as-is
     - Special case: files directly in repo root get scope "root"
  3. Group files by scope path
  4. Sort groups: larger groups first, then alphabetically
  5. For each group, derive conventional-commit scope:
     - Remove common prefixes ("core-tools/" → keep rest, "src/" → keep parent)
     - Kebab-case the last meaningful segment
     - e.g. "core-tools/memory" → scope "memory"
     - e.g. "authoring/commit-helper" → scope "commit-helper"
     - e.g. "root" → no scope (commit message has no parentheses)
```

```ts
groupDirtyFiles(files: DirtyFile[], repoRoot: string): CommitGroup[]
```

### 4.4 `quality.ts`

Thin orchestrator that calls the two existing systems for a list of files:

```ts
async function runQualityOnFiles(
  files: DirtyFile[],
  repoRoot: string,
  pi: ExtensionAPI,
): Promise<QualityResult[]>
```

**Per file** (only for non-deleted files):
1. Call `formatFile(pi, repoRoot, file.absPath, 30_000)` from `runners/formatter/dispatch.ts`
2. For each `FixRunner` in `FIX_RUNNERS`: call `runner.fix(file.absPath, 30_000)` if `runner.isAvailable(file.absPath, repoRoot)`
3. Collect results into `QualityResult`

Note: `findConfigFileFromPath` in the fix runners uses synchronous calls internally — we keep this as-is.

### 4.5 `prompt.ts`

```ts
buildCommitPrompt(group: CommitGroup, diffStat: string, diffBody: string): string
```

Produces a prompt that:
- States the conventional commit format requirement
- Lists the files in the group with their status
- Shows the `--stat` summary
- Shows the diff body (truncated to 6000 chars)
- Instructs the LLM to reply with **only** the commit message (no markdown, no explanation)
- Scope is pre-filled: `"Use scope: ${group.scope}"` (or "no scope" if root-level)

### 4.6 `index.ts` — Command & Tool Registration

```ts
export function registerSmartCommit(pi: ExtensionAPI): void
```

**`/commit` command** (no args):

```
Handler flow:
  1. ui.setStatus("smart-commit", "🔍 Scanning changes...")
  2. repoRoot = await getRepoRoot(cwd)
  3. dirty = await listDirtyFiles(cwd)
  4. if dirty.length === 0 → notify "Nothing to commit" and return
  5. groups = groupDirtyFiles(dirty, repoRoot)
  6. ui.setStatus("smart-commit", `📦 ${groups.length} group(s) found`)
  7. For each group (sequentially):
     a. ui.setStatus("smart-commit", `⚙️  Formatting & fixing: ${group.label}`)
     b. quality = await runQualityOnFiles(group.files.filter(not-deleted), repoRoot, pi)
     c. await stageFiles(group.files.map(f => f.absPath), cwd)
     d. diffStat = await getDiffStatForFiles(...)
     e. diffBody = await getDiffForFiles(...)
     f. prompt = buildCommitPrompt(group, diffStat, diffBody)
     g. ui.setStatus("smart-commit", `🤖 Generating commit message for: ${group.label}`)
     h. pi.sendUserMessage(prompt)
        — At this point the LLM will call commit_message tool and then
          produce a commit message. The agent then calls the commit_message tool
          to do the actual commit.
  8. ui.setStatus("smart-commit", "✅ Done")
```

> **Key design choice**: the `/commit` command sends one prompt per group sequentially. The LLM reads the diff via the `commit_message` tool, produces the message, and we let the agent handle the actual `git commit` call (or the tool does it — see tool design below).

**`commit_message` tool**:

```ts
parameters: {
  message: string           // the generated conventional commit message
  include_unstaged?: boolean  // default false — include unstaged in diff output for LLM review
}

execute:
  1. diff = await getDiffForFiles(stagedFiles, cwd, include_unstaged)
  2. Run: git commit -m <message>
  3. sha = await getLatestSHA(cwd)
  4. Return: { committed: true, sha, message, diffStats }
```

This makes the tool **actionable** — when the LLM produces a commit message it invokes the tool, the tool commits, and returns the SHA. No round-trip where the human has to run `git commit` manually.

---

## 5. File-by-File Implementation Plan

### Step 1 — Create `core-tools/smart-commit/types.ts`
Define `DirtyFile`, `CommitGroup`, `QualityResult`, `CommitResult`.

### Step 2 — Create `core-tools/smart-commit/git.ts`
Implement all git primitives. Unit-testable (no ExtensionAPI dep).

### Step 3 — Create `core-tools/smart-commit/grouper.ts`
Implement `groupDirtyFiles()`. Pure function, easily unit-tested.

### Step 4 — Create `core-tools/smart-commit/quality.ts`
Implement `runQualityOnFiles()`. Imports `formatFile` and `FIX_RUNNERS` directly from `code-quality/runners/`.

### Step 5 — Create `core-tools/smart-commit/prompt.ts`
Implement `buildCommitPrompt()`. Pure function.

### Step 6 — Create `core-tools/smart-commit/index.ts`
Wire command + tool. Imports from all above modules.

### Step 7 — Wire into `core-tools/index.ts`
Add `import smartCommit from "./smart-commit/index.ts"` and `smartCommit(pi)`.
Remove `import codeQuality` and `codeQuality(pi)`.

### Step 8 — Wire into `authoring/index.ts`
Remove `commitHelper(pi)` and its import. If file only has boilerplate left, delete `authoring/index.ts` and `authoring/` directory.

### Step 9 — Delete source files
- `authoring/commit-helper/commit-helper.ts`
- `authoring/commit-helper/` directory
- `authoring/index.ts` (and `authoring/` if empty)
- `content-tools/github.ts` + remove from `content-tools/index.ts`
- `core-tools/code-quality/` entire directory

### Step 10 — Update `core-tools/index.ts` telemetry block
Replace `code-quality` tool registration with `smart-commit`.

### Step 11 — Write tests
- `smart-commit/grouper.test.ts` — grouping logic
- `smart-commit/git.test.ts` — mock-based tests for git primitive parsing
- `smart-commit/prompt.test.ts` — prompt format correctness

---

## 6. Edge Cases & Decisions

| Case | Decision |
|------|----------|
| Deleted files (`D`) | Include in commit group, skip format/fix, still stage with `git add` (git stages deletions) |
| Untracked files (`?`) | Include in commit group (stage them), run format+fix before staging |
| Binary files | `formatFile` returns silently for unrecognized kinds; fix runners check config existence |
| Format/fix failure | Log warning, continue — never block commit due to tool failure |
| Empty diff after format | Stage anyway; formatter may have introduced whitespace changes git already knows about |
| Single file in group | Still commits separately with its own message |
| `git commit` failure (nothing to commit) | Catch error, skip group, warn user |
| LLM produces bad message | Tool validates: must match `/^(feat|fix|docs|style|refactor|test|chore|perf|ci)(\(.+\))?: .{3,}/` — if invalid, return error so LLM can retry |
| Repo root vs. sub-directory cwd | Always use `getRepoRoot()` for grouping; use actual `cwd` for git operations |

---

## 7. What Is NOT Carried Over

| Dropped feature | Reason |
|----------------|--------|
| `content-tools/github.ts` GitHub tool | Entirely unrelated to commit workflow; separate concern |
| `CodeQualityExtension` auto-format on write/edit | Still exists implicitly — the formatter runs in `smart-commit/quality.ts`. But the always-on write/edit hook is no longer a standalone extension. If always-on behavior is wanted later, it can be re-added as a separate one-liner hook. |
| `/cq-format`, `/cq-fix`, `/cq-status` toggle commands | Not needed in the new model; format+fix always runs per commit group |
| `CodeQualityPipeline` and `RunnerRegistry` abstractions | Overkill for direct use; replaced by direct calls in `quality.ts` |
| `getDiffs()` showing unstaged in command | New model stages per-group first, then diffs; unstaged don't appear in commit groups |

---

## 8. Commit Plan for the Implementation Itself

Once implemented, commit as:

```
feat(smart-commit): add group → format → fix → commit pipeline
refactor: remove code-quality, commit-helper, github.ts (replaced by smart-commit)
```

Two commits: one adding the feature, one doing the deletions.

---

## 9. Open Questions (resolve before implementing)

1. **Sequential vs parallel groups**: Should multiple groups be committed in one `/commit` invocation, or should the command commit one group and stop, letting the user run `/commit` again for the next? → **Recommendation: sequential in one run**, since the user invoked `/commit` to commit everything.

2. **LLM round-trip model**: The current design sends one `sendUserMessage` per group and relies on the LLM calling `commit_message` tool to finalize. Alternative: generate all messages in one LLM call (single prompt listing all groups + diffs), then loop through `git commit`. → **Recommendation: one prompt per group** for best message quality and clear responsibility.

3. **`content-tools/github.ts` deletion scope**: The file is only imported in `content-tools/index.ts`. After deletion, `content-tools/` still has `repeat/` and `web-tools/`. Only `github.ts` is removed; the module stays. → **Confirmed: only delete `github.ts` and remove its import/registration**.

# smart-commit

**Smart, group-aware git commits with auto-format and auto-fix**

The `/commit` command intelligently groups dirty files by scope, runs auto-formatting and lint-fixing on each group, stages the changes, and asks an LLM to generate a conventional commit message.

## Features

- 🎯 **Smart grouping**: Files are grouped by directory scope (first two path segments)
  - `core-tools/memory/src/store.ts` → group `core-tools/memory` with scope `memory`
  - `README.md` → group `root` with no scope
  - Each group gets its own commit with its own message

- ✨ **Auto-format & auto-fix**: Before staging, each file is:
  1. Passed through `formatFile()` (biome, prettier, eslint-format, etc.)
  2. Passed through fix runners (biome, eslint --fix, ruff --fix)
  3. Never blocks the commit if quality tools fail — failures are warnings

- 💬 **LLM-powered commits**: For each group, a conventional commit message is generated via LLM:
  - Includes the group's files and their status (added, modified, deleted)
  - Shows the diff summary (stat) and diff body
  - Includes quality changes applied (formatting, lint fixes)
  - Instructs the LLM to reply in conventional commit format

- 🛡️ **Message validation**: The `commit_message` tool validates the message follows conventional commit spec before running `git commit`

- 📊 **Zero-copy grouping**: Deterministic, stable grouping—same groups every time regardless of input order

## Usage

### Command: `/commit`

Discovers all dirty files, groups them, formats & fixes each group, then asks the LLM to generate a commit for each group.

```
/commit
```

**Output:**
- Groups dirty files
- Runs format + fix on each file
- Sends one LLM prompt per group
- Waits for LLM to call `commit_message` tool
- Tool commits with `git commit -m <message>`

**One prompt per group** — ensures high-quality commit messages for each logical scope.

### Tool: `commit_message`

Called by the LLM to commit staged changes with a generated conventional commit message.

**Parameters:**
- `message` (string, required): The conventional commit message to use
- `include_unstaged` (boolean, optional): Include unstaged files in the diff output (for review)

**Returns:**
- Success: commit SHA and the message that was committed
- Failure: validation or git error message

**Validation:**
The message must match: `^(feat|fix|docs|style|refactor|test|chore|perf|ci)(\(.+\))?: .{3,}`

Valid examples:
- `feat(memory): add prepared statement cache`
- `fix: handle empty input`
- `refactor(smart-commit): improve grouping logic`

Invalid examples:
- `add feature` — no type
- `feat: xy` — description too short (< 3 chars)
- `feat(): add` — empty scope
- `FEAT: add` — uppercase type

## Architecture

### Module structure

```
smart-commit/
├── types.ts          — DirtyFile, CommitGroup, QualityResult, CommitResult
├── git.ts            — All git primitives (execGit, listDirtyFiles, stageFiles, etc.)
├── grouper.ts        — Group dirty files by scope
├── quality.ts        — Run format + fix on files
├── prompt.ts         — Build LLM prompt for a group
└── index.ts          — Register /commit command and commit_message tool
```

### Pipeline

For each group:

```
1. runQualityOnFiles()
   ├─ formatFile(pi, cwd, file)           (optional: may skip if tool unavailable)
   └─ for each FixRunner: runner.fix()    (optional: may skip if config not found)
        ├─ biome check --write
        ├─ eslint --fix
        └─ ruff check --fix

2. stageFiles(group.files)
   └─ git add -- <files>

3. getDiffStatForFiles() + getDiffForFiles()
   └─ git diff --cached --stat
   └─ git diff --cached

4. buildCommitPrompt()
   └─ { files with status, diff stat, diff body, quality notes, instructions }

5. pi.sendUserMessage(prompt)
   └─ LLM responds with conventional commit message
   └─ LLM calls commit_message tool
   └─ Tool validates message and runs: git commit -m <message>
```

### Grouping algorithm

```
Input:  List of dirty files with relative paths
        (e.g. "core-tools/memory/src/store.ts")

1. Compute scope path = first two path segments
   "core-tools/memory/src/store.ts" → "core-tools/memory"
   "README.md" → "root"

2. Group files by scope path

3. Derive conventional-commit scope from scope path
   "core-tools/memory" → scope: "memory"
   "authoring/commit-helper" → scope: "commit-helper"
   "root" → scope: "" (empty)

4. Sort groups:
   - By file count descending (larger groups first)
   - Then alphabetically by label for determinism

Output: [ CommitGroup { label, scope, files }[] ]
```

**Deterministic**: The same input always produces the same grouping, regardless of order.

### Quality runner

Thin wrapper over the formatters and fixers from `code-quality/`:

- **Formatters**: biome, prettier, eslint-format, ruff-format, clang-format, shfmt, cmake-format, markdownlint
- **Fixers**: biome check --write, eslint --fix, ruff check --fix

Each file is passed to the formatters and fixers in sequence. Failures (exit code != 0) are logged as warnings but never block the commit.

## Configuration

smart-commit has no configuration file. It automatically discovers:

- **Formatters**: Uses existing project configs (biome.json, .prettierrc, .eslintrc, pyproject.toml, etc.)
- **Fixers**: Checks for config files; if found, runs the fixer

Example project structure:
```
my-project/
├── biome.json          ← triggers biome format + fix
├── .prettierrc          ← triggers prettier format
├── .eslintrc.js         ← triggers eslint format + fix
├── pyproject.toml       ← triggers ruff format + fix
└── src/
    └── ...
```

## Error Handling

### Quality tool failures

If a formatter or fixer crashes or exits with non-zero, the error is logged as a warning in the quality results, but the group's commit still proceeds. This is intentional—quality issues should never block a commit.

Example:
```
core-tools/memory/store.ts: eslint --fix: ESLintError: Config not found
→ Quality result includes the error
→ Prompt includes "⚠️ eslint --fix: ESLintError..."
→ Commit still proceeds
```

### Message validation

If the LLM-generated message doesn't match the conventional commit format, the `commit_message` tool returns an error. The LLM can then fix and retry.

Example validation error:
```
Error: Message does not follow conventional commit format
(type(scope): description). Got: "Added some stuff"
```

### Git failures

If `git commit` fails (e.g., nothing staged, commit message empty), the tool returns an error. The group's commit is skipped, and the agent can investigate or retry.

## Testing

Run the test suite:

```bash
cd core-tools
bun test smart-commit
```

**Test files:**
- `grouper.test.ts` — 8 tests for deterministic grouping
- `git.test.ts` — 17 tests for conventional commit validation
- `prompt.test.ts` — 8 tests for prompt generation
- `integration.test.ts` — 11 tests for realistic multi-group scenarios
- `validation.test.ts` — 30+ tests for edge cases, error handling, boundary conditions

**Coverage:**
- Grouping stability (determinism, sorting, edge cases)
- Conventional commit validation (all valid/invalid examples)
- Prompt generation (scopes, file statuses, quality notes)
- Integration (realistic multi-group workflows)
- Error handling (invalid input, large files, special characters)
- Boundary conditions (empty lists, large file counts)

**Total: 70+ tests, all passing**

## Migration from Old Systems

### From `/commit` (old commit-helper)

The old `/commit` command in `authoring/commit-helper/` is replaced:

**Old behavior:**
- Analyzed staged diffs
- Sent to LLM without formatting/fixing
- Generated one commit message for all staged changes

**New behavior:**
- Groups files by scope
- Auto-formats and auto-fixes each group
- Generates one commit message per group
- More granular, higher quality commits

**Migration:**
- Import `registerSmartCommit` from `core-tools/smart-commit/index.ts`
- Call `smartCommit(pi)` in your extension entry point
- Use `/commit` exactly as before (same syntax)

### From `code-quality` (old auto-format on write/edit)

The old always-on auto-format/fix on write/edit is replaced:

**Old behavior:**
- Every `write` or `edit` tool call triggered format + fix
- Results were logged but not committed

**New behavior:**
- Format + fix runs only when `/commit` is invoked
- Changes are staged and committed as part of the group
- More intentional—you control when quality tools run

**Migration:**
- If you want the old always-on behavior, register a separate hook on `tool_call` events
- For now, `/commit` is the explicit quality checkpoint before committing

## Known Limitations

1. **Sequential LLM rounds**: Each group gets one `sendUserMessage`, so the LLM drives the commit flow one group at a time. If you have many groups, multiple invocations of `/commit` are needed.

2. **Quality tool availability**: If a formatter or fixer isn't installed, it's skipped silently. The commit still proceeds.

3. **Large diffs**: Diffs are truncated to 8000 characters in the tool output. The full diff is shown in the LLM prompt before the tool is called.

## Future Enhancements

- [ ] Batch mode: generate all commit messages in one LLM call, then commit sequentially
- [ ] Dry-run: show what would be committed without actually committing
- [ ] Commit hooks: run custom scripts before/after commit
- [ ] Filtering: `--only <scope>` to commit only one group
- [ ] Interactive: show each commit's diff before confirming

## See Also

- `git.ts` — git primitives (execGit, listDirtyFiles, stageFiles, etc.)
- `grouper.ts` — grouping logic and conventional-commit scope derivation
- `quality.ts` — formatter and fixer orchestration
- `prompt.ts` — LLM prompt building

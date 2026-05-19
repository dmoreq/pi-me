# smart-commit Quick Start

Get started with smart group-aware commits in 5 minutes.

## Prerequisites

- Git repo with staged or unstaged changes
- `biome`, `eslint`, or `ruff` installed (optional; auto-formatting still works without them)

## Basic Usage

### 1. Start a commit workflow

```bash
/commit
```

The agent will:
1. Discover all dirty files
2. Group them by scope (first two path segments)
3. For the first group:
   - Auto-format and auto-fix each file
   - Stage the group
   - Show the diff to the LLM
   - Ask the LLM to generate a conventional commit message

### 2. LLM generates the commit message

The LLM will respond with a conventional commit message, e.g.:

```
feat(memory): add prepared statement cache

- Cache all 26 prepared statements as class fields
- Move Jaccard scan outside write lock
- Performance: eliminate 50+ prepare() recompiles per call
```

### 3. Confirm and commit

The LLM will call the `commit_message` tool, which:
- Validates the message (must match conventional format)
- Runs `git commit -m "<message>"`
- Returns the commit SHA

### 4. Repeat for remaining groups

If you have multiple groups, run `/commit` again to commit the next group.

## Examples

### Example 1: Single feature across two files

```
Dirty files:
  core-tools/memory/store.ts (M)
  core-tools/memory/index.ts (M)
  README.md (M)

Grouping:
  Group 1: core-tools/memory  (2 files)
  Group 2: root               (1 file)

Workflow:
  /commit
  → Auto-format + fix files in "core-tools/memory"
  → Prompt LLM for message
  → LLM proposes: "refactor(memory): optimize cache"
  → git commit -m "refactor(memory): optimize cache"
  → First group committed

  /commit
  → Auto-format + fix "README.md"
  → Prompt LLM for message
  → LLM proposes: "docs: update installation steps"
  → git commit -m "docs: update installation steps"
  → All groups committed
```

### Example 2: Multi-file refactor

```
Dirty files:
  core-tools/code-quality/extension.ts (M)
  core-tools/code-quality/pipeline.ts (M)
  core-tools/code-quality/runners/fix/biome.ts (M)
  core-tools/code-quality/types.ts (M)

Grouping:
  Group 1: core-tools/code-quality (4 files)

Workflow:
  /commit
  → Auto-format + fix all 4 files
  → Prompt: Shows all files modified in code-quality
  → LLM proposes: "refactor(code-quality): consolidate runner types"
  → Commit
```

### Example 3: Mixed operations (add + modify + delete)

```
Dirty files:
  src/auth/oauth.ts (A - added)
  src/auth/login.ts (M - modified)
  src/legacy/old-auth.ts (D - deleted)

Grouping:
  Group 1: src/auth (3 files - added, modified, deleted in same scope)

Workflow:
  /commit
  → Files listed as: [added], [modified], [deleted]
  → LLM sees the full context
  → LLM proposes: "feat(auth): migrate to OAuth2, remove legacy code"
  → Commit includes the add, modify, and delete
```

## Conventional Commit Format

The message must follow the format:

```
type(scope): description

optional body
optional footer
```

### Valid types:
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code refactoring
- `perf` — performance improvement
- `docs` — documentation
- `test` — tests
- `style` — code style (no logic change)
- `chore` — build/dependencies
- `ci` — CI/CD
- `revert` — revert a previous commit

### Valid scopes (auto-derived from group):
- `memory` (from "core-tools/memory")
- `code-quality` (from "core-tools/code-quality")
- empty (for root-level files like "README.md")

### Valid messages:
```
feat(memory): add prepared statement cache
fix: handle empty input
docs(readme): update installation
refactor(code-quality): consolidate runners
```

### Invalid messages (will be rejected):
```
Added some stuff          ✗ No type or colon
feat: xy                  ✗ Description too short
FEAT(memory): add         ✗ Type must be lowercase
feat(): add               ✗ Empty scope
```

If invalid, the LLM will see the error and retry with a corrected message.

## Common Workflows

### Committing all staged changes in one go

If all your staged changes belong to one scope (e.g., all in `src/auth/`):

```bash
/commit
→ LLM commits all at once
```

### Splitting commits by scope

If you have changes across multiple scopes, `smart-commit` automatically splits them:

```bash
/commit
→ Commit group 1 (e.g., core-tools/memory)
/commit
→ Commit group 2 (e.g., core-tools/smart-commit)
/commit
→ Commit group 3 (e.g., root)
```

### Formatting without committing

If you just want auto-format/fix without committing:

Currently, format/fix only runs as part of `/commit`. If you want standalone formatting, use the formatters directly:

```bash
biome check --write src/file.ts
eslint --fix src/file.ts
ruff check --fix src/file.py
```

In the future, we may add a `--dry-run` flag to preview without committing.

### Reviewing changes before commit

The LLM can see the full diff before proposing the message. The `commit_message` tool returns the new SHA, so you can verify the commit was created as expected.

For more detailed review, use:

```bash
git log -1 --stat
git show <SHA>
```

## Troubleshooting

### No dirty files detected

```
Nothing to commit — working tree is clean
```

Make sure you have staged or unstaged changes:

```bash
git status
git diff
git diff --cached
```

### Not inside a git repository

```
Error: Not inside a git repository
```

Run from within a git repo:

```bash
cd /path/to/repo
/commit
```

### Format/fix tool not found

If `biome`, `eslint`, or `ruff` is not installed:

```
⚠️ biome not available, skipping
```

This is not an error—the commit still proceeds. To install formatters:

```bash
# Node-based
npm install -D biome prettier eslint

# Python-based
pip install ruff
```

### Message validation failed

```
Error: Message does not follow conventional commit format
(type(scope): description). Got: "Added some stuff"
```

The LLM will retry with a corrected format. If it keeps failing, you can manually provide the message by having the LLM call the tool with a valid format.

### Git commit failed

```
Error: git commit failed: nothing to commit
```

This can happen if:
- The quality tools didn't actually change any files (no staged changes)
- All files in the group were deleted

Try running `/commit` again, or check what files are actually dirty:

```bash
git status
```

## Tips & Best Practices

### 1. Keep changes organized by scope

If all your changes are in one module (e.g., `core-tools/memory`), they'll group together and produce a focused commit. If they're scattered across multiple modules, you'll get multiple commits (which is better for history).

### 2. Stage intentionally

You can stage files strategically to control which files are included in each group's commit. For example, if you want to split a large refactor into two commits:

```bash
# Stage part 1
git add src/auth/oauth.ts src/auth/login.ts
/commit  # Commits part 1

# Stage part 2
git add src/legacy/old.ts
/commit  # Commits part 2
```

### 3. Trust the LLM's message quality

The LLM sees the full diff, file statuses, and quality changes. It usually produces high-quality, descriptive commit messages.

### 4. Review after commit

After each commit, the tool returns the SHA:

```
✅ Committed: abc123ef
refactor(memory): optimize cache
```

You can inspect it:

```bash
git show abc123ef
```

### 5. Multiple commits per session

You can invoke `/commit` multiple times in the same session. Each time, the next group is committed.

## Advanced: Customizing Formatters

smart-commit automatically detects and uses formatters based on project config:

- **Biome**: `biome.json` or `biome.jsonc`
- **Prettier**: `.prettierrc`, `.prettierrc.json`, etc.
- **ESLint**: `.eslintrc`, `.eslintrc.js`, `eslint.config.js`
- **Ruff**: `pyproject.toml`, `ruff.toml`, `.ruff.toml`

No configuration needed—just have the config file in your repo.

To customize:
1. Create/edit the config file for your formatter
2. Run `/commit`
3. Formatter will automatically pick up your config

Example: `biome.json`

```json
{
  "formatter": {
    "indentSize": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "style": {
        "useConst": "error"
      }
    }
  }
}
```

## See Also

- [README.md](./README.md) — Full feature overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and data flow

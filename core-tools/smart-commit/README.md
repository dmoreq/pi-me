# smart-commit

Group-aware git commits for Pi. The `/commit` command groups dirty files by scope, runs format/fix tooling, stages one group, and asks the LLM to create a conventional commit message. The `commit_message` tool then commits only that active group so unrelated staged files stay untouched.

## Features

- **Scoped commit groups**: groups files by the first two path segments, e.g. `core-tools/memory/src/store.ts` → `core-tools/memory` with commit scope `memory`.
- **Quality pass before staging**: runs existing formatter and fix runners for non-deleted files. Failures are reported as warnings, not blockers.
- **Conventional commit validation**: accepts standard types (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`), optional scopes, optional breaking-change `!`, 3–72 character subjects, and no trailing period.
- **Commit isolation**: when launched from `/commit`, `commit_message` uses a pathspec commit for the active group, leaving unrelated staged changes in the index.
- **Safe git status parsing**: uses porcelain `-z` output to preserve spaces, quotes, unicode, deletions, and rename destinations.

## Usage

```text
/commit
```

The command processes one group at a time:

1. Finds dirty files in the current git repo.
2. Groups them by directory scope.
3. Runs format/fix tools for the first group.
4. Stages that group.
5. Sends a prompt asking the LLM to call `commit_message`.
6. Commits only that group.

Run `/commit` again to process the next group.

## Tool

### `commit_message`

Commits staged changes with a validated conventional commit message.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `message` | string | Yes | Conventional commit message. |
| `include_unstaged` | boolean | No | Include the remaining unstaged diff for the active group in the tool result. |

When called after `/commit`, the tool uses the active smart-commit context and commits only that group's files. When called directly, it falls back to a normal staged commit in the current working directory.

## Development

Run smart-commit tests:

```sh
bun test core-tools/smart-commit
```

Module layout:

```text
smart-commit/
├── git.ts       # git status, diff, staging, commit helpers
├── grouper.ts   # dirty-file grouping and scope derivation
├── index.ts     # /commit command and commit_message tool registration
├── prompt.ts    # LLM prompt builder
├── quality.ts   # formatter/fixer orchestration
└── types.ts     # shared types
```

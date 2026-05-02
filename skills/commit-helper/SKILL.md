---
name: commit-helper
description: Commit message generation — use the commit_message tool for git diffs
---

# Commit Helper

This session has commit message generation available. The `commit_message` tool can analyze git diffs and propose conventional commit messages.

## How to Use

1. Check that the repository has staged changes (`git diff --cached --stat`)
2. Call `commit_message` to get the diff analysis
3. Review the changes and propose a conventional commit message

## Commit Message Format

Conventional commits: `type(scope): description`

- `feat(auth): add OAuth2 login support`
- `fix(parser): handle empty input gracefully`
- `docs(readme): update installation instructions`

### Valid Types

`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

## Rules

1. Always review the full diff before proposing a commit message
2. Use `include_unstaged: true` if unstaged changes are relevant
3. Keep descriptions under 72 characters for the subject line
4. Use imperative mood ("add" not "added" or "adds")

---
name: commit-helper
description: Use when preparing a git commit and you need the current conventional commit flow.
---

# Commit Helper

Use `/commit` for the interactive grouped flow. Use `commit_message` when the active staged group is ready to commit.

## Rules

1. Inspect the diff before calling `commit_message`.
2. `commit_message` validates conventional format and performs the commit.
3. Use `include_unstaged: true` only when unstaged changes matter.
4. Keep the subject imperative and under 72 chars.

## Format

`type(scope): description`

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

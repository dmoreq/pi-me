---
name: repeat-command
description: Use when you want to rerun, adjust, or recover a previous bash, edit, or write action.
---

# Repeat Command

Use `/repeat` to replay prior tool calls from the current session.

## When to use
- Re-run a prior command after a small fix
- Recover a previous edit/write flow
- Replay captured bash/edit/write actions
- Open a write/edit target in `$EDITOR` when available

## Notes
- Interactive UI required.
- It repeats captured `bash`, `edit`, and `write` calls.
- If `$EDITOR` is configured, you can edit before repeating.
- Best for quick recovery, not long automation.

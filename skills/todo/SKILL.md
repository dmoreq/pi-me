---
name: todo
description: Track multi-step progress with the todo list — create, update, list, delete tasks. Supports pending→in_progress→completed status, dependency tracking, and live overlay. Use for complex work with 3+ steps, when user gives a task list, or immediately after receiving instructions to capture requirements.
---

# Todo List

You have a `todo` tool for tracking multi-step progress. Tasks persist across
session compaction and reload — they replay from the conversation branch.

## When to Use

- Complex work with 3+ distinct steps
- User explicitly lists tasks ("do A, then B, then C")
- Immediately after receiving new instructions — capture requirements as tasks
- **Do NOT use** for single trivial tasks or purely conversational requests

## Task Lifecycle

Tasks follow a 4-state machine: `pending` → `in_progress` → `completed`, plus `deleted` as a tombstone.

## Rules

1. **One at a time** — Exactly one task `in_progress` at a time. Mark it `in_progress` BEFORE starting work.
2. **Complete immediately** — Mark `completed` as soon as done, never batch completions.
3. **Don't fake completion** — If tests fail, implementation is partial, or errors are unresolved, keep `in_progress` and create a new task for the blocker.
4. **Dependencies** — Use `blockedBy` to express "A is blocked by B". Cycles are rejected.
5. **Subject** — Short and imperative ("Research existing tool"). `description` is for detail. `activeForm` is the present-continuous label shown while in progress.

## Overlay

A live overlay shows your active task list above the editor. Auto-hides when empty.

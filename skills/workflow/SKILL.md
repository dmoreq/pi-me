---
name: workflow
description: Use when tracking multi-step work, background jobs, checklists, or command execution in Pi.
---

# Workflow

Use the `workflow` tool for persistent plans, checklists, shell jobs, and background execution.

## Use for
- 3+ step work
- tracked command execution
- background jobs
- progress/checklists
- review-required work

## Key actions
- `create`, `update`, `delete`, `list`, `get`
- `add-step`, `update-step`, `complete-step`, `skip-step`, `next-step`
- `run-step`, `run`, `run-command`, `run-bg`
- `job-list`, `job-status`, `job-cancel`

## Rules
- Keep exactly one active step when possible.
- Mark steps complete immediately.
- Don’t claim completion without fresh verification.
- Use `run-bg` for async jobs that need tracking.

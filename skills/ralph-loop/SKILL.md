---
description: Ralph Loop — looped subagent execution with steering controls
---

# Ralph Loop

This session has the `ralph_loop` tool for running subagent tasks in a loop.

## Usage

```
ralph_loop({ agent: "worker", task: "...", conditionCommand: "...", maxIterations: 5 }) 
```

## Parameters

- `agent` — Subagent name (defaults to "worker")
- `task` — Task for the subagent
- `conditionCommand` — Bash command; loop continues while output is "true"
- `maxIterations` — Max iterations (optional)
- `sleepMs` — Sleep between iterations (default 1000)
- `chain` — Array of {agent, task} for sequential execution
- `model` — Override model
- `thinking` — Thinking level: off, minimal, low, medium, high, xhigh

## Interactive Controls

While running: `/ralph-steer`, `/ralph-follow`, `/ralph-pause`, `/ralph-resume`, `/ralph-stop`, `/ralph-status`

## Rules

1. Use `conditionCommand` when you need to poll for a state change (e.g., "test -f build/done")
2. Use `chain` for multi-step tasks where output flows between agents
3. Set `maxIterations` as a safety limit for potentially infinite loops
4. Default `conditionCommand` infers from task text (e.g., "check 5 times" → loops 5 times)

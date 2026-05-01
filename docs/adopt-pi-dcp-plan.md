# Adoption Plan: pi-dcp (Dynamic Context Pruning)

## Overview

Adopt [pi-dcp](https://github.com/zenobi-us/pi-dcp) — a Dynamic Context Pruning extension — into pi-me. Adds intelligent message pruning (dedup, superseded writes, error purging, recency) to the existing auto-compact framework.

## Comparison Matrix

| pi-dcp Extension | pi-me Equivalent | Verdict |
|---|---|---|
| `index.ts` (main entry, config, event hooks, commands) | `session-lifecycle/auto-compact/auto-compact.ts` | **Merge**: pi-dcp is message-level pruning (remove redundant messages) vs auto-compact is LLM-summarization (compact context via LLM). They are complementary — pi-dcp runs first on every `context` event to clean messages, auto-compact triggers compaction on high usage. Keep both. |
| `src/workflow.ts` (prepare → process → filter engine) | (none) | **Adopt** as the core pruning engine |
| `src/rules/deduplication.ts` | (none) | **Adopt** as-is |
| `src/rules/superseded-writes.ts` | (none) | **Adopt** as-is |
| `src/rules/error-purging.ts` | (none) | **Adopt** as-is |
| `src/rules/tool-pairing.ts` | (none) | **Adopt** as-is (critical for preventing 400 API errors) |
| `src/rules/recency.ts` | (none) | **Adopt** as-is |
| `src/registry.ts` | (none) | **Adopt** as-is |
| `src/metadata.ts` | (none) | **Adopt** as-is |
| `src/types.ts` | (none) | **Adopt** as-is |
| `src/config.ts` | `session-lifecycle/compact-config.ts` | **Merge**: bunfig-based config for pi-dcp vs model-specific threshold config in pi-me. Keep both as separate config domains. |
| `src/logger.ts` | (none) | **Adopt** as-is (rotating file logger for debugging) |
| `src/events/context.ts` | (none) | **Adopt** as-is |
| `src/events/sessionStart.ts` | (none) | **Adopt** as-is |
| `src/cmds/stats.ts` | (none) | **Adopt** as-is |
| `src/cmds/debug.ts` | (none) | **Adopt** as-is |
| `src/cmds/toggle.ts` | (none) | **Adopt** as-is |
| `src/cmds/recent.ts` | (none) | **Adopt** as-is |
| `src/cmds/init.ts` | (none) | **Adopt** as-is |
| `src/cmds/logs.ts` | (none) | **Adopt** as-is |
| `src/cmds/tools-expanded.ts` | (none) | **Skip**: Not related to context pruning; belongs in a separate extension |
| `bunfig` dependency | (none) | **Adopt**: install `bunfig` as npm dependency |
| Tests (bun:test) | node:test pattern | **Adapt**: rewrite tests from bun:test to node:test + node:assert/strict |

## Strategy

- **Unique to pi-dcp** (workflow, all rules, registry, metadata, logger, commands except tools-expanded) → Adopt as-is with optimizations
- **Complementary** (pruning engine + auto-compact) → Keep both; they solve different problems at different layers
- **Skip** (tools-expanded command) → Not relevant to context pruning
- **Adapt** (tests) → Rewrite from bun:test to node:test

## Directory Layout

```
session-lifecycle/dcp/
├── index.ts              # Main entry point (registration, hooks, commands)
├── config.ts             # Configuration (bunfig-based)
├── types.ts              # Type definitions
├── registry.ts           # Rule registry
├── workflow.ts           # Prepare → Process → Filter engine
├── metadata.ts           # Message metadata utilities
├── logger.ts             # Rotating file logger
├── events/
│   ├── context.ts        # Context event handler
│   └── sessionStart.ts   # Session start event handler
├── cmds/
│   ├── stats.ts          # /dcp-stats command
│   ├── debug.ts          # /dcp-debug command
│   ├── toggle.ts         # /dcp-toggle command
│   ├── recent.ts         # /dcp-recent command
│   ├── init.ts           # /dcp-init command
│   └── logs.ts           # /dcp-logs command
├── rules/
│   ├── deduplication.ts  # Deduplication rule
│   ├── superseded-writes.ts # Superseded writes rule
│   ├── error-purging.ts  # Error purging rule
│   ├── tool-pairing.ts   # Tool pairing protection rule
│   └── recency.ts        # Recency protection rule
└── tests/
    ├── deduplication.test.ts
    ├── superseded-writes.test.ts
    ├── error-purging.test.ts
    ├── tool-pairing.test.ts
    ├── recency.test.ts
    └── workflow.test.ts
```

## Optimization Opportunities

1. **Remove `bunfig` dependency complexity**: Replace with simpler config loading using node:fs + JSON/JS config. But bunfig already works — keep it for now.
2. **No custom parsers to replace** — all parsing is already standard JS/TS
3. **Extract types into a clean hierarchy** — already well-structured
4. **Regex patterns** in metadata.ts `isErrorMessage()` — could be pre-compiled at module level
5. **Deduplication already uses Set<string>** (modernized per PLAN.md) — good
6. **Logger sync writes** — could be made async, but for this use case sync is fine (called before blocking LLM call)

## Dependencies to Add

- `bunfig` (^0.15.6) — configuration file loading

## Extensions to Register

New entry in `package.json` → `pi.extensions`:
- `"./session-lifecycle/dcp/index.ts"`

## Status Widget

Add a DCP stats status bar widget that shows pruning statistics in the TUI footer using `ctx.ui.setStatus()`:
- Displays `"DCP: {pruned}/{total}"` after each context event
- Matches the pattern used by `token-rate`, `tab-status`, `session-style`
- `/dcp-stats` command shows detailed statistics in a notification

# Phase 1 — Plugin Consolidation Design

**Date:** 2026-05-02
**Status:** Approved

## Goal

Remove plugins with overlapping functionality and consolidate co-dependent plugins into shared directories. Target: eliminate ~3 plugins (pi-oracle, pi-mempalace, super-pi) and move 1 loose file into its natural home.

## Cluster 1: Oracle tools (2 → 1)

### Current state

| Plugin | Location | Mechanism | Models |
|---|---|---|---|
| `oracle.ts` | `core-tools/oracle.ts` | API keys via pi model registry | 15+ (OpenAI, Google, Anthropic) |
| `pi-oracle/` | `core-tools/pi-oracle/` | Browser-based auth (no API key) | ChatGPT only |

### Decision

Remove `pi-oracle/`. Its sole differentiator — no-API-key browser auth — is fragile (browser session dependency), single-model (ChatGPT only), and adds browser automation overhead. `oracle.ts` already supports all major providers via configured API keys, which is the more reliable and maintainable path.

### Changes

1. Remove `core-tools/pi-oracle/` directory
2. Remove `pi-oracle` from `package.json` `pi.extensions` array
3. Remove `pi-oracle` from `package.json` `dependencies`
4. Run `npm install` to prune the package

## Cluster 2: Memory tools (5 → 4)

### Current state

| Plugin | Purpose | Injection model |
|---|---|---|
| `memory-mode.ts` | Save instructions to AGENTS.md | None — writes config only |
| `pi-memory/` | Cross-session preference/correction learning | Auto-injects on session start |
| `memex/` | Zettelkasten with bidirectional links | On-demand via tool call |
| `pi-mempalace/` | Memory palace spatial organization | On-demand via tool call |
| `context-mode/` | FTS5 knowledge base + context optimization | On-demand via tool call |

### Decision

Remove `pi-mempalace/`. Both `memex` and `pi-mempalace` provide structured knowledge organization. Zettelkasten (memex) is a more standard mental model with broader applicability. The Memory Palace technique is a niche mnemonic device; most users will not leverage it. Removing it eliminates one `session_start` boot cost and one npm dependency with no functional gap for the majority of use cases.

### Changes

1. Remove `core-tools/pi-mempalace/` directory
2. Remove `./core-tools/pi-mempalace/index.ts` from `package.json` `pi.extensions` array
3. Remove `pi-mempalace-extension` from `package.json` `dependencies`
4. Run `npm install` to prune the package

## Cluster 3: Subagent tools (5 → 4)

### Current state

| Plugin | Strength |
|---|---|
| `subagent/` | Flagship: sync/async modes, agent manager, worktrees, slash commands, intercom bridge |
| `sub-pi/` | Subprocess model with skill-prefix detection (`/skill:` references) |
| `ralph-loop/` | Loop-specific: condition polling, pause/resume, steering controls |
| `pi-crew/` | Coordinated AI teams, workflow-level orchestration, worktrees |
| `super-pi/` | "Compound Engineering" — iterative workflows |

### Decision

Remove `super-pi/`. Its "Compound Engineering" iterative workflow capability has no clear differentiated niche not already covered by `subagent` (async jobs, chain mode) + `ralph-loop` (iterative loops with steering). `pi-crew` is retained because its team/workflow orchestration model (coordinated agents with shared context) is distinct from the single-agent dispatch in `subagent` and `sub-pi`.

### Changes

1. Remove `core-tools/super-pi/` directory
2. Remove `./core-tools/super-pi/index.ts` from `package.json` `pi.extensions` array
3. Remove `@leing2021/super-pi` from `package.json` `dependencies`
4. Run `npm install` to prune the package

## Cluster 4: Compact tools — co-location

### Current state

`auto-compact` and `compact-config` are co-dependent (compact-config configures auto-compact thresholds) but live at different directory levels:

- `session-lifecycle/auto-compact/auto-compact.ts`
- `session-lifecycle/compact-config.ts` (loose file at category root)

### Decision

Move `compact-config.ts` into the `auto-compact/` directory. No behavior change — purely structural, reflecting their dependency relationship.

### Changes

1. Move `session-lifecycle/compact-config.ts` → `session-lifecycle/auto-compact/compact-config.ts`
2. Update `package.json` extension path: `./session-lifecycle/compact-config.ts` → `./session-lifecycle/auto-compact/compact-config.ts`
3. Verify no other files import from the old path

## Summary

| Action | Files affected |
|---|---|
| Remove pi-oracle | `core-tools/pi-oracle/`, package.json ×2 |
| Remove pi-mempalace | `core-tools/pi-mempalace/`, package.json ×2 |
| Remove super-pi | `core-tools/super-pi/`, package.json ×2 |
| Move compact-config | `session-lifecycle/compact-config.ts` → `session-lifecycle/auto-compact/compact-config.ts`, package.json ×1 |

Net result: 54 → 51 extensions, 3 fewer npm dependencies.

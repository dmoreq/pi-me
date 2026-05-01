# rhubarb-pi → pi-me Adoption Plan

## Comparison Matrix

| External Extension | pi-me Equivalent | Verdict |
|---|---|---|
| `background-notify` | (none) | **Adopt** — beep/focus on long-run complete |
| `session-emoji` | (none) | **Adopt** — AI-powered emoji in footer |
| `session-color` | (none) | **Adopt** — colored band to distinguish sessions |
| `safe-git` | `permission` | **Adopt** — complementary: git-specific approval vs general command safety |
| `safe-rm` | `permission` | **Adopt** — complementary: rm→trash vs general dangerous commands |
| `compact-config` | `auto-compact` | **Adopt** — complementary: per-model custom thresholds |
| `pi-agent-scip` | (none) | **Skip** — requires SCIP indexers, build system, too complex |

## Strategy

- 6 extensions adopted as-is — zero mergers
- shared/ utilities copied for imports
- pi-agent-scip skipped (requires external SCIP indexers + build)
- All use standard `export default function(pi: ExtensionAPI)` pattern

## File Map

| Source | Destination |
|--------|-------------|
| `hooks/background-notify/index.ts` | `session-lifecycle/background-notify.ts` |
| `hooks/session-emoji/index.ts` | `session-lifecycle/session-emoji.ts` |
| `hooks/session-color/index.ts` | `session-lifecycle/session-color.ts` |
| `extensions/safe-git/index.ts` | `foundation/safe-git.ts` |
| `extensions/safe-rm/index.ts` | `foundation/safe-rm.ts` |
| `extensions/compact-config.ts` | `session-lifecycle/compact-config.ts` |
| `shared/` | `session-lifecycle/rhubarb-shared/` |

## Import path fixes

- `background-notify/index.ts` imports from `"../../shared"` → `"./rhubarb-shared/index.js"`
- `safe-git/index.ts` imports from `"../../shared"` → `"./rhubarb-shared/index.js"`

## Extension Count

| | Before | After |
|---|---|---|
| Extensions | 43 | **49** (+6) |

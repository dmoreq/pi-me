# core-tools/ Extension Ranking

Each extension ranked by how essential it is to pi's core purpose.

## Tier: Agent-Critical (agent uses these autonomously)

These are tools the agent calls automatically during normal operation.
Removing them degrades pi's core capabilities.

| # | Extension | Lines | Tests | Why essential |
|---|-----------|-------|-------|---------------|
| 1 | **web-search** | 181 | 1 | `web_search` tool — used by the agent for web queries. Without this, the agent can't search. |
| 2 | **todo** | 1,181 | 0 | `todo` tool — task tracking. Used by the agent on every multi-step task. |
| 3 | **calc** | 76 | 1 | `calc` tool — math evaluation. Used by the agent for calculations. |
| 4 | **ralph-loop** | 2,644 | 1 | `ralph_loop` tool — looped subagent execution. Used by the agent for iterative work. |
| 5 | **plan-tracker** | 1,185 | 2 | `plan_tracker` tool — plan progress widget. Used by the agent for structured work. |
| 6 | **subagent** | **23,769** | 4 | `subagent` tool — agent dispatch. The largest and most critical extension. |
| 7 | **clipboard** | 94 | 0 | `copy_to_clipboard` tool — the agent uses this to return content to the user. |

## Tier: Frequently Used Commands

Extensions with commands that users or skills call regularly.

| # | Extension | Lines | Tests | Why valuable |
|---|-----------|-------|-------|--------------|
| 8 | **plan-mode** | 902 | 0 | `/plan` command — file-based plans. Called by the `writing-plans` and `executing-plans` skills. |
| 9 | **sub-pi** | 1,633 | 0 | `sub_pi` tool — subprocess dispatch. Called by skills for isolated agent runs. |
| 10 | **oracle** | 605 | 0 | `/oracle` — second opinion from another model. Infrequent but uniquely valuable. |
| 11 | **btw** | 603 | 0 | `/btw` — side questions mid-session. Well-liked, no other way to do this. |
| 12 | **code-actions** | 634 | 0 | `/code` — pick code from assistant. Required by code-review workflow. |
| 13 | **thinking-steps** | 365 | 1 | Structured thinking before tool calls. Used in `plugin-guide` skill. |

## Tier: Configuration & Quality of Life

Extensions that enhance the experience but aren't mission-critical.

| # | Extension | Lines | Tests | Why keep |
|---|-----------|-------|-------|----------|
| 14 | **preset** | 352 | 0 | `/preset` — switch model/provider presets. Small, useful. |
| 15 | **model-filter** | 51 | 0 | Filters models by provider. 51 lines — tiny, harmless. |
| 16 | **memory** | 2,071 | 3 | `/mem` + memory tools — persistent facts across sessions. Has tests. |
| 17 | **formatter** | 2,040 | 0 | Auto-formats files on save. 21 files but well-structured. |
| 18 | **edit-session** | 634 | 0 | `/edit-turn` — re-edit previous messages. Occasional but unique. |
| 19 | **stash** | 467 | 0 | Stash/restore drafts. Keyboard shortcut convenience. |
| 20 | **file-collector** | 987 | 0 | Collects file paths from tool results. Niche regex config. |

## Tier: Candidate for Removal

Extensions that provide minimal value relative to their cost.

| # | Extension | Lines | Tests | Why remove |
|---|-----------|-------|-------|------------|
| 21 | **link** | 1,519 | 0 | WebSocket multi-terminal. Very niche — requires multiple pi instances. 0 tests. |
| 22 | **speedreading** | 682 | 0 | `/speedread` RSVP reader. Visual gimmick. 0 tests. |
| 23 | **ultrathink** | 222 | 0 | Rainbow animation. Pure cosmetic. 0 tests. |

## Summary

| Tier | Count | Extensions | Lines |
|------|-------|------------|-------|
| 🟢 Agent-Critical | 7 | web-search, todo, calc, ralph-loop, plan-tracker, subagent, clipboard | ~29,130 |
| 🟡 Frequently Used | 6 | plan-mode, sub-pi, oracle, btw, code-actions, thinking-steps | ~5,142 |
| 🟠 Quality of Life | 7 | preset, model-filter, memory, formatter, edit-session, stash, file-collector | ~6,602 |
| 🔴 Remove Candidates | 3 | link, speedreading, ultrathink | ~2,423 |

**If all 3 removal candidates go:** ~2,423 lines removed. pi-me gets leaner with zero loss of real functionality.

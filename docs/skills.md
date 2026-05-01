## Skills

Skills are markdown files (`SKILL.md` with YAML frontmatter) that guide the agent's behavior. Pi loads a skill when the agent's task matches the `description` field in the frontmatter.

| Skill | Trigger | Purpose |
|-------|---------|---------|
| **a-nach-b** | User asks about Austrian public transport | Query real-time departures, plan routes, check disruptions via HAFAS API |
| **adopt-plugin** | Adopting an external pi package into pi-me | Full workflow: assess, compare, merge, optimize, verify |
| **brainstorming** | Before creative work or implementation | Socratic design refinement: questions, alternatives, validation |
| **commit-helper** | When committing code | Generate conventional commit messages from diffs |
| **dispatching-parallel-agents** | Running parallel independent tasks | Concurrent subagent workflows with coordination |
| **executing-plans** | When a written implementation plan exists | Batch execution with architect review checkpoints |
| **extending-pi** | When extending pi itself | Guide: skill vs extension vs theme vs package, scaffold files |
| **finishing-a-development-branch** | When development work is complete | Merge/PR decision workflow with verification |
| **output-artifacts** | When tool output is truncated | Retrieve full output via artifact:// URLs |
| **permission** | When adjusting safety levels | Permission levels, modes, and safety commands |
| **pi-ralph-wiggum** | When using long-running task loops | Loop controls: task file, reflection, iteration pacing |
| **ralph-loop** | When running subagent loops | Loop controls: steer, pause, resume, stop, chain mode |
| **receiving-code-review** | When receiving code review feedback | Technical evaluation: organize feedback, assess severity, apply changes |
| **requesting-code-review** | Before merging code | Pre-merge review: severity categories, subagent dispatch option |
| **secrets** | When handling credentials | Secret obfuscation rules and config file format |
| **skill-bootstrap** | When documenting a project | Auto-generate SKILL.md with project-specific guidance |
| **subagent-driven-development** | When executing plans with independent tasks | Fresh subagent per task + two-stage review (spec then quality) |
| **systematic-debugging** | When debugging a bug | 4-phase root cause investigation with defense-in-depth |
| **test-driven-development** | When implementing features or fixing bugs | RED-GREEN-REFACTOR cycle with anti-patterns reference |
| **using-git-worktrees** | When isolating work | Create/manage git worktrees for parallel branches |
| **verification-before-completion** | Before claiming work is done | Evidence-based verification: tests pass, output matches spec |
| **writing-plans** | Before implementation | Create detailed implementation plans with bite-sized TDD tasks |
| **writing-skills** | When creating or updating SKILL.md | TDD applied to process documentation: create, test, bulletproof |

---

## Quick Reference: What's Hook, Tool, or Command

| Extension | Hook | Tool | Command | Configuration Needed |
|-----------|------|------|---------|-------------------|
| secrets | ✅ | — | — | — |
| permission | ✅ | — | `/permission`, `/permission-mode` | — |
| context-window | ✅ | — | — | — |
| memory-mode | — | — | `/mem`, `/remember` | — |
| status-widget | ✅ | — | `/status`, `/status-refresh` | — |
| safe-git | ✅ | — | `/safegit`, `/safegit-level`, `/safegit-status` | — |
| safe-rm | ✅ | — | `/saferm`, `/saferm-toggle`, `/saferm-on`, `/saferm-off`, `/saferm-log` | — |
| extra-context-files | ✅ | — | — | AGENTS.local.md files |
| git-checkpoint | ✅ | — | — | — |
| auto-compact | ✅ | — | — | — |
| session-name | ✅ | — | — | — |
| token-rate | ✅ | — | — | — |
| agent-guidance | ✅ | — | — | CLAUDE.md / CODEX.md / GEMINI.md files |
| session-recap | ✅ | — | `/recap` | — |
| tab-status | ✅ | — | — | — |
| usage-extension | — | — | `/usage` | — |
| cost-tracker | — | — | `/cost` | — |
| funny-working-message | ✅ | — | `/fun-working` | — |
| handoff | — | — | `/handoff` | — |
| usage-bar | — | — | `/usage` | — |
| background-notify | ✅ | — | multiple `/notify-*` | — |
| session-emoji | ✅ | — | `/emoji`, `/emoji-set`, etc. | — |
| session-color | ✅ | — | `/color`, `/color-set`, etc. | — |
| compact-config | ✅ | — | `/compact-config` | — |
| preset | ✅ | — | `/preset` | — |
| web-search | — | ✅ | — | `BRAVE_API_KEY`, `SERPAPI_API_KEY`, or `KAGI_API_KEY` |
| todo | ✅ | ✅ | `/todos` | — |
| calc | — | ✅ | — | — |
| ask | — | ✅ | — | — |
| ralph-loop | — | ✅ | multiple `/ralph-*` | — |
| plan-tracker | — | ✅ | — | — |
| pi-ralph-wiggum | — | ✅ | multiple | — |
| code-actions | — | — | `/code` | — |
| clipboard | — | ✅ | — | — |
| flicker-corp | ✅ | — | — | — |
| loop | — | ✅ | `/loop` | — |
| oracle | — | — | `/oracle` | — |
| plan-mode | ✅ | ✅ | `/plan` | — |
| resistance | ✅ | — | `/resistance` | — |
| speedreading | — | — | `/speedread` | — |
| ultrathink | ✅ | — | `/ultrathink` | — |
| arcade | — | ✅ | — | — |
| file-collector | ✅ | — | — | — |
| sub-pi | ✅ | ✅ | — | — |
| sub-pi-skill | ✅ | — | — | — |
| notebook | — | ✅ | — | — |
| mermaid | — | ✅ | — | `mmdc` CLI (`npm i -g @mermaid-js/mermaid-cli`) |
| github | — | ✅ | — | `GITHUB_TOKEN` or `GH_TOKEN` |
| repeat | — | — | `/repeat` | — |
| files-widget | ✅ | — | `/readfiles` | — |
| raw-paste | ✅ | — | `/paste` | — |
| richard-files | — | — | `/files` | — |
| output-artifacts | ✅ | — | — | — |
| commit-helper | — | ✅ | `/commit` | — |
| skill-bootstrap | — | — | `/bootstrap-skill` | — |

---

**See also:** [Features Reference](features.md) — detailed extension descriptions and trigger modes.

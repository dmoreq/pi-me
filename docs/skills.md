# Skills

Skills are `SKILL.md` files with YAML frontmatter that guide the agent's behavior. Pi automatically loads a
skill when the agent's task matches the `description` field in the frontmatter. Twenty-three skills cover
the full development lifecycle.

---

## Skill Reference

### Workflow Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `brainstorming` | Before creative work or implementation | Socratic design refinement: questions, alternatives, validation |
| `writing-plans` | Before implementing multi-step tasks | Create detailed implementation plans with bite-sized TDD tasks |
| `executing-plans` | When an implementation plan exists | Batch execution with architect review checkpoints |
| `subagent-driven-development` | When executing plans with independent tasks | Fresh subagent per task with two-stage review (spec, then quality) |
| `dispatching-parallel-agents` | 2+ independent tasks without shared state | Concurrent subagent workflows with coordination |
| `test-driven-development` | When implementing features or fixing bugs | RED-GREEN-REFACTOR cycle with anti-patterns reference |
| `systematic-debugging` | When encountering bugs or test failures | 4-phase root cause investigation with defense-in-depth |
| `verification-before-completion` | Before claiming work is complete | Evidence-based verification: tests pass, output matches spec |
| `requesting-code-review` | Before merging code | Pre-merge review: severity categories, subagent dispatch option |
| `receiving-code-review` | When receiving code review feedback | Technical evaluation: organize feedback, assess severity, apply changes |
| `finishing-a-development-branch` | When development work is complete | Merge/PR decision workflow with verification |
| `using-git-worktrees` | When isolating work to separate branches | Create and manage git worktrees for parallel development |

### pi-me Internal Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `adopt-plugin` | When adopting external pi packages | Full workflow: assess, compare, merge, optimize, verify |
| `commit-helper` | When committing code | Generate conventional commit messages from git diffs |
| `output-artifacts` | When tool output is truncated | Retrieve full output via `artifact://` URLs |
| `permission` | When adjusting safety levels | Permission levels, enforcement modes, and safety commands |
| `secrets` | When handling credentials | Secret obfuscation rules and config file format |
| `skill-bootstrap` | When documenting a project | Auto-generate `SKILL.md` with project-specific guidance |
| `ralph-loop` | When running subagent loops | Loop controls: steer, pause, resume, stop, chain mode |
| `todo` | When tracking multi-step progress | Task list management: pending→in_progress→completed lifecycle |
| `writing-skills` | When creating or updating `SKILL.md` | TDD applied to process documentation |
| `extending-pi` | When extending pi itself | Guide: skill vs extension vs theme vs package, scaffold files |

### External Integrations

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `a-nach-b` | Austrian public transport queries | Real-time departures, route planning, disruption checks via HAFAS API |

---

## Extension Activation Reference

| Extension | Hook | Tool | Command | Configuration |
|-----------|------|------|---------|---------------|
| secrets | ✓ | — | — | `secrets.yml` |
| permission | ✓ | — | `/permission`, `/permission-mode` | Settings |
| context-window | ✓ | — | — | — |
| memory-mode | — | — | `/mem`, `/remember` | — |
| status-widget | ✓ | — | `/status`, `/status-refresh` | — |
| safe-ops | ✓ | — | `/safegit*`, `/saferm*` | Settings |
| extra-context-files | ✓ | — | — | `AGENTS.local.md` |
| git-checkpoint | ✓ | — | — | — |
| auto-compact | ✓ | — | — | Settings |
| session-name | ✓ | — | — | — |
| token-rate | ✓ | — | — | — |
| agent-guidance | ✓ | — | — | `CLAUDE.md`/`CODEX.md`/`GEMINI.md` |
| session-recap | ✓ | — | `/recap` | — |
| tab-status | ✓ | — | — | — |
| usage-extension | — | — | `/usage`, `/cost` | — |
| notifications | ✓ | — | `/notify-*`, `/fun-working` | Settings |
| handoff | — | — | `/handoff` | — |
| session-style | ✓ | — | `/emoji*`, `/color*` | Settings |
| compact-config | ✓ | — | `/compact-config` | Settings |
| preset | ✓ | — | `/preset` | `preset.jsonc` |
| skill-args | ✓ | — | — | — |
| warp-notify | ✓ | — | — | Warp terminal |
| web-search | — | ✓ | — | `EXA_API_KEY`, `TAVILY_API_KEY`, or `VALIYU_API_KEY` |
| todo | ✓ | ✓ | `/todos` | — |
| calc | — | ✓ | — | — |
| ask-user-question | — | ✓ | — | — |
| ralph-loop | — | ✓ | `/ralph-*` | — |
| plan-tracker | — | ✓ | — | — |
| plan-mode | ✓ | ✓ | `/plan` | — |
| sub-pi | ✓ | ✓ | — | `sub-pi.jsonc` |
| btw | — | — | `/btw` | — |
| oracle | — | — | `/oracle` | — |
| code-actions | — | — | `/code` | — |
| speedreading | — | — | `/speedread` | — |
| ultrathink | ✓ | — | `/ultrathink` | — |
| file-collector | ✓ | — | — | JSONC config |
| clipboard | — | ✓ | — | — |
| arcade | — | ✓ | — | — |
| flicker-corp | ✓ | — | — | — |
| resistance | ✓ | — | — | — |
| notebook | — | ✓ | — | — |
| mermaid | — | ✓ | — | `mmdc` CLI |
| github | — | ✓ | — | `GITHUB_TOKEN` |
| repeat | — | — | `/repeat` | — |
| files-widget | ✓ | — | `/readfiles` | — |
| raw-paste | ✓ | — | `/paste` | — |
| richard-files | — | — | `/files` | — |
| output-artifacts | ✓ | — | — | — |
| commit-helper | — | ✓ | `/commit` | — |
| skill-bootstrap | — | — | `/bootstrap-skill` | — |

---

## Skill File Format

```markdown
---
name: my-skill
description: One-line description of when pi should load this skill
---

# Skill Title

Guidance content for the agent. May include rules, workflows, examples,
and references to tools or commands the agent should use.
```

The `skills/` directory is registered automatically in `package.json` — adding a new `SKILL.md` requires no
manifest changes.

---

**See also:** [Architecture Overview](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md)

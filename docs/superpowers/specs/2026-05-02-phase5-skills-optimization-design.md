# Phase 5 — Skills Optimization Design

**Date:** 2026-05-02
**Status:** Approved
**Depends on:** Phases 1–3 (consolidation and plugin renames affect skill content)

## Goal

Fix six skills that are missing required frontmatter, update skills whose content references removed or renamed plugins, and introduce a new `plugin-guide` skill that teaches the agent which tool to reach for in each situation.

## Problem

### Missing frontmatter (`name:` field)

The pi skill system uses the `name:` frontmatter field for skill discovery and matching. Six skills have no `name:` field:

| Skill directory | Current state |
|---|---|
| `commit-helper` | No `name:`, no `description:` |
| `output-artifacts` | No `name:`, no `description:` |
| `permission` | No `name:`, no `description:` |
| `ralph-loop` | No `name:`, no `description:` |
| `secrets` | No `name:`, no `description:` |
| `skill-bootstrap` | No `name:`, no `description:` |

### Stale content after Phase 1

`pi-subagents/SKILL.md` (727 lines) may reference `super-pi` which is removed in Phase 1. Verify and clean any references.

### No plugin decision guide

After Phases 1–3 the codebase has 51 well-differentiated plugins. The agent has no single reference for which tool to call in a given situation. Without guidance, it falls back to generic reasoning and frequently uses browser-automation search (`greedysearch`) when API-backed search (`web_search`) would be faster and cheaper.

## Change 1: Add missing frontmatter to 6 skills

Each skill needs a `name:` and `description:` that accurately matches its purpose. The description controls when the skill is auto-invoked.

| Skill | name | description |
|---|---|---|
| `commit-helper` | `commit-helper` | Generate a conventional commit message from the current git diff using the commit_message tool. Use when creating a commit. |
| `output-artifacts` | `output-artifacts` | Tool output larger than 8KB is automatically saved to .pi/artifacts/ with an artifact:// retrieval URL. Use when tool output was truncated or you need to re-read a large result. |
| `permission` | `permission` | Tiered command permission system — minimal to bypassed. Use when asked about permission levels, when a command is blocked unexpectedly, or when configuring which operations are allowed. |
| `ralph-loop` | `ralph-loop` | Looped subagent execution with condition polling, pause/resume, and steering controls. Use when a task requires iterative agent loops, polling for a condition, or resumable multi-step workflows. |
| `secrets` | `secrets` | Sensitive values (API keys, tokens, passwords) are automatically scanned and obfuscated before reaching the LLM. Use when configuring secret patterns or when a credential appears in tool output. |
| `skill-bootstrap` | `skill-bootstrap` | The /bootstrap-skill command auto-detects the project type and generates a SKILL.md scaffold. Use when creating a new skill for a project. |

## Change 2: Audit `pi-subagents` for removed plugin references

Read `skills/pi-subagents/SKILL.md` and remove any references to `super-pi` (removed in Phase 1). If `super-pi` appears as a "use this for iterative workflows" recommendation, replace with `ralph_loop` + `subagent` chain mode.

## Change 3: New skill — `plugin-guide`

A reference skill the agent can consult to pick the right tool for each category of task. This is not a process skill (no checklist) — it is a lookup table.

**File:** `skills/plugin-guide/SKILL.md`

**Description:** Decision guide for choosing the right pi-me plugin. Use when unsure which tool to call for web search, memory, subagents, planning, code quality, or document handling.

### Content structure

The skill is organized by task category. Each entry has: task intent → which tool → when to prefer alternatives.

#### Web & Search

| Want to | Use | Notes |
|---|---|---|
| Search the web for facts/research | `web_search` | Exa (semantic) or Tavily (agent-optimized); fastest and cheapest |
| Search AI-engine results (Perplexity, Bing Copilot, Google AI) | `greedysearch` | No API key needed; browser automation — slower |
| Fetch and read a URL | `web_fetch` | Browser-grade TLS, Defuddle extraction; does NOT run JS |

#### Memory & Knowledge

| Want to | Use | Notes |
|---|---|---|
| Save an instruction for all future sessions | `/mem` (memory-mode) | Writes to AGENTS.md — permanent project/global config |
| Auto-learn from corrections and inject preferences | pi-memory | Auto-injects on session start; disable via `disableAutoInject` if context grows large |
| Build a Zettelkasten knowledge graph with links | `memex` | On-demand via tool call; best for structured note-taking |
| Optimize context window via FTS5 knowledge base | `context-mode` | MCP-based; on-demand; best for large knowledge retrieval |

#### Subagents & Orchestration

| Want to | Use | Notes |
|---|---|---|
| Run a single subagent task (sync, with streaming output) | `subagent` | Flagship: async mode, agent manager, worktrees, slash cmds |
| Run a subagent and auto-detect `/skill:` prefixes | `sub_pi` | Subprocess model; skill-prefix auto-detection |
| Run an iterative loop with condition polling / steering | `ralph_loop` | Pause/resume/steer; best for "keep trying until X" patterns |
| Coordinate a team of agents on a shared goal | `pi-crew` | Workflow-level orchestration; distinct from single dispatch |

#### Planning

| Want to | Use | Notes |
|---|---|---|
| Track progress through a task list during a session | `plan_tracker` | TUI widget overlay; 4-state (pending/in_progress/complete/blocked) |
| Manage persistent plan files across sessions | `plan_mode` | File-based in `.pi/plans/`; locking, frontmatter, planning mode toggle |
| Review and annotate a plan visually | plannotator | Browser-based annotation UI |

#### Code Quality

| Want to | Use | Notes |
|---|---|---|
| Get real-time lint / LSP / type-check feedback | `pi-lens` | LSP, ast-grep, biome, ruff, TypeScript coverage, knip |
| Auto-format files on write | `pi-formatter` | Triggers on save; zero config |
| Get a second opinion from another AI model | `/oracle` | Supports OpenAI, Google, Anthropic; use for tie-breakers |

#### Documents & Content

| Want to | Use | Notes |
|---|---|---|
| Parse a PDF, .docx, .xlsx, or image | `document_parse` | pi-docparser; requires LibreOffice/ImageMagick/Ghostscript |
| Render Markdown or LaTeX to PDF/browser | `pi-markdown-preview` | Puppeteer-based; heavy (~30MB Chrome) |
| Edit a Jupyter notebook cell | notebook tool | Cell-level read/edit/insert/delete |
| Render a Mermaid diagram | `mermaid` tool | Outputs SVG/PNG via mmdc CLI |

#### Session Utilities

| Want to | Use | Notes |
|---|---|---|
| Ask the user a structured multi-part question | `ask_user_question` | TUI questionnaire with markdown previews |
| Ask a side question without polluting context | `/btw` | Clones context into overlay; answer doesn't enter main thread |
| Stash a draft message to restore later | `pi-stash` | Stores and restores incomplete prompts |
| Re-edit an earlier user message | `pi-edit-session` | Replaces a past message in the conversation thread |
| Connect to MCP servers | `pi-mcp-adapter` | Bridges any MCP-compatible server into pi tools |

## Summary

| Change | Files | Risk |
|---|---|---|
| Add frontmatter to 6 skills | 6 SKILL.md files | None |
| Audit pi-subagents for super-pi refs | `skills/pi-subagents/SKILL.md` | None |
| Create plugin-guide skill | `skills/plugin-guide/SKILL.md` (new) | None |

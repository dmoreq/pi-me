---
name: plugin-guide
description: Decision guide for choosing the right pi tool, extension, or skill for each task category
---

# Plugin Guide

Use this guide to determine which tool, extension, or skill to use for a given task.

## Task-to-Tool Mapping

### Task Management & Progress

| Task | Tool / Extension | Notes |
|---|---|---|
| Track in-session task progress | `plan_tracker` tool | Live overlay, survives branch replay |
| Create persistent plans with locking | `plan` tool (plan-mode) | File-based `.pi/plans/`, survives restarts |
| Decompose complex work into steps | `writing-plans` skill | Called automatically when spec is clear |
| View all plans | `/plans` command | Lists plans in `.pi/plans/` directory |
| Track 4-state todo tasks | `todo` tool | Pending → in_progress → completed + deleted |

### Code & Development

| Task | Tool / Extension | Notes |
|---|---|---|
| Search file contents by regex | `search` tool (builtin ripgrep) | Fastest option for regex |
| Search file contents by relevance | `search_tool_bm25` tool | BM25 ranking for conceptual queries |
| Read file contents | `read` tool | Text + image support |
| Edit files precisely | `edit` tool | Exact text replacement |
| Create/overwrite files | `write` tool | Auto-creates parent dirs |
| Run bash commands | `bash` tool | Shell execution |
| Execute Python code | `eval` tool | IPython kernel |
| Get real-time LSP diagnostics | pi-lens | Code feedback on save |
| Format code on save | pi-formatter | Auto-formatting |
| Browse rendered markdown | pi-markdown-preview | Terminal/browser/PDF |
| Parse PDF/Office docs | pi-docparser | Document parsing |

### Subagent Orchestration

| Task | Tool / Extension | Notes |
|---|---|---|
| Delegate to a single subagent | `subagent` tool | Preferred for most delegation |
| Run chain of subagents | `subagent` with `chain` mode | Pipeline where each step uses prior output |
| Run parallel subagents | `subagent` with `parallel` mode | Concurrent independent tasks |
| Run subagent in a loop | `ralph_loop` tool | Polling/iteration loops with condition |
| Dispatch via subprocess | `sub-pi` tool | When you need skill prefix dispatch |
| Coordinate AI teams | pi-crew | Worktrees, workflows, async orchestration |

### Knowledge & Memory

| Task | Tool / Extension | Notes |
|---|---|---|
| Search web for current info | `web_search` tool | Fastest. Requires `EXA_API_KEY`, `TAVILY_API_KEY`, or `VALIYU_API_KEY` |
| AI-engine-specific search | (removed — `web_search` covers this) | Uses Exa/Tavily/Valiyu API |
| Save/recall session patterns | pi-memory | Automatic, learns passively |
| Build explicit knowledge graph | memex | Zettelkasten with bidirectional links |
| Retrieve context when full | context-mode | MCP-based context optimization |
| Get second opinion from another model | `oracle` tool (oracle.ts) | `/oracle <prompt>` |
| Ask a side question mid-session | BTW (btw) | `/btw <question>` |

### File & Resource Utilities

| Task | Tool / Extension | Notes |
|---|---|---|
| Edit Jupyter notebooks | `notebook` tool | .ipynb cell management |
| Render Mermaid diagrams | `render_mermaid` tool | SVG or PNG output |
| Interact with GitHub | `github` tool | Issues, PRs, code search |
| Copy text to clipboard | `copy_to_clipboard` tool | OSC52 escape sequences |
| Collect file paths from tool results | file-collector | Regex-based collection |
| Fetch web content | web-fetch | Page fetching utility |
| Command output replay | repeat | Re-run captured commands |
| File browser widget | files-widget | Browse files in terminal |

### Session Lifecycle

| Task | Tool / Extension | Notes |
|---|---|---|
| View token usage/rate | token-rate | TUI status bar display |
| Set session name | session-name | `/session-name <name>` |
| Compact context automatically | auto-compact | Triggers at configurable threshold |
| Configure compaction | compact-config | Settings for auto-compact |
| Session branding/recap | session-recap | End-of-session summary |
| Warp terminal notifications | warp-notify | OSC 777 notifications |
| Manage session presets | preset | Model/preset management |
| Model filtering | model-filter | Restrict available models |
| Agent guidance injection | agent-guidance | Custom instructions per session |

### UI & Display

| Task | Tool / Extension | Notes |
|---|---|---|
| Render thinking steps | pi-thinking-steps | TUI thinking display |
| Two-pane browser workspace | pi-studio | Prompt/response editing workspace |
| Terminal minigames | arcade | Spice Invaders, Picman, Ping, Tetris, Mario-Not |
| Speed reading | speedreading | `/speedread` RSVP reader |
| Animated display effects | flicker-corp | Terminal animation |

### Authoring & Docs

| Task | Tool / Extension | Notes |
|---|---|---|
| Generate commit messages | `commit_message` tool | Conventional commits from git diff |
| Save artifacts for later | output-artifacts | Truncated output to disk |
| Bootstrap project skills | skill-bootstrap | `/bootstrap-skill` for SKILL.md |
| Interactive plan annotation | plannotator | Browser-based code review |

### Communication

| Task | Tool / Extension | Notes |
|---|---|---|
| Inter-terminal communication | pi-link | WebSocket between pi terminals |
| Structured user questions | `ask_user_question` tool | Multi-question UI with previews |
| User notification | `notify` | Beep, speak, bring-to-front |

## Choosing between similar tools

**`subagent` vs `sub_pi` vs `ralph_loop`:** Use `subagent` for everything unless you specifically need skill-prefix dispatch (`sub_pi`) or iterative polling loops (`ralph_loop`).

**`plan_tracker` vs `plan` tool:** `plan_tracker` is for in-session task lists (like a todo overlay). `plan` (plan-mode) is for persistent plan files that survive session restarts and need locking/history.

**`pi-memory` vs `memex` vs `context-mode`:** `pi-memory` is automatic (learns from you passively). `memex` is explicit (you build a knowledge graph). `context-mode` is retrieval (searches your knowledge base when context is full).

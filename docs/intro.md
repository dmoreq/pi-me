# Architecture Overview

pi-me is organized into five functional layers, each serving a distinct role in the pi extension ecosystem.

---

## Layer Architecture

```
┌──────────────────────────────────────────────┐
│                  Skills                       │
│  SKILL.md files guiding agent behavior        │
├──────────────────────────────────────────────┤
│  Authoring      │  AI-assisted content tools  │
├──────────────────────────────────────────────┤
│  Content Tools  │  File & resource utilities  │
├──────────────────────────────────────────────┤
│  Core Tools     │  General-purpose agent tools│
├──────────────────────────────────────────────┤
│  Session Lifecycle │ Session state & branding │
├──────────────────────────────────────────────┤
│  Foundation     │  Always-on safety guards    │
└──────────────────────────────────────────────┘
```

### Foundation

Always-active extensions that run on every session. These provide safety guarantees (permission system, secret obfuscation), diagnostics (context window monitoring, provider status), and operational guards (safe git/rm interception).

**Extensions:** Secrets, Permission, Context Window, Safe Operations, Status Widget, Extra Context Files

### Session Lifecycle

Extensions that manage session state across its entire lifecycle — from initialization through compaction to shutdown. Includes session branding (emoji, color bands), metrics (token rate), notifications, and model/preset management.

**Extensions:** Git Checkpoint, Auto Compact, Session Name, Token Rate, Agent Guidance, Session Recap, Tab Status, Usage Extension, Notifications, Handoff, Session Style, Compact Config, Preset, Skill Args, Warp Notify

### Core Tools

Tools registered for direct agent invocation via tool calls. These are the agent's primary interface for task management (todo, plan-tracker), computation (calc), user interaction (ask_user_question, btw), external access (web-search, sub-pi), and utility operations (clipboard, oracle).

**Extensions:** Web Search, Todo, Calc, Ask User Question, Ralph Loop, Plan Tracker, Plan Mode, Sub-Pi, BTW, Oracle, Code Actions, Speed Reading, Ultrathink, Memory Mode, File Collector, Clipboard, Arcade, Flicker Corp, Resistance

### Content Tools

Utilities for manipulating files and external resources. These handle notebook editing, diagram rendering, GitHub API access, command replay, and file browsing widgets.

**Extensions:** Notebook, Mermaid, GitHub, Repeat, Files Widget, Raw Paste, Richard Files

### Authoring

AI-assisted content creation tools that help produce documentation, commit messages, and skill definitions.

**Extensions:** Output Artifacts, Commit Helper, Skill Bootstrap

---

## Extension Trigger Modes

Each extension activates through one or more of these mechanisms:

| Mode | Mechanism | Description |
|------|-----------|-------------|
| Hook | `pi.on("event", handler)` | Fires automatically on lifecycle events (`session_start`, `agent_end`, `tool_call`, etc.) |
| Tool | `pi.registerTool({...})` | Available for the agent to invoke via tool calls |
| Command | `pi.registerCommand("/name", {...})` | User invokes by typing `/name` in the terminal |

Many extensions combine multiple modes. For example, the todo extension uses hooks (session_start for state reconstruction), a tool (for agent task management), and a command (`/todos` for user inspection).

---

## Skills

Skills are `SKILL.md` files with YAML frontmatter. Pi automatically loads a skill when its `description` field matches the agent's current task. Skills provide structured guidance, rules, and workflows to the agent.

Twenty-three skills cover the full development lifecycle: brainstorming, planning, test-driven development, systematic debugging, code review, and git workflow management.

---

**See also:** [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md) · [Telegram Integration](telegram.md)

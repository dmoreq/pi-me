# pi-me Features & Skills Reference

How every extension and skill works and what triggers it.

---

## How Extensions Activate

There are three trigger modes:

| Mode | Mechanism | Examples |
|------|-----------|----------|
| **🔄 Hook** | `pi.on("event", ...)` — fires automatically on lifecycle events | session_start, turn_end, tool_call, agent_start |
| **🤖 Tool** | `pi.registerTool(...)` — available for the agent to call via tool calls | web_search, calc, notebook, plan_tracker |
| **⌨️ Command** | `pi.registerCommand(...)` — user types `/something` in the terminal | /plan, /oracle, /mem, /color |

Many extensions use **multiple modes** (e.g., hooks run automatically while commands let the user override or configure).

---

---

**See also:** [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)

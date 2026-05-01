# Content Tools Layer

File and resource manipulation utilities for notebooks, diagrams, GitHub, command replay, and file browsing.

---

## Extensions

### Notebook

**Source:** `content-tools/notebook.ts`
**Trigger:** Tool (`notebook`)

Cell-level editor for Jupyter `.ipynb` files. Operations: read, edit, insert, and delete cells.
Supports both code and markdown cell types. Previews long outputs with truncation.

### Mermaid

**Source:** `content-tools/mermaid.ts`
**Trigger:** Tool (`render_mermaid`)

Renders Mermaid diagram source to SVG or PNG. Requires the `mmdc` CLI from `@mermaid-js/mermaid-cli`:
```bash
npm install -g @mermaid-js/mermaid-cli
```

### GitHub

**Source:** `content-tools/github.ts`
**Trigger:** Tool (GitHub operations)

GitHub API client supporting: search code, search repositories, create and list issues, create and list
pull requests, and read file contents. Authenticates via `GITHUB_TOKEN` or `GH_TOKEN` environment variable.

### Repeat

**Source:** `content-tools/repeat/index.ts`
**Trigger:** Command (`/repeat`)

Replays previous tool calls (bash, edit, write) with optional modifications. Cycles through command
history with a type-to-search interface.

### Files Widget

**Source:** `content-tools/files-widget/index.ts`
**Trigger:** Command (`/readfiles`) · Hook (`tool_result`, `session_start`, `session_switch`)

In-terminal file browser with directory tree navigation, file viewer, diff viewer, commenting, and line
selection. Navigate and inspect project files without leaving the pi session.

### Raw Paste

**Source:** `content-tools/raw-paste/index.ts`
**Trigger:** Command (`/paste`) · Hook (`session_start`)

Pastes text as editable inline content rather than collapsed blocks. Pasted text appears for review
before being sent to the agent. Supports configurable keyboard shortcuts.

### Richard Files

**Source:** `content-tools/richard-files/index.ts`
**Trigger:** Command (`/files`)

File action selector with TUI interface: reveal in Finder, Quick Look preview, open in editor,
edit file content, or add file content to the current prompt. Integrates with the system file manager.

---

**See also:** [Architecture Overview](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)

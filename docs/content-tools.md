## Content Tools Layer

File and resource manipulation tools.

### `notebook` — Jupyter Notebook Editor
**Trigger:** 🤖 Tool (`notebook`)

Cell-level editor for `.ipynb` files. Supports: read, edit, insert, delete cells. Handles both code and markdown cells. Previews long outputs with truncation.

### `mermaid` — Mermaid Diagram Renderer
**Trigger:** 🤖 Tool (`render_mermaid`)

Renders Mermaid diagram source to SVG or PNG. Requires the `mmdc` CLI (`npm i -g @mermaid-js/mermaid-cli`).

### `github` — GitHub API Client
**Trigger:** 🤖 Tool (GitHub operations)

Search code, create issues, create PRs, read files from GitHub repos. Uses `GITHUB_TOKEN` or `GH_TOKEN` for auth.

### `repeat` — Command Replay
**Trigger:** ⌨️ `/repeat`

Re-runs a previous bash/edit/write command, optionally with modifications. Cycles through command history.

**Origin:** [pi-hooks](https://github.com/prateekmedia/pi-hooks)

### `files-widget` — TUI File Browser
**Trigger:** ⌨️ `/readfiles` + 🔄 Hook (`tool_result`, `session_start`, `session_switch`)

In-terminal file browser with directory tree, file viewer, diff viewer, commenting, and line selection. Navigate files without leaving pi.

**Origin:** [pi-extensions](https://github.com/tmustier/pi-extensions)

### `raw-paste` — Editable Text Paste
**Trigger:** ⌨️ `/paste` + 🔄 Hook (`session_start`)

Pastes text as editable content, not as a collapsed `[paste #1 +21 lines]` block. Supports optional keybinding for quick access. Pasted text appears inline for review before sending.

**Origin:** [pi-extensions](https://github.com/tmustier/pi-extensions)

### `richard-files` — File Actions
**Trigger:** ⌨️ `/files` (or configured command name)

File actions with TUI selector: reveal in Finder, quicklook, open in editor, edit content, add file content to prompt. Supports directory display with configurable suffix. Integrates with the system file manager.

---


---

**See also:** [Intro](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)

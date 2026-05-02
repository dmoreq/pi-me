# content-tools/ Extension Explanations

File and resource utilities for manipulating content, files, and external services.

---

### 1. notebook

**Files:** `content-tools/notebook.ts` (91 lines, 1 test file)

**What it does:** Provides the `notebook` tool for editing Jupyter `.ipynb` files at the cell level. The agent uses this tool autonomously when working with notebooks.

**Supported operations:**
| Action | What it does |
|--------|-------------|
| `read` | Read a notebook's cell contents |
| `edit` | Modify a specific cell's source |
| `insert` | Add a new cell (code or markdown) at a given index |
| `delete` | Remove a cell at a given index |

Each cell is identified by its 0-based index. Markdown cells are rendered as text, code cells as code. Cell previews truncate at 200 characters to keep context small.

**Why it's useful:** Without this, working with Jupyter notebooks requires manual JSON editing or terminal-based tools. The agent can directly read, edit, insert, and delete cells as part of a data science workflow.

---

### 2. mermaid

**Files:** `content-tools/mermaid.ts` (57 lines)

**What it does:** Provides the `render_mermaid` tool that renders Mermaid diagram source code to SVG or PNG images using the `mmdc` CLI (mermaid-cli).

**Parameters:**
| Parameter | Description |
|-----------|-------------|
| `diagram` | Mermaid source code (flowchart, sequence, class, etc.) |
| `format` | Output format: `svg` (default) or `png` |

The agent calls this when asked to create diagrams, flowcharts, or visualizations. The rendered image is returned inline.

**Why it's useful:** Mermaid diagrams are widely used in documentation, specs, and planning. Without this, the agent could only describe diagrams in text.

---

### 3. github

**Files:** `content-tools/github.ts` (113 lines)

**What it does:** Provides the `github` tool for interacting with GitHub. Requires `GITHUB_TOKEN` environment variable.

**Supported actions:**
| Action | What it does |
|--------|-------------|
| `search_issues` | Search issues/PRs by query |
| `get_issue` | Get issue/PR details by number |
| `create_issue` | Create a new issue |
| `list_prs` | List open PRs |
| `get_pr` | Get PR details |
| `get_file_contents` | Read a file from any repo/ref |
| `search_code` | Search code across repositories |
| `search_repos` | Search repositories |

The agent calls this autonomously when the user asks about GitHub issues, PRs, or repository content.

**Why it's useful:** Core development workflow integration. Without this, the agent can't interact with GitHub.

---

### 4. repeat

**Files:** `content-tools/repeat/repeat.ts` + `types.d.ts` (2 files, 599 lines)

**What it does:** Provides the `/repeat` command that replays previous tool commands with optional modifications. Works with:

- `bash` — re-run a previous shell command
- `edit` — re-apply an edit with changes
- `write` — re-write a file

**Usage:** `/repeat` shows a picker of recent commands. Select one to replay or modify before replaying.

**Why it's useful:** Quick iteration — re-run a command with a small tweak without retyping the whole thing. Especially useful for `edit` operations where you want to refine the edit.

---

### 5. files-widget

**Files:** `content-tools/files-widget/` (11 files, 2,586 lines)

**What it does:** Provides the `/readfiles` command — a TUI file browser for reading and comparing files. Features:

- Directory tree navigation with keyboard shortcuts
- File viewer with syntax highlighting (detects language from extension)
- File diff viewer (compare two files side by side)
- Comment system — add annotations to files for agent context
- Git integration — view git status, diffs, and history from the browser
- Search within files

**Sub-modules:**
| File | Purpose |
|------|---------|
| `browser.ts` | File browser TUI |
| `file-tree.ts` | Directory tree rendering |
| `file-viewer.ts` | File content viewer |
| `viewer.ts` | Diff viewer |
| `git.ts` | Git integration |
| `comment.ts` | File comment system |
| `constants.ts` | Key bindings, config |

**Why it's useful:** A full file browser TUI for exploring and reading project files. The most feature-rich content tool.

---

### 6. raw-paste

**Files:** `content-tools/raw-paste/index.ts` (112 lines)

**What it does:** Provides the `/paste` command that intercepts bracketed paste mode (`\x1b[200~` ... `\x1b[201~`). When you paste text, it inserts it into the editor inline for review before sending — rather than sending it immediately as a message.

**How it works:**
1. User pastes text (terminal sends bracketed paste escape codes)
2. RawPasteEditor captures the pasted content
3. Content appears in the editor as editable text
4. User can review/modify before pressing Enter to send

**Why it's useful:** Prevents accidental sending of large paste content. Lets you review and edit pasted text before it becomes a message.

---

### 7. file-picker

**Files:** `content-tools/file-picker/` (2 files, 1,452 lines)

**What it does:** Provides the `/files` command — a TUI file selector with:

- Directory tree navigation
- File reveal in Finder (macOS)
- Quick Look preview (macOS)
- Editor actions (open in `$EDITOR`)
- Fuzzy file search and filtering

Originally from `richard-gill/pi-extensions` (named after the author Richard Gill). Renamed to `file-picker` for clarity.

**Why it's useful:** Quick file navigation without leaving the terminal. `/files` is faster than typing `read("path/to/file.txt")` for exploration.

---

### 8. web-fetch

**Files:** `content-tools/web-fetch/` (12 files, 3,707 lines)

**What it does:** HTTP fetcher for web content. Fetches web pages and extracts readable content. Supports:

| Feature | Description |
|---------|-------------|
| Browser profiles | Chrome 145, Safari, Firefox, Edge — configurable UA strings |
| JS rendering | Via browser automation (wreq-js) |
| Content extraction | Via linkedom (HTML parsing) + Defuddle (readability extraction) |
| Batch mode | Fetch multiple URLs with configurable concurrency |
| Timeout config | Default 15s, configurable |
| Image handling | Optionally remove images from output |

**Why it's useful:** The `web_search` tool returns search results (titles + snippets). `web-fetch` retrieves the actual page content. The agent uses `web_search` to find relevant pages, then `web-fetch` to read their full content.

---

### 9. markdown-preview

**Files:** `content-tools/markdown-preview/` (4 files, 974 lines)

**What it does:** Renders markdown to HTML for browser preview. Uses Puppeteer to open a browser tab with the rendered markdown.

**How it works:**
1. Takes markdown content
2. Converts to HTML with syntax highlighting for code blocks
3. Opens in the default browser via Puppeteer
4. Annotations in the markdown are highlighted in the preview

Requires `puppeteer-core` (heavy dependency — downloads Chromium).

**Why it's useful:** Previewing rendered markdown without leaving the terminal. Useful for documentation work where visual layout matters.

---

## Summary

| # | Extension | Lines | Tests | Tier | Purpose |
|---|-----------|-------|-------|------|---------|
| 1 | **notebook** | 91 | 1 | 🟡 Standard | Jupyter notebook cell editing |
| 2 | **mermaid** | 57 | 0 | 🟡 Standard | Diagram rendering to SVG/PNG |
| 3 | **github** | 113 | 0 | 🟡 Standard | GitHub API integration |
| 4 | **repeat** | 599 | 0 | 🟡 Standard | Replay previous commands |
| 5 | **files-widget** | 2,586 | 0 | 🟡 Standard | File browser TUI |
| 6 | **raw-paste** | 112 | 0 | 🟢 Optional | Paste editor |
| 7 | **file-picker** | 1,452 | 0 | 🟡 Standard | File selector TUI |
| 8 | **web-fetch** | 3,707 | 1 | 🟡 Standard | HTTP fetcher + content extraction |
| 9 | **markdown-preview** | 974 | 0 | 🟢 Optional | Markdown → HTML preview (heavy dep) |

All 9 are reasonable keeps. The two optional ones (`raw-paste` and `markdown-preview`) are small enough to keep without concern.

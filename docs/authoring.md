## Authoring Layer

AI-assisted content creation helpers.

### `output-artifacts` — Truncated Output Storage
**Trigger:** 🔄 Hook (`session_start`, `tool_result`, `before_agent_start`, `tool_call`)

Saves tool outputs that exceed 8000 characters to `.pi/artifacts/` as text files. Provides `artifact://` URLs to retrieve the full content later. Prevents context overflow while preserving access.

### `commit-helper` — Commit Message Generator
**Trigger:** 🤖 Tool (`commit_message`) + ⌨️ `/commit`

Analyzes staged/unstaged git diffs and generates a conventional commit message (type, scope, description). Uses LLM analysis of the diff to produce meaningful messages.

### `skill-bootstrap` — Auto-Generate SKILL.md
**Trigger:** ⌨️ `/bootstrap-skill`

Auto-detects project type (language, framework, test runner) and generates a `SKILL.md` documentation file with appropriate frontmatter and guidance.

---



---

---

**See also:** [Intro](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)

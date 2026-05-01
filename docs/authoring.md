# Authoring Layer

AI-assisted content creation tools for documentation, commit messages, and skill definitions.

---

## Extensions

### Output Artifacts

**Source:** `authoring/output-artifacts/output-artifacts.ts`
**Trigger:** Hook (`session_start`, `tool_result`, `before_agent_start`, `tool_call`)

Saves truncated tool outputs (>8,000 characters) to `.pi/artifacts/` as text files. Provides `artifact://`
URLs for the agent to retrieve full content via the `read` tool. Prevents context window overflow while
preserving access to complete output.

### Commit Helper

**Source:** `authoring/commit-helper/commit-helper.ts`
**Trigger:** Tool (`commit_message`) · Command (`/commit`)

Analyzes staged or unstaged git diffs via LLM to generate conventional commit messages with type, scope,
and description. The `/commit` command provides interactive commit message selection and editing.

### Skill Bootstrap

**Source:** `authoring/skill-bootstrap/skill-bootstrap.ts`
**Trigger:** Command (`/bootstrap-skill`)

Auto-detects project characteristics (language, framework, build system, test runner) and generates
a `SKILL.md` documentation file with appropriate frontmatter and guidance tailored to the project.

---

**See also:** [Architecture Overview](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Skills](skills.md)

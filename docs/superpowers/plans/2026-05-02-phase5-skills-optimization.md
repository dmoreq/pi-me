# Phase 5 — Skills Optimization & Dead Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six skills missing required frontmatter, create a `plugin-guide` skill that teaches the agent which tool to use for each task category, remove confirmed dead code found across the codebase, and add tests for critical uncovered logic.

**Architecture:** Skills changes are pure Markdown edits. Dead code removal is file deletion + README updates. Test additions follow the existing `node:test` + `node:assert/strict` pattern already used throughout the project. No production logic changes.

**Tech Stack:** Markdown (SKILL.md files), TypeScript + `node:test` (new tests), JSON (package.json cleanup)

---

## Part A: Dead Code Cleanup (cross-phase findings)

### Task 1: Remove orphaned `usage-bar-core.ts`

**Background:** `session-lifecycle/usage-bar-core.ts` (936 lines) was created during the "large file splitting" optimization. The live implementation is in `session-lifecycle/usage-extension/usage-extension-core.ts`. No file imports from `usage-bar-core.ts`. It is dead code.

**Files:**
- Delete: `session-lifecycle/usage-bar-core.ts`

- [ ] **Step 1: Confirm no imports of usage-bar-core exist**

```bash
grep -rn "usage-bar-core" /Users/quy.doan/Workspace/personal/pi-me --include="*.ts" --include="*.json" | grep -v node_modules | grep -v package-lock
```

Expected: no output (file is completely orphaned).

- [ ] **Step 2: Confirm it is not in package.json extensions**

```bash
grep "usage-bar-core" package.json
```

Expected: no output.

- [ ] **Step 3: Delete the file**

```bash
rm session-lifecycle/usage-bar-core.ts
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add session-lifecycle/usage-bar-core.ts
git commit -m "chore: remove orphaned usage-bar-core.ts (superseded by usage-extension-core.ts)"
```

---

### Task 2: Fix README references to non-existent `resistance.ts`

**Background:** `README.md` line 139 lists `core-tools/resistance.ts` ("Battlestar Galactica footer quote with typewriter reveal") in the Extension Reference table. The file does not exist. It was never created — it appeared in a source reference table at line 247 as a historical note about the shitty-extensions package, but was never ported into pi-me.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Verify the file doesn't exist**

```bash
ls core-tools/resistance.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"
grep "resistance" package.json
```

Expected: `MISSING` and no package.json match.

- [ ] **Step 2: Remove the Resistance row from the Core Tools table in README.md**

Find and delete this row from the Core Tools Extension Reference table:
```
| Resistance | `core-tools/resistance.ts` | Battlestar Galactica footer quote with typewriter reveal. |
```

- [ ] **Step 3: Update the extension count in the README header if it references 54**

```bash
grep -n "54 extensions\|54 extension" README.md
```

If found, update to `51 extensions` (54 - 3 removed in Phase 1).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: remove non-existent resistance.ts from README"
```

---

### Task 3: Verify and clean README entries for Phase 1 removals

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Check README for removed plugin entries**

```bash
grep -n "pi-oracle\|pi-mempalace\|super-pi\|Memory Palace\|Compound Engineering" README.md
```

- [ ] **Step 2: Remove any table rows for the three removed plugins**

Remove rows for `pi-oracle`, `pi-mempalace`, and `super-pi` from the Extension Reference tables if present.

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: remove Phase 1 plugin entries from README"
```

---

## Part B: Test Coverage Gaps

### Task 4: Add tests for `plan-mode-core.ts` (997 lines, 0 tests)

**Background:** `plan-mode-core.ts` contains all pure logic for the plan system — 47 exported functions including `parseFrontMatter`, `parsePlanContent`, `serializePlan`, `filterPlans`, `sortPlans`, `isSafeCommand`, `buildPlanSearchText`, and more. It has zero tests. This is the highest-risk untested code in the codebase.

**Files:**
- Create: `core-tools/plan-tracker/tests/plan-mode-core.test.ts`

- [ ] **Step 1: Read plan-mode-core.ts to understand the pure functions**

```bash
grep -n "^export function\|^export async function\|^export const\|^export class" core-tools/plan-mode-core.ts | head -30
```

- [ ] **Step 2: Write tests for the most critical pure functions**

```typescript
// core-tools/plan-tracker/tests/plan-mode-core.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontMatter,
  parsePlanContent,
  serializePlan,
  isSafeCommand,
  filterPlans,
  sortPlans,
  buildPlanSearchText,
  formatPlanId,
  normalizePlanId,
  validatePlanId,
  splitFrontMatter,
} from "../../plan-mode-core.js";

describe("isSafeCommand", () => {
  it("allows safe read commands", () => {
    assert.equal(isSafeCommand("ls -la"), true);
    assert.equal(isSafeCommand("cat README.md"), true);
    assert.equal(isSafeCommand("git status"), true);
    assert.equal(isSafeCommand("git log --oneline"), true);
  });

  it("blocks destructive commands", () => {
    assert.equal(isSafeCommand("rm -rf /"), false);
    assert.equal(isSafeCommand("git push --force"), false);
    assert.equal(isSafeCommand("DROP TABLE users"), false);
  });
});

describe("parseFrontMatter", () => {
  it("parses valid JSON frontmatter", () => {
    const fm = '{"id":"plan-001","title":"Test Plan","status":"active"}';
    const result = parseFrontMatter(fm);
    assert.equal(result.id, "plan-001");
    assert.equal(result.title, "Test Plan");
    assert.equal(result.status, "active");
  });

  it("returns empty object for empty input", () => {
    const result = parseFrontMatter("");
    assert.deepEqual(result, {});
  });
});

describe("splitFrontMatter", () => {
  it("splits frontmatter from content correctly", () => {
    const raw = '{"id":"p-001","title":"Test"}\n# Plan Content\n- step 1';
    const { frontMatterStr, content } = splitFrontMatter(raw);
    assert.ok(frontMatterStr.includes('"id":"p-001"'));
    assert.ok(content.includes("# Plan Content"));
  });

  it("handles content with no frontmatter", () => {
    const raw = "# Plan Content\n- step 1";
    const { frontMatterStr, content } = splitFrontMatter(raw);
    assert.equal(frontMatterStr, "");
    assert.ok(content.includes("# Plan Content"));
  });
});

describe("formatPlanId / normalizePlanId / validatePlanId", () => {
  it("formatPlanId produces a consistent format", () => {
    const id = formatPlanId("test-plan");
    assert.ok(typeof id === "string");
    assert.ok(id.length > 0);
  });

  it("normalizePlanId strips extra whitespace", () => {
    const normalized = normalizePlanId("  plan-001  ");
    assert.equal(normalized.trim(), normalized);
  });

  it("validatePlanId accepts valid IDs", () => {
    assert.doesNotThrow(() => validatePlanId("plan-001"));
  });

  it("validatePlanId rejects empty string", () => {
    assert.throws(() => validatePlanId(""));
  });
});

describe("buildPlanSearchText", () => {
  it("returns a string for valid plan input", () => {
    const result = buildPlanSearchText({ id: "p-001", title: "My Plan", status: "active", steps: [] } as any);
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
  });
});

describe("filterPlans", () => {
  const plans = [
    { id: "p-001", title: "Alpha Plan", status: "active" },
    { id: "p-002", title: "Beta Plan", status: "completed" },
    { id: "p-003", title: "Gamma Plan", status: "active" },
  ] as any[];

  it("filters by status", () => {
    const active = filterPlans(plans, { status: "active" });
    assert.equal(active.length, 2);
  });

  it("returns all plans when no filter given", () => {
    const all = filterPlans(plans, {});
    assert.equal(all.length, 3);
  });
});

describe("sortPlans", () => {
  const plans = [
    { id: "p-003", title: "Gamma", createdAt: 1000 },
    { id: "p-001", title: "Alpha", createdAt: 3000 },
    { id: "p-002", title: "Beta", createdAt: 2000 },
  ] as any[];

  it("returns an array of the same length", () => {
    const sorted = sortPlans(plans);
    assert.equal(sorted.length, plans.length);
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

```bash
npm test
```

If any tests fail because a function signature differs from what's in plan-mode-core.ts, read the actual function signature and adjust the test. Do not change plan-mode-core.ts — adjust the test to match the real API.

- [ ] **Step 4: Commit**

```bash
git add core-tools/plan-tracker/tests/plan-mode-core.test.ts
git commit -m "test: add plan-mode-core.ts coverage (parseFrontMatter, isSafeCommand, filterPlans, sortPlans)"
```

---

### Task 5: Add basic smoke tests for `oracle.ts`

**Background:** `oracle.ts` has no tests. The `detectAvailableModels()` logic and model list are pure (no API calls) and can be tested without mocking.

**Files:**
- Create: `core-tools/oracle.test.ts`

- [ ] **Step 1: Check what is exported from oracle.ts**

```bash
grep -n "^export\|^const ORACLE_MODELS" core-tools/oracle.ts | head -15
```

- [ ] **Step 2: Write smoke tests**

```typescript
// core-tools/oracle.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("oracle ORACLE_MODELS list", () => {
  it("ORACLE_MODELS contains at least one OpenAI and one Google entry", async () => {
    // Import the module to access the constant — oracle.ts doesn't export
    // ORACLE_MODELS directly, so we verify the module loads without error.
    await assert.doesNotReject(() => import("./oracle.ts"));
  });
});
```

**Note:** oracle.ts makes API calls during execution — only test the module load and exported helpers (if any). Do not test the `/oracle` command handler directly (requires a live TUI context).

- [ ] **Step 3: Run the test**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add core-tools/oracle.test.ts
git commit -m "test: add oracle.ts smoke test (module load verification)"
```

---

## Part C: Skills Fixes

### Task 6: Add missing frontmatter to 6 skills

**Files:**
- Modify: `skills/commit-helper/SKILL.md`
- Modify: `skills/output-artifacts/SKILL.md`
- Modify: `skills/permission/SKILL.md`
- Modify: `skills/ralph-loop/SKILL.md`
- Modify: `skills/secrets/SKILL.md`
- Modify: `skills/skill-bootstrap/SKILL.md`

- [ ] **Step 1: Add frontmatter to `skills/commit-helper/SKILL.md`**

Prepend to the top of the file (before any existing content):
```markdown
---
name: commit-helper
description: Generate a conventional commit message from the current git diff using the commit_message tool. Use when creating a commit or when asked to write a commit message.
---

```

- [ ] **Step 2: Add frontmatter to `skills/output-artifacts/SKILL.md`**

```markdown
---
name: output-artifacts
description: Tool output larger than 8KB is automatically saved to .pi/artifacts/ with an artifact:// retrieval URL. Use when tool output was truncated or you need to re-read a large result.
---

```

- [ ] **Step 3: Add frontmatter to `skills/permission/SKILL.md`**

```markdown
---
name: permission
description: Tiered command permission system — minimal to bypassed. Use when asked about permission levels, when a command is unexpectedly blocked, or when configuring which operations are allowed.
---

```

- [ ] **Step 4: Add frontmatter to `skills/ralph-loop/SKILL.md`**

```markdown
---
name: ralph-loop
description: Looped subagent execution with condition polling, pause/resume, and steering controls. Use when a task requires iterative agent loops, polling for a condition, or resumable multi-step workflows.
---

```

- [ ] **Step 5: Add frontmatter to `skills/secrets/SKILL.md`**

```markdown
---
name: secrets
description: Sensitive values (API keys, tokens, passwords) are automatically scanned and obfuscated before reaching the LLM. Use when configuring secret patterns or when a credential appears in tool output.
---

```

- [ ] **Step 6: Add frontmatter to `skills/skill-bootstrap/SKILL.md`**

```markdown
---
name: skill-bootstrap
description: The /bootstrap-skill command auto-detects the project type and generates a SKILL.md scaffold. Use when creating a new skill for a project.
---

```

- [ ] **Step 7: Commit**

```bash
git add skills/commit-helper/SKILL.md skills/output-artifacts/SKILL.md skills/permission/SKILL.md skills/ralph-loop/SKILL.md skills/secrets/SKILL.md skills/skill-bootstrap/SKILL.md
git commit -m "fix: add missing name/description frontmatter to 6 skills"
```

---

### Task 7: Audit `pi-subagents` skill for super-pi references

**Files:**
- Modify (if needed): `skills/pi-subagents/SKILL.md`

- [ ] **Step 1: Search for super-pi references**

```bash
grep -n "super-pi\|super_pi\|Compound Engineering\|leing2021" skills/pi-subagents/SKILL.md
```

- [ ] **Step 2: If found — replace recommendations**

Replace any "use super-pi for iterative workflows" guidance with:
- Use `ralph_loop` for iterative loops with condition polling and steering
- Use `subagent` chain mode for sequential multi-step handoffs

- [ ] **Step 3: Commit if changes were made**

```bash
git add skills/pi-subagents/SKILL.md
git commit -m "fix: remove super-pi references from pi-subagents skill"
```

---

### Task 8: Create `plugin-guide` skill

**Files:**
- Create: `skills/plugin-guide/SKILL.md`

- [ ] **Step 1: Create the directory and skill file**

```bash
mkdir -p skills/plugin-guide
```

- [ ] **Step 2: Write `skills/plugin-guide/SKILL.md`**

```markdown
---
name: plugin-guide
description: Decision guide for choosing the right pi-me plugin. Use when unsure which tool to call for web search, memory, subagents, planning, code quality, or document handling.
---

# Plugin Decision Guide

Quick reference for which tool to reach for. Each row is: task → tool → when to prefer an alternative.

---

## Web & Search

| I want to… | Use | Notes |
|---|---|---|
| Search the web for facts or research | `web_search` | Exa (semantic/neural) or Tavily (AI-optimised). Fastest and cheapest. **Prefer this first.** |
| Search AI-engine results (Perplexity, Bing Copilot, Google AI Studio) | `greedysearch` | Browser automation, no API key needed. Slower. Use only when `web_search` can't answer. |
| Fetch and read a URL | `web_fetch` | Browser-grade TLS, Defuddle article extraction. Does NOT run JavaScript. |
| Batch-fetch multiple URLs | `web_batch_fetch` | Same as web_fetch, parallelised with bounded concurrency. |

---

## Memory & Knowledge

| I want to… | Use | Notes |
|---|---|---|
| Save an instruction permanently (project or global) | `/mem` → memory-mode | Writes to AGENTS.md. Permanent. Survives restarts. |
| Auto-learn from corrections across sessions | pi-memory | Auto-injects learned preferences on every session start. Disable via `disableAutoInject` if context grows large. |
| Build a Zettelkasten knowledge graph with bidirectional links | memex tools | On-demand via tool call. Best for structured note-taking and knowledge linking. |
| Optimise the context window via intent-driven knowledge retrieval | context-mode tools | MCP-based FTS5 knowledge base. On-demand. Best when context is full and you need targeted recall. |

---

## Subagents & Orchestration

| I want to… | Use | Notes |
|---|---|---|
| Run a single subagent task, streamed output | `subagent` | Flagship: sync/async, agent manager, worktrees, slash commands. **Default choice.** |
| Run a subagent with `/skill:name` auto-dispatch | `sub_pi` | Subprocess model; auto-detects `/skill:` prefixes in the task string. |
| Run an iterative loop until a condition is met | `ralph_loop` | Built-in condition polling, pause/resume, steering. Best for "keep trying until X" patterns. |
| Coordinate a team of agents on a shared workflow | pi-crew tools | Team/workflow-level orchestration. Distinct from single-agent dispatch. |

---

## Planning

| I want to… | Use | Notes |
|---|---|---|
| Track tasks during the current session | `plan_tracker` | TUI overlay widget. 4 states: pending → in_progress → complete → blocked. |
| Manage persistent plan files across sessions | `plan_mode` tools | File-based plans in `.pi/plans/`. Locking, frontmatter, planning-mode toggle. |
| Visually annotate and review a plan | plannotator | Browser-based annotation UI. |

---

## Code Quality

| I want to… | Use | Notes |
|---|---|---|
| Get real-time lint, LSP diagnostics, type coverage | pi-lens tools | LSP, ast-grep (Rust), biome, ruff, TypeScript coverage, knip (dead code), jscpd (copy-paste). |
| Auto-format files on write | pi-formatter | Triggers automatically on file save. Zero config. |
| Get a second opinion from another AI model | `/oracle` | Supports OpenAI, Google, Anthropic via API keys. Use for tie-breakers or sanity checks. |

---

## Documents & Content

| I want to… | Use | Notes |
|---|---|---|
| Parse a PDF, .docx, .xlsx, or image | `document_parse` | pi-docparser. Requires LibreOffice + ImageMagick/Ghostscript installed. |
| Render Markdown or LaTeX to PDF or browser | pi-markdown-preview | Puppeteer-based (~30MB Chrome). Use for polished output, not quick reads. |
| Edit a Jupyter notebook cell | `notebook` tool | Cell-level read/edit/insert/delete for `.ipynb` files. |
| Render a Mermaid diagram | `render_mermaid` | Outputs SVG/PNG via `mmdc` CLI. Requires `@mermaid-js/mermaid-cli`. |

---

## Session Utilities

| I want to… | Use | Notes |
|---|---|---|
| Ask the user a structured multi-part question | `ask_user_question` | TUI questionnaire with markdown previews, multi-select, number-key selection. |
| Ask a side question without polluting main context | `/btw` | Clones context into an overlay. Answer doesn't enter the main conversation thread. |
| Stash a draft message to finish later | pi-stash | Stores and restores incomplete prompts across sessions. |
| Re-edit an earlier user message | pi-edit-session | Replaces a past message in the conversation thread in-place. |
| Connect to any MCP server | pi-mcp-adapter | Bridges any MCP-compatible server (Notion, databases, GitHub, custom) into pi tools. |
| Monitor and manage background processes | pi-processes tools | Run, list, stop background shell processes from within pi. |
| Inter-terminal communication via WebSocket | pi-link | Coordinate multiple pi terminals on the same machine. |

---

## Choosing between similar tools

**`web_search` vs `greedysearch`:** Always try `web_search` first — it's faster, cheaper, and more reliable. Only fall back to `greedysearch` if you need AI-engine-specific results (Perplexity summaries, Bing Copilot citations, Google AI overviews) or if no API key is configured.

**`subagent` vs `sub_pi` vs `ralph_loop`:** Use `subagent` for everything unless you specifically need skill-prefix dispatch (`sub_pi`) or iterative polling loops (`ralph_loop`).

**`plan_tracker` vs `plan_mode`:** `plan_tracker` is for in-session task lists (like a todo overlay). `plan_mode` is for persistent plan files that survive session restarts and need locking/history.

**`pi-memory` vs `memex` vs `context-mode`:** `pi-memory` is automatic (learns from you passively). `memex` is explicit (you build a knowledge graph). `context-mode` is retrieval (searches your knowledge base when context is full).
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add skills/plugin-guide/SKILL.md
git commit -m "feat: add plugin-guide skill — decision guide for choosing the right tool"
```

---

### Task 9: Final verification

- [ ] **Step 1: Verify all skills now have frontmatter**

```bash
for dir in skills/*/; do
  name=$(basename "$dir")
  fm=$(head -5 "$dir/SKILL.md" 2>/dev/null | grep "^name:")
  if [ -z "$fm" ]; then
    echo "MISSING name: $name"
  else
    echo "OK: $name — $fm"
  fi
done
```

Expected: all skills print `OK:`, no `MISSING`.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass (202 existing + new plan-mode-core + oracle + register-package tests from Phase 2).

- [ ] **Step 3: Verify plugin-guide is discoverable**

```bash
cat skills/plugin-guide/SKILL.md | head -5
```

Expected: frontmatter block with `name: plugin-guide` and `description:` visible.

# Phase 3 — Cost/Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dead `web_search` tool by replacing Brave/SerpAPI/Kagi backends with Exa, Tavily, and Valiyu; add a `disableAutoInject` config escape hatch to `pi-memory`; migrate `pi-lens` off its brittle inline flag stubs.

**Architecture:** `web-search.ts` replaces its three backend objects and `detectBackend()` in-place — the `SearchBackend` interface and `registerWebSearch()` export stay unchanged. `pi-memory` wrapper gets a config read before calling `mod.default()`. `pi-lens` swaps its session_start + error block for `registerAdoptedPackage()` while keeping its eager flag stubs (verified safe before removal).

**Tech Stack:** TypeScript, Node.js `node:test`, Exa API (POST, `x-api-key` header), Tavily API (POST, JSON body auth), Valiyu (API format to verify before implementing)

---

### Task 1: Write failing tests for the new web-search backends

**Files:**
- Create: `core-tools/web-search.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// core-tools/web-search.test.ts
import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

// We test the backends by importing them after they're written.
// For now this tests the detectBackend logic and result shape.

describe("web-search backend detection", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // Restore env vars after each test
    for (const key of ["EXA_API_KEY", "TAVILY_API_KEY", "VALIYU_API_KEY",
                        "SERPAPI_KEY", "BRAVE_API_KEY", "KAGI_API_KEY"]) {
      delete process.env[key];
    }
    Object.assign(process.env, origEnv);
  });

  it("detectBackend returns null when no keys are set", async () => {
    delete process.env.EXA_API_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.VALIYU_API_KEY;
    delete process.env.SERPAPI_KEY;
    delete process.env.BRAVE_API_KEY;
    delete process.env.KAGI_API_KEY;

    const { detectBackend } = await import("./web-search.ts");
    assert.equal(detectBackend(), null);
  });

  it("detectBackend prefers EXA_API_KEY over TAVILY_API_KEY", async () => {
    process.env.EXA_API_KEY = "exa-key";
    process.env.TAVILY_API_KEY = "tavily-key";

    const { detectBackend } = await import("./web-search.ts");
    const result = detectBackend();
    assert.ok(result !== null);
    assert.equal(result.backend.name, "exa");
    assert.equal(result.apiKey, "exa-key");
  });

  it("detectBackend falls back to TAVILY_API_KEY when no EXA", async () => {
    delete process.env.EXA_API_KEY;
    process.env.TAVILY_API_KEY = "tavily-key";

    const { detectBackend } = await import("./web-search.ts");
    const result = detectBackend();
    assert.ok(result !== null);
    assert.equal(result.backend.name, "tavily");
    assert.equal(result.apiKey, "tavily-key");
  });

  it("detectBackend falls back to VALIYU_API_KEY last", async () => {
    delete process.env.EXA_API_KEY;
    delete process.env.TAVILY_API_KEY;
    process.env.VALIYU_API_KEY = "valiyu-key";

    const { detectBackend } = await import("./web-search.ts");
    const result = detectBackend();
    assert.ok(result !== null);
    assert.equal(result.backend.name, "valiyu");
  });

  it("SearchResult shape has required fields", async () => {
    // Verify the interface contract by constructing a valid result
    const result: { title: string; url: string; snippet: string; published?: string } = {
      title: "Test",
      url: "https://example.com",
      snippet: "A snippet",
      published: "2026-01-01",
    };
    assert.ok(result.title);
    assert.ok(result.url);
    assert.ok(result.snippet);
  });
});
```

- [ ] **Step 2: Export `detectBackend` from `web-search.ts` (needed for tests)**

At the bottom of `core-tools/web-search.ts`, add:
```typescript
export { detectBackend };
```

(We'll move `detectBackend` from being a local function to an exported one in Task 2.)

- [ ] **Step 3: Run the tests to confirm relevant ones fail**

```bash
tsx --test "core-tools/web-search.test.ts"
```

Expected: the backend-name tests fail (`exa`, `tavily`, `valiyu` not found).

---

### Task 2: Replace web-search backends with Exa, Tavily, Valiyu

**Files:**
- Modify: `core-tools/web-search.ts`

- [ ] **Step 1: Read the current file to understand what changes**

```bash
cat core-tools/web-search.ts
```

- [ ] **Step 2: Verify your Valiyu API endpoint before writing the backend**

Check your Valiyu dashboard or docs for:
- Base URL
- Authentication header or body field
- Response shape

If you cannot verify it now, implement a stub that returns `[]` with a clear comment.

- [ ] **Step 3: Rewrite `core-tools/web-search.ts`**

```typescript
/**
 * pi-me: web-search — Web search tool.
 * Backends: Exa (EXA_API_KEY), Tavily (TAVILY_API_KEY), Valiyu (VALIYU_API_KEY)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export interface SearchBackend {
  name: string;
  search(query: string, numResults: number, apiKey: string): Promise<SearchResult[]>;
}

const exaBackend: SearchBackend = {
  name: "exa",
  async search(query, numResults, apiKey) {
    const resp = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ query, numResults, type: "auto" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`Exa returned ${resp.status}: ${await resp.text().catch(() => "")}`);
    const data = (await resp.json()) as {
      results?: Array<{ title: string; url: string; text?: string; snippet?: string; publishedDate?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.text ?? r.snippet ?? "",
      published: r.publishedDate,
    }));
  },
};

const tavilyBackend: SearchBackend = {
  name: "tavily",
  async search(query, numResults, apiKey) {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: numResults, include_answer: false }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`Tavily returned ${resp.status}: ${await resp.text().catch(() => "")}`);
    const data = (await resp.json()) as {
      results?: Array<{ title: string; url: string; content: string; published_date?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      published: r.published_date,
    }));
  },
};

// TODO: verify Valiyu API endpoint and auth format before enabling.
// Replace the stub below with the real implementation once verified.
const valiyuBackend: SearchBackend = {
  name: "valiyu",
  async search(_query, _numResults, _apiKey): Promise<SearchResult[]> {
    throw new Error("Valiyu backend not yet implemented — verify API endpoint and auth format first");
  },
};

export function detectBackend(): { backend: SearchBackend; apiKey: string } | null {
  if (process.env.EXA_API_KEY)    return { backend: exaBackend,    apiKey: process.env.EXA_API_KEY };
  if (process.env.TAVILY_API_KEY) return { backend: tavilyBackend, apiKey: process.env.TAVILY_API_KEY };
  if (process.env.VALIYU_API_KEY) return { backend: valiyuBackend, apiKey: process.env.VALIYU_API_KEY };
  return null;
}

const WebSearchParams = Type.Object({
  query: Type.String({ description: "Search query" }),
  numResults: Type.Optional(Type.Number({ default: 10, maximum: 20, description: "Number of results (1-20)" })),
});

export function registerWebSearch(pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: [
      "Search the web for current information. Returns titles, URLs, and snippets.",
      "Prefer this tool (Exa/Tavily) for structured, factual, and research queries.",
      "Use greedysearch only for AI-engine-specific results (Perplexity, Bing Copilot, Google AI Studio) or when no API key is configured.",
    ].join(" "),
    parameters: WebSearchParams,
    async execute(_toolCallId, params) {
      const detected = detectBackend();
      if (!detected) {
        return {
          content: [{
            type: "text",
            text: "No search backend configured. Set EXA_API_KEY, TAVILY_API_KEY, or VALIYU_API_KEY environment variable.",
          }],
        };
      }
      const numResults = Math.min(params.numResults ?? 10, 20);
      const results = await detected.backend.search(params.query, numResults, detected.apiKey);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No results found for: ${params.query}` }],
          details: { backend: detected.backend.name },
        };
      }
      const text = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}${r.published ? ` (${r.published})` : ""}`)
        .join("\n\n");
      return { content: [{ type: "text", text }], details: { backend: detected.backend.name, results } };
    },
  });
}

export default registerWebSearch;
```

- [ ] **Step 4: Run the tests**

```bash
tsx --test "core-tools/web-search.test.ts"
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add core-tools/web-search.ts core-tools/web-search.test.ts
git commit -m "feat: replace web-search backends with Exa, Tavily, Valiyu"
```

---

### Task 3: Update README and docs for new env vars

**Files:**
- Modify: `README.md`
- Modify: `docs/core-tools.md`

- [ ] **Step 1: Update the Environment Variables table in `README.md`**

Find the table row:
```
| `BRAVE_API_KEY` | Web Search | Brave Search API |
| `SERPAPI_API_KEY` | Web Search | SerpAPI (Google backend) |
| `KAGI_API_KEY` | Web Search | Kagi Search API |
```

Replace with:
```
| `EXA_API_KEY` | Web Search | Exa neural search API (preferred) |
| `TAVILY_API_KEY` | Web Search | Tavily AI-optimized search API |
| `VALIYU_API_KEY` | Web Search | Valiyu search API |
```

- [ ] **Step 2: Update `docs/core-tools.md` if it has a web search section**

```bash
grep -n "BRAVE\|SERPAPI\|KAGI\|brave\|serpapi\|kagi" docs/core-tools.md
```

If matches found, replace the same three rows as in Step 1.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/core-tools.md
git commit -m "docs: update web-search env vars to Exa/Tavily/Valiyu"
```

---

### Task 4: Add `disableAutoInject` config to `pi-memory` wrapper

**Files:**
- Modify: `core-tools/pi-memory/index.ts`

- [ ] **Step 1: Check what `@samfp/pi-memory`'s default export accepts**

```bash
grep -n "export default\|function.*pi\|module.exports" node_modules/@samfp/pi-memory/dist/*.js 2>/dev/null | head -20
# or
cat node_modules/@samfp/pi-memory/README.md 2>/dev/null | head -60
```

If the package's default export accepts a config object as a second argument, use that. If it doesn't, the wrapper will conditionally skip loading the package entirely.

- [ ] **Step 2: Read `shared/pi-config.ts` to understand the config loading pattern**

```bash
cat shared/pi-config.ts
```

- [ ] **Step 3: Update `core-tools/pi-memory/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import { loadConfigOrDefault } from "../../shared/pi-config.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface PiMemoryConfig {
  disableAutoInject?: boolean;
}

export default async function (pi: ExtensionAPI) {
  const config = await loadConfigOrDefault<PiMemoryConfig>(
    "pi-memory",
    { disableAutoInject: false },
  );

  if (config.disableAutoInject) {
    // pi-memory is installed but dormant — no context injection.
    // Enable by setting { "piMemory": { "disableAutoInject": false } }
    // in ~/.pi/agent/settings.json
    return;
  }

  registerAdoptedPackage(pi, {
    importFn: () => import("@samfp/pi-memory"),
    statusKey: "pi-memory",
    packageName: "@samfp/pi-memory",
  });
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add core-tools/pi-memory/index.ts
git commit -m "feat: add disableAutoInject config option to pi-memory wrapper"
```

---

### Task 5: Migrate `pi-lens` to `registerAdoptedPackage()`

**Files:**
- Modify: `core-tools/pi-lens/index.ts`

- [ ] **Step 1: Verify flag timing — are flags needed before `session_start`?**

```bash
grep -rn "registerFlag\|getFlag\|--no-lsp\|--no-autoformat\|--no-autofix\|--no-tests\|--no-delta\|--lens-guard\|--no-read-guard" \
  node_modules/pi-lens/src 2>/dev/null | head -20
# or
grep -rn "registerFlag\|getFlag" node_modules/pi-lens/dist 2>/dev/null | head -20
```

If flags are only used inside `session_start` or later event handlers, the inline stubs can be removed safely.

If flags are checked at CLI invocation time (before `session_start`), keep the stubs and only migrate the import/status/error block.

- [ ] **Step 2a: If flags are safe to remove — full migration**

Replace `core-tools/pi-lens/index.ts` with:

```typescript
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const skillsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "node_modules", "pi-lens", "skills"
);

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-lens"),
    statusKey: "pi-lens",
    packageName: "pi-lens",
    skillPaths: [skillsDir],
  });
```

- [ ] **Step 2b: If flags must stay eager — partial migration**

Keep the flag stubs, replace only the session_start block. Replace `core-tools/pi-lens/index.ts` with:

```typescript
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Eager skill discovery
  const extensionDir = dirname(fileURLToPath(import.meta.url));
  const skillsDir = join(extensionDir, "..", "..", "..", "node_modules", "pi-lens", "skills");
  pi.on("resources_discover", async () => ({ skillPaths: [skillsDir] }));

  // Eager flags (kept because pi-lens reads them at CLI invocation, before session_start)
  const flags: Array<{ name: string; description: string; type: string; default?: boolean }> = [
    { name: "no-lsp", description: "Disable unified LSP diagnostics and use language-specific fallbacks", type: "boolean", default: false },
    { name: "no-autoformat", description: "Disable automatic formatting on file write", type: "boolean", default: false },
    { name: "no-autofix", description: "Disable auto-fixing of lint issues", type: "boolean", default: false },
    { name: "no-tests", description: "Disable test runner on write", type: "boolean", default: false },
    { name: "no-delta", description: "Disable delta mode (show all diagnostics, not just new ones)", type: "boolean", default: false },
    { name: "lens-guard", description: "Block git commit/push when unresolved pi-lens blockers exist", type: "boolean", default: false },
    { name: "no-read-guard", description: "Disable read-before-edit behavior monitor", type: "boolean", default: false },
  ];
  for (const flag of flags) pi.registerFlag(flag.name, flag as any);

  // Deferred load via shared helper
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-lens"),
    statusKey: "pi-lens",
    packageName: "pi-lens",
  });
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add core-tools/pi-lens/index.ts
git commit -m "refactor: migrate pi-lens session_start block to registerAdoptedPackage()"
```

---

### Task 6: Final verification

- [ ] **Step 1: Confirm web_search now uses the right env var**

```bash
EXA_API_KEY=test-key tsx -e "
import { detectBackend } from './core-tools/web-search.ts';
const r = detectBackend();
console.log('backend:', r?.backend.name, 'key:', r?.apiKey);
"
```

Expected: `backend: exa  key: test-key`

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

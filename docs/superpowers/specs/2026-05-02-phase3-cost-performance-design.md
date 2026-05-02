# Phase 3 — Cost/Performance Design

**Date:** 2026-05-02
**Status:** Approved
**Depends on:** Phase 2 (shared unification, for pi-lens migration)

## Goal

Fix the web-search backend mismatch (currently configured for APIs the user doesn't have), document the memory injection cost boundary, and clean up the pi-lens flag workaround left from before `registerAdoptedPackage` existed.

## Change 1: Replace web-search backends with Exa, Tavily, Valiyu

### Problem

`core-tools/web-search.ts` currently checks for `SERPAPI_KEY`, `BRAVE_API_KEY`, and `KAGI_API_KEY`. None of these are configured. The tool silently returns "No search backend configured" on every call, making `web_search` a dead tool. The agent then falls back to `greedysearch-pi` (browser automation) for all web queries, which is slower and more fragile than a direct API call.

### Solution

Replace all three backend implementations with Exa, Tavily, and Valiyu. Keep the `SearchBackend` interface unchanged — only the implementations and `detectBackend()` change.

#### Detection priority

```ts
function detectBackend(): { backend: SearchBackend; apiKey: string } | null {
  if (process.env.EXA_API_KEY)    return { backend: exaBackend,    apiKey: process.env.EXA_API_KEY };
  if (process.env.TAVILY_API_KEY) return { backend: tavilyBackend, apiKey: process.env.TAVILY_API_KEY };
  if (process.env.VALIYU_API_KEY) return { backend: valiyuBackend, apiKey: process.env.VALIYU_API_KEY };
  return null;
}
```

#### Exa backend

- Endpoint: `https://api.exa.ai/search`
- Auth header: `x-api-key: <EXA_API_KEY>`
- Strength: Neural/semantic search — best for research, concept-based, and similarity queries
- Response mapping: `result.title`, `result.url`, `result.text` (or `result.snippet`), `result.publishedDate`

#### Tavily backend

- Endpoint: `https://api.tavily.com/search`
- Auth: JSON body field `api_key`
- Strength: Optimized for AI agents — returns clean structured results with source attribution
- Response mapping: `result.title`, `result.url`, `result.content`, `result.published_date`

#### Valiyu backend

- **API format needs manual verification before implementation** — Valiyu API docs not in training data
- Placeholder implementation with a clear `// TODO: verify Valiyu API endpoint and auth format` comment
- Env var: `VALIYU_API_KEY`

#### Error message update

```ts
return {
  content: [{
    type: "text",
    text: "No search backend configured. Set EXA_API_KEY, TAVILY_API_KEY, or VALIYU_API_KEY.",
  }]
};
```

#### README and docs/core-tools.md update

Update the Environment Variables table to replace Brave/SerpAPI/Kagi rows with Exa/Tavily/Valiyu.

### Skill guidance update

Add a note to the `web_search` tool description (or a companion skill) to steer the agent:
- Prefer `web_search` (Exa/Tavily) for structured, factual, and research queries
- Use `greedysearch` only when no API key is configured or for AI-engine-specific results (Perplexity, Bing Copilot, Google AI Studio)

## Change 2: Document memory injection cost boundary

### Problem

Four memory systems remain after Phase 1. Three are agent-pull (tool call required — memex, context-mode, memory-mode). One auto-injects on every session start:

| Plugin | Injection model | Token cost |
|---|---|---|
| `memory-mode.ts` | None — writes AGENTS.md only | Zero |
| `pi-memory/` | **Auto-injects** preferences/corrections on session start | Per-session |
| `memex/` | On-demand via tool call | Only when queried |
| `context-mode/` | On-demand via tool call | Only when queried |

If `pi-memory` accumulates many corrections over time its injected context grows unboundedly, adding to every session's input tokens.

### Solution

Add a `disableAutoInject` config option to `core-tools/pi-memory/index.ts` wrapper:

```ts
// Read from ~/.pi/agent/settings.json: { "piMemory": { "disableAutoInject": true } }
```

When `disableAutoInject` is true, pass a config object to `@samfp/pi-memory`'s default export (if it supports this) or skip calling `mod.default(pi)` entirely, leaving the package installed but dormant.

**Note:** Whether `@samfp/pi-memory` exposes a config parameter for injection control must be verified against the package's actual API before implementation. If it does not, document the workaround (commenting out the extension entry in `package.json`) instead.

## Change 3: Migrate pi-lens to `registerAdoptedPackage()`

### Problem

`core-tools/pi-lens/index.ts` pre-registers 7 flags inline as a workaround to avoid importing the pi-lens package eagerly. This is brittle: if pi-lens adds or removes flags, the inline stubs become stale and must be updated manually.

### Solution

After Phase 2 ships `registerAdoptedPackage()`, migrate pi-lens to use it with `skillPaths`. The 7 inline flag stub registrations are removed. Flags will be registered by the package itself after it loads on `session_start`.

**Risk:** If pi-lens uses flags before `session_start` (i.e., at CLI invocation), removing eager flag registration may break `--no-lsp` style CLI args. Verify this before removing the stubs. If flags must be eager, keep the stubs and only migrate the rest (import + status + error handling).

## Summary

| Change | Type | Risk |
|---|---|---|
| Replace web-search backends (Exa, Tavily, Valiyu) | Code | Low — Valiyu API format needs verification |
| Document pi-memory inject cost + disable option | Code + docs | Low — config passthrough may not be supported |
| Migrate pi-lens to registerAdoptedPackage | Code | Medium — verify flag timing before removing stubs |

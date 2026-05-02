# Adoption Plan: pi-smart-fetch → pi-me

**Source**: https://github.com/Thinkscape/agent-smart-fetch (packages/pi-smart-fetch + packages/core)  
**Package**: `pi-smart-fetch` v0.2.35 · **License**: MIT  
**Monorepo**: agent-smart-fetch (core + pi-extension + openclaw-extension)  
**pi extension entry**: `packages/pi-smart-fetch/src/index.ts` (6 KB, ~550 lines)  
**Core library**: `packages/core/src/` (8 files, ~2000 lines)  

---

## Comparison Matrix

### Tool Registration

| Smart-fetch Module | pi-me Equivalent | Verdict |
|---|---|---|
| `src/index.ts` (tool registration + TUI rendering) | `core-tools/web-search.ts` (search API tool) | **Complementary** — smart-fetch fetches page *contents*, web-search fetches search *results*. They solve different problems. |
| `src/settings.ts` (config loading) | `shared/pi-config.ts` | **Replace** — use pi-me's config system instead of smart-fetch's custom settings reader |

### Core Library (`packages/core/src/`)

| Smart-fetch Module | pi-me Equivalent | Verdict |
|---|---|---|
| `core/src/extract.ts` (defuddleFetch) | (none) | **Adopt as dep** — use `smart-fetch-core` as npm dependency |
| `core/src/format.ts` (response formatting) | (none) | **Adopt as dep** |
| `core/src/tool.ts` (execution logic) | (none) | **Adopt as dep** |
| `core/src/types.ts` (type definitions) | `web-search.ts` has its own types | **Adopt as dep** |
| `core/src/constants.ts` | (none) | **Adopt as dep** |
| `core/src/profiles.ts` (browser profiles) | (none) | **Adopt as dep** |
| `core/src/dom.ts` (DOM utilities) | (none) | **Adopt as dep** |
| `core/src/dependencies.ts` | (none) | **Adopt as dep** |

---

## Strategy

| Option | Description | Effort | Ongoing Maintenance |
|---|---|---|---|
| **A: Install as dependency** | `pi install npm:pi-smart-fetch`. No code changes in pi-me. | 5 minutes | Upstream manages updates |
| **B: Adopt source (thin wrapper)** | Copy `packages/pi-smart-fetch/src/` into `content-tools/web-fetch/`, depend on `smart-fetch-core` from npm. Rewrite config loading to use pi-me's config system. | 1 day | Customizable but must track upstream API changes |
| **C: Full source adoption** | Copy both pi extension AND core library into pi-me source. Bundle core as internal module. | 2-3 days | Full control but heavy maintenance burden |

**Recommended: Option B** (Adopt thin wrapper, depend on smart-fetch-core from npm)

### Rationale

1. **smart-fetch-core is complex** — TLS impersonation (`wreq-js`), content extraction (`defuddle`), HTML parsing (`linkedom`). Re-implementing would be error-prone.
2. **The pi extension wrapper is thin** — it registers tools, handles TUI rendering, and loads config. This is the part worth customizing.
3. **Config integration** — pi-me has a unified config system (`shared/pi-config.ts`). Smart-fetch's config loading would benefit from it.
4. **Minimal overlap** — smart-fetch is entirely new functionality for pi-me. No existing code to merge.

---

## Adopted File Layout in pi-me

```
content-tools/web-fetch/
├── index.ts              # Tool registration (web_fetch, batch_web_fetch)
├── settings.ts           # Config loader (using pi-me's shared config)
├── tui-render.ts         # TUI rendering for fetch progress/results
├── render-helpers.ts     # Shared TUI utilities
└── tests/
    └── web-fetch.test.ts # Unit tests
```

### Dependencies (via smart-fetch-core npm package)

```bash
npm install smart-fetch-core    # pulls wreq-js, defuddle, linkedom, lodash, mime-types
```

The pi-smart-fetch source bundles `smart-fetch-core` at build time (`tsup.config.ts: noExternal: ["smart-fetch-core"]`). For pi-me adoption, we'd keep `smart-fetch-core` as an external dependency instead.

### What NOT to adopt

| File | Reason |
|---|---|
| `packages/openclaw-smart-fetch/` | OpenClaw-specific adapter, not needed |
| `packages/pi-smart-fetch/src/settings.ts` | Replace with pi-me's config system |
| `scripts/` | Build/release scripts, not needed |
| `packages/pi-smart-fetch/tsup.config.ts` | Build config, not needed |
| `packages/pi-smart-fetch/demo.gif` | Demo asset |

---

## Optimization Opportunities

### 1. Config Loading — Replace with pi-me's Unified Config

**Current (smart-fetch)**: Custom settings reader in `settings.ts` that manually reads `~/.pi/agent/settings.json` + `.pi/settings.json`

**Proposed**: Use pi-me's `shared/pi-config.ts` pattern:

```typescript
// content-tools/web-fetch/settings.ts
import { defineConfig } from "../../shared/pi-config.js";
import { z } from "zod";  // pi-me already uses zod

export const webFetchConfig = defineConfig({
  schema: z.object({
    verboseByDefault: z.boolean().default(false),
    defaultMaxChars: z.number().positive().default(50000),
    defaultTimeoutMs: z.number().positive().default(15000),
    defaultBrowser: z.string().default("chrome_145"),
    defaultOs: z.enum(["windows", "macos", "linux", "android", "ios"]).default("windows"),
    defaultRemoveImages: z.boolean().default(false),
    defaultIncludeReplies: z.union([z.boolean(), z.literal("extractors")]).default("extractors"),
    defaultBatchConcurrency: z.number().positive().default(8),
    tempDir: z.string().optional(),
  }),
  filenames: ["web-fetch.jsonc", "smart-fetch.jsonc"],
});
```

### 2. TUI Rendering — Integrate with pi-me's existing patterns

- Smart-fetch has its own progress bar rendering. pi-me already has TUI components via `@mariozechner/pi-tui`.
- Reuse existing spinner/status patterns from pi-me's other tools.
- Keep the responsive batch renderer (it's well-designed).

### 3. Tool Schema — Align with pi-me's style

- Smart-fetch uses `@sinclair/typebox` for schemas. pi-me uses both `@sinclair/typebox` and `zod`.
- Keep TypeBox for tool parameters (it's the pi ecosystem standard), convert any zod-only patterns.

---

## Implementation Steps

### Phase 1: Foundation

1. Create directory: `mkdir -p content-tools/web-fetch/`
2. Copy `packages/pi-smart-fetch/src/index.ts` → `content-tools/web-fetch/index.ts`
3. Copy core TUI rendering logic into separate files
4. Create `content-tools/web-fetch/settings.ts` using pi-me's config pattern

### Phase 2: Adapt

1. **Rewrite settings.ts** — replace smart-fetch's custom JSON reader with pi-me's `defineConfig` + `loadConfigOrDefault`
2. **Update imports** — change `smart-fetch-core` import paths
3. **Remove bundling** — ensure `smart-fetch-core` is an external dep, not bundled
4. **Update tool description** — align with pi-me's documentation style
5. **Export web_fetch and batch_web_fetch** as proper tools

### Phase 3: Register

1. Add to `package.json` `pi.extensions`:
   ```json
   "./content-tools/web-fetch/index.ts"
   ```
2. Add dependency: `npm install smart-fetch-core`
3. Ensure typebox is available (already a peer dep)

### Phase 4: Tests

1. Port unit tests from `packages/pi-smart-fetch/test/` and `packages/core/test/`
2. Add config loading tests for the new settings module
3. Add integration test for web_fetch tool call flow (mock the actual fetch)

### Phase 5: Documentation

1. Add `skills/web-fetch/SKILL.md` — describes web_fetch and batch_web_fetch tools
2. Update `README.md` with new capabilities

---

## Update package.json

```json
{
  "pi": {
    "extensions": [
      // ... existing ...
      "./content-tools/web-fetch/index.ts"
    ]
  },
  "dependencies": {
    // ... existing ...
    "smart-fetch-core": "^0.2.35"
  }
}
```

---

## Effort Estimate

| Phase | Est. Effort |
|---|---|
| Foundation (copy files, create dirs) | 1 hour |
| Settings rewrite (pi-me config pattern) | 1 hour |
| Import adaptation & build | 0.5 hour |
| Tests | 3 hours |
| Documentation | 1 hour |
| **Total** | **~6.5 hours (1 day)** |

---

## Alternative: Option A (Install as dependency)

If you prefer to keep pi-smart-fetch as an external dependency rather than adopting source:

```bash
pi install npm:pi-smart-fetch
```

**Pros**: Zero code maintenance, always latest version  
**Cons**: No config integration, can't customize TUI, separate update cycle

This is the simplest path and the recommended starting point. You can always adopt the source later if customization needs arise.

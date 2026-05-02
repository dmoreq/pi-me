# pi-me Coding Conventions

## File & Directory Naming

- **kebab-case** for all file and directory names: `my-extension.ts`, `my-module/index.ts`
- Test files use `{name}.test.ts` or `{name}.test.js`
- Type definition files use `{name}.d.ts` (but prefer `.ts` with explicit types)
- Avoid abbreviations unless universally known (e.g., `JSON`, `URL`). `dcp` → use full name `context-pruning`
- Avoid whimsical names in production paths (e.g., `mario-not` → `platformer`)

### ✅ Examples

```
foundation/permission/permission-core.ts
session-lifecycle/session-name/session-name.ts
core-tools/subagent/extension/index.ts
```

### ❌ Anti-Examples

```
sessionStart.ts        → session-start.ts
mario-not/             → platformer/
dcp/                   → context-pruning/
```

## Extension Structure

Each extension should follow the **config-loaded factory** pattern:

```
my-extension/
├── index.ts           # Entry: loads config, calls factory, exports default
├── extension.ts       # Factory function (pure logic, testable without fs)
├── types.ts           # TypeScript interfaces/types (optional)
└── tests/
    └── extension.test.ts
```

### `index.ts` (canonical pattern)

```typescript
import { loadConfigOrDefault } from "../../shared/pi-config.js";
import { z } from "zod";
import { myFactory } from "./extension.js";

const ConfigSchema = z.object({ /* ... */ });

const config = loadConfigOrDefault({
  filename: "my-extension.jsonc",
  schema: ConfigSchema,
  defaults: { /* ... */ },
});

export default myFactory(config);
```

### `extension.ts` (canonical pattern)

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function myFactory(config: ConfigType) {
  return (pi: ExtensionAPI) => {
    pi.on("session_start", async (_event, ctx) => { /* ... */ });
    pi.registerCommand("my-command", { /* ... */ });
  };
}
```

## Imports

- Use `.js` extension for local ESM imports: `import { x } from "./foo.js"`
- Use `node:` prefix for Node.js built-ins: `import * as fs from "node:fs"`
- Group imports, separated by a blank line:
  1. Node.js built-ins (`node:fs`, `node:path`, etc.)
  2. Third-party packages (`zod`, `@mariozechner/pi-ai`, etc.)
  3. Local modules (`../../shared/pi-config.js`, `./extension.js`)

## Config & State

- **Config files**: Use `loadConfigOrDefault` from `shared/pi-config.ts` with a zod schema.
- **State files**: Use the helpers from `shared/ext-state.ts`.
- State file directory: `~/.pi/ext-state/<extension-name>.json`
- Config file directory: `~/.pi/agent/<extension-name>.jsonc`

## Exports

- Extensions that register with pi should `export default function(pi: ExtensionAPI)`
- Pure utility modules should use named exports
- Factory functions should be named exports

## Error Handling

- Use early returns / guard clauses
- Log errors with `console.error` using the `[extension-name]` prefix
- Notify users via `ctx.ui.notify(message, "error" | "warning" | "info")`
- Fail gracefully — never throw unhandled exceptions from event handlers

## Testing

- Place tests in a `tests/` subdirectory within the extension
- Use Node's built-in test runner (`node:test` with `tsx --test`)
- Test pure functions directly; use dependency injection for pi API
- Keep tests file-scoped (no shared state between test files)

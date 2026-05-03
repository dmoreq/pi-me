# Shared Utilities Guide

This guide documents the shared utilities available across the pi-me codebase to help you avoid code duplication.

## Error Handling

**Location**: `core-tools/subagent/shared/utils.ts`

### `getErrorMessage(error: unknown): string`
Safely extract error message from any error type.

```typescript
import { getErrorMessage } from "../../shared/utils.ts";

try {
  // some operation
} catch (error) {
  const msg = getErrorMessage(error);
  console.error(`Failed: ${msg}`);
}
```

### `isNotFoundError(error: unknown): boolean`
Check if an error is a file-not-found error (ENOENT).

```typescript
import { isNotFoundError } from "../../shared/utils.ts";

try {
  fs.readFileSync(path);
} catch (error) {
  if (isNotFoundError(error)) {
    return null; // Handle gracefully
  }
  throw error;
}
```

---

## File System Operations

### JSON Files

**Location**: `core-tools/subagent/shared/utils.ts`

#### `readJsonFile<T>(filePath: string, description: string): T`
Read and parse JSON files with automatic error handling.

```typescript
import { readJsonFile } from "../../shared/utils.ts";

const config = readJsonFile<ConfigType>(
  "/path/to/config.json",
  "app configuration file"
);
// Throws with proper context on failure
```

### Directory Traversal

**Location**: `core-tools/fs-utils.ts`

#### `scanDirectory(dir: string, config: DirectoryScannerConfig): void`
Recursively traverse directories with filtering and callbacks.

```typescript
import { scanDirectory, DEFAULT_SKIP_DIRS } from "../fs-utils.ts";

scanDirectory("./src", {
  extensions: new Set([".ts", ".tsx"]),
  onFile: (filePath) => {
    console.log("Found:", filePath);
  },
  onDir: (dirPath) => {
    console.log("Entering:", dirPath);
  },
  shouldRecurse: (dirPath, dirName) => {
    return !dirName.startsWith(".") && !DEFAULT_SKIP_DIRS.has(dirName);
  },
});
```

#### `getExtension(fileName: string): string`
Safely get file extension (e.g., ".ts" from "file.ts").

```typescript
import { getExtension } from "../fs-utils.ts";

const ext = getExtension("config.json"); // ".json"
const noExt = getExtension("Makefile"); // ""
```

---

## Frontmatter Parsing

**Location**: `core-tools/subagent/agents/frontmatter.ts`

#### `parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string }`
Parse YAML-style frontmatter from markdown/text files.

```typescript
import { parseFrontmatter } from "../agents/frontmatter.ts";

const content = `---
name: my-agent
description: Example agent
---
Rest of the content...`;

const { frontmatter, body } = parseFrontmatter(content);
// frontmatter: { name: "my-agent", description: "Example agent" }
// body: "Rest of the content..."
```

---

## Testing Utilities

**Location**: `core-tools/test-utils.ts`

### `createTempDir(prefix?: string): string`
Create a temporary directory.

```typescript
import { createTempDir, cleanupTempDir } from "../test-utils.ts";

const tmpDir = createTempDir("my-test-");
try {
  // use tmpDir
} finally {
  cleanupTempDir(tmpDir);
}
```

### `withTempDir<T>(prefix: string, fn: (dir: string) => T): T`
Execute a function with automatic temp dir cleanup (sync).

```typescript
import { withTempDir } from "../test-utils.ts";

const result = withTempDir("test-", (dir) => {
  fs.writeFileSync(`${dir}/file.txt`, "content");
  return fs.readFileSync(`${dir}/file.txt`, "utf-8");
});
// dir is automatically cleaned up
```

### `withTempDirAsync<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T>`
Execute an async function with automatic temp dir cleanup.

```typescript
import { withTempDirAsync } from "../test-utils.ts";

const result = await withTempDirAsync("test-", async (dir) => {
  await fs.promises.writeFile(`${dir}/file.txt`, "content");
  return await fs.promises.readFile(`${dir}/file.txt`, "utf-8");
});
// dir is automatically cleaned up
```

---

## Message Utilities

**Location**: `core-tools/subagent/shared/utils.ts`

### `getFinalOutput(messages: Message[]): string`
Extract the final text output from a message chain.

```typescript
import { getFinalOutput } from "../../shared/utils.ts";

const output = getFinalOutput(messages);
```

### `getDisplayItems(messages: Message[] | undefined): DisplayItem[]`
Extract display-friendly items (text and tool calls) from messages.

```typescript
import { getDisplayItems } from "../../shared/utils.ts";

const items = getDisplayItems(messages);
// items: { type: "text", text: "..." } | { type: "tool", name: "...", args: ... }
```

---

## Best Practices

1. **Always use shared utilities** - Check before writing similar code
2. **Extend, don't duplicate** - Add parameters to existing utilities rather than creating new ones
3. **Use generics** - Like `readJsonFile<T>` for type safety
4. **Document edge cases** - Add comments for non-obvious behavior
5. **Batch cleanup** - Use `withTempDir` helpers to prevent leaks

---

## Contributing

When you find duplicated code:

1. **Extract the pattern** - Create or update a shared utility
2. **Update consumers** - Replace duplicates with imports
3. **Add tests** - Ensure the shared utility is tested
4. **Document** - Add an entry to this guide

This keeps the codebase DRY and maintainable! 🎯

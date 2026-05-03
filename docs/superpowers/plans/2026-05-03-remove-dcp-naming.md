# Remove DCP Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all `dcp` naming from the codebase — user-facing commands become `/cp-*`, internal identifiers become `context-pruning`, and stale docs are updated.

**Architecture:** All changes are in `session-lifecycle/context-pruning/`. The `bunfig` config loader auto-discovers files by the `name:` key, so changing `dcp` → `cp` there renames the user-facing config file convention (`dcp.config.ts` → `cp.config.ts`, `.dcprc` → `.cprc`). Slash commands, log file, console prefix, and CLI flags follow the same rename.

**Tech Stack:** TypeScript, bunfig (config loader), pi-coding-agent extension API

---

## Files Modified

| File | Change |
|------|--------|
| `session-lifecycle/context-pruning/index.ts` | Rename commands `dcp-*` → `cp-*`, update import + STATUS_KEY |
| `session-lifecycle/context-pruning/config.ts` | Rename CLI flags, config file names in comments + generated template |
| `session-lifecycle/context-pruning/logger.ts` | Rename log file `pi-dcp.log` → `context-pruning.log`, console prefix |
| `session-lifecycle/context-pruning/registry.ts` | Rename console prefix `[pi-dcp]` → `[context-pruning]` |
| `session-lifecycle/context-pruning/workflow.ts` | Update stale comment referencing `/dcp-stats` |
| `session-lifecycle/context-pruning/cmds/init.ts` | Rename config file path `dcp.config.ts` → `cp.config.ts`, update messages |
| `session-lifecycle/context-pruning/cmds/recent.ts` | Update usage strings |
| `session-lifecycle/context-pruning/cmds/logs.ts` | Rename export `dcpLogsCommand` → `cpLogsCommand`, update strings |
| `README.md` | Update pi-dcp credit row |
| `docs/session-lifecycle-analysis.md` | Update DCP abbreviation references |

---

### Task 1: Rename exported `dcpLogsCommand` → `cpLogsCommand` in `cmds/logs.ts`

**Files:**
- Modify: `session-lifecycle/context-pruning/cmds/logs.ts`

- [ ] **Step 1: Update the file**

Replace the entire file content:

```typescript
/**
 * /cp-logs command - View context-pruning logs
 *
 * Shows recent log entries and provides information about log file locations.
 */

import type { CommandDefinition } from "../types";
import { getLogger } from "../logger";
import { readFileSync, existsSync, statSync } from "fs";

export const cpLogsCommand: CommandDefinition = {
	description: "View context-pruning extension logs",
	handler: async (args, ctx) => {
		const logger = getLogger();
		const parsedArgs = typeof args === 'string' ? args.split(/\s+/) : [];
		const linesToShow = parseInt(parsedArgs[0] || "50", 10) || 50;
		const fileIndex = parseInt(parsedArgs[1] || "0", 10) || 0;

		// Get all log files
		const allLogFiles = logger.getAllLogFiles();
		
		if (allLogFiles.length === 0) {
			ctx.ui.notify("No log files found. Logs will be created when extension runs.", "info");
			return;
		}

		// Validate file index
		if (fileIndex < 0 || fileIndex >= allLogFiles.length) {
			ctx.ui.notify(`Invalid file index. Available: 0 (current) to ${allLogFiles.length - 1} (oldest backup)`, "error");
			return;
		}

		const logFilePath = allLogFiles[fileIndex];
		
		if (!existsSync(logFilePath)) {
			ctx.ui.notify(`Log file not found: ${logFilePath}`, "error");
			return;
		}

		// Get file info
		const stats = statSync(logFilePath);
		const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

		// Read the file
		const content = readFileSync(logFilePath, "utf8");
		const lines = content.split("\n").filter(line => line.trim());
		
		// Get last N lines
		const recentLines = lines.slice(-linesToShow);

		// Build response
		let response = `📋 **Context Pruning Logs**\n\n`;
		response += `**File:** \`${logFilePath}\`\n`;
		response += `**Size:** ${fileSizeMB} MB\n`;
		response += `**Total Lines:** ${lines.length}\n`;
		response += `**Showing:** Last ${recentLines.length} lines\n\n`;
		response += "---\n\n";
		response += "```\n";
		response += recentLines.join("\n");
		response += "\n```\n\n";
		
		// Show available files
		if (allLogFiles.length > 1) {
			response += "\n**Available log files:**\n";
			allLogFiles.forEach((file, idx) => {
				const size = existsSync(file) ? (statSync(file).size / (1024 * 1024)).toFixed(2) : "0";
				const label = idx === 0 ? "current" : `backup ${idx}`;
				response += `- ${idx}: ${label} (${size} MB)\n`;
			});
			response += "\nUse `/cp-logs <lines> <file_index>` to view a specific file.";
		}

		ctx.ui.notify(response, "info");
	},
};
```

- [ ] **Step 2: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP" session-lifecycle/context-pruning/cmds/logs.ts`
Expected: no output

---

### Task 2: Update `index.ts` — rename commands and import

**Files:**
- Modify: `session-lifecycle/context-pruning/index.ts`

- [ ] **Step 1: Update the import and all command registrations**

Change line 44:
```typescript
// Before
import { dcpLogsCommand } from "./cmds/logs";
// After
import { cpLogsCommand } from "./cmds/logs";
```

Change the STATUS_KEY (line 55):
```typescript
// Before
const STATUS_KEY = "dcp-stats";
// After
const STATUS_KEY = "cp-stats";
```

Change the block comment (lines 15–20):
```typescript
 * Commands:
 * - /cp-stats    — Show detailed pruning statistics
 * - /cp-debug    — Toggle debug logging
 * - /cp-toggle   — Enable/disable pruning
 * - /cp-recent N — Set recency threshold
 * - /cp-init     — Generate a config file
 * - /cp-logs     — View extension logs
```

Change the `registerCommand` calls (lines 117–122):
```typescript
	pi.registerCommand("cp-stats", createStatsCommand(statsTracker, ruleCount));
	pi.registerCommand("cp-debug", createDebugCommand(config));
	pi.registerCommand("cp-toggle", createToggleCommand(config));
	pi.registerCommand("cp-recent", createRecentCommand(config));
	pi.registerCommand("cp-init", createInitCommand());
	pi.registerCommand("cp-logs", cpLogsCommand);
```

- [ ] **Step 2: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP" session-lifecycle/context-pruning/index.ts`
Expected: no output

---

### Task 3: Update `config.ts` — flags, config file names, generated template

**Files:**
- Modify: `session-lifecycle/context-pruning/config.ts`

- [ ] **Step 1: Update CLI flags**

Change lines 41–42:
```typescript
// Before
const enabled = pi.getFlag("--dcp-enabled");
const debug = pi.getFlag("--dcp-debug");
// After
const enabled = pi.getFlag("--cp-enabled");
const debug = pi.getFlag("--cp-debug");
```

- [ ] **Step 2: Update the JSDoc comment block (lines 22–32)**

```typescript
/**
 * Load configuration from extension settings, files, or defaults
 * Priority (highest to lowest):
 * 1. CLI flags (--cp-enabled, --cp-debug)
 * 2. Config file in current directory (cp.config.ts, etc.)
 * 3. Config file in home directory (~/.cprc)
 * 4. Default configuration
 */
export async function loadConfig(pi: ExtensionAPI): Promise<PruningConfigWithRuleObjects> {
	// bunfig automatically searches for config files in cwd and home directory
	// It supports: cp.config.{ts,js,json,toml,yaml}, .cprc{,.json,.toml,.yaml}
	// and package.json with "cp" key
	const config = await bunfigLoad<PruningConfigWithRuleRefs>({
		name: "context-pruning",
```

Note: The `name: "context-pruning"` in `bunfigLoad` is already correct — `bunfig` uses this to search for `context-pruning.config.ts`, `.context-pruningrc`, etc. The user-facing short name `cp` is only in the `/cp-init` generated file and CLI flags.

- [ ] **Step 3: Update `generateConfigFileContent` — fix file path comments in generated output**

In the `simplified` branch (lines 103–119), change the header comment:
```typescript
return `/**
 * Context Pruning Configuration
 * 
 * Place this file as:
 * - ./cp.config.ts (project-specific)
 * - ~/.cprc (user-wide)
 */
```

In the full branch (lines 122–161), change the header comment:
```typescript
return `/**
 * Context Pruning Configuration
 * 
 * This file configures the context-pruning extension for intelligent context pruning.
 * 
 * Place this file as:
 * - ./cp.config.ts (project-specific configuration)
 * - ~/.cprc (user-wide configuration)
 * 
 * All fields are optional - defaults will be used for missing values.
 */
```

Also update the JSDoc for `generateConfigFileContent` (line 97):
```typescript
/**
 * Generate sample configuration file content
 * Used by the init command to create cp.config.ts
 */
```

- [ ] **Step 4: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP" session-lifecycle/context-pruning/config.ts`
Expected: no output

---

### Task 4: Update `logger.ts` — log file name and console prefix

**Files:**
- Modify: `session-lifecycle/context-pruning/logger.ts`

- [ ] **Step 1: Update the file-level comment and defaults**

Line 2:
```typescript
 * Rotated file logger for context-pruning extension
```

Lines 48–50:
```typescript
		// Default to ~/.pi/logs/context-pruning
		this.logDir = config.logDir || join(homedir(), ".pi", "logs");
		this.logFileName = config.logFileName || "context-pruning.log";
```

- [ ] **Step 2: Update the three `[pi-dcp]` console messages**

Line 102:
```typescript
			console.error("[context-pruning] Failed to rotate logs:", error);
```

Line 124:
```typescript
			consoleMethod(`[context-pruning] ${message}`, context || "");
```

Line 137:
```typescript
			console.error("[context-pruning] Failed to write to log file:", error);
```

- [ ] **Step 3: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP\|pi-dcp" session-lifecycle/context-pruning/logger.ts`
Expected: no output

---

### Task 5: Update `registry.ts` — console prefix

**Files:**
- Modify: `session-lifecycle/context-pruning/registry.ts`

- [ ] **Step 1: Update line 27**

```typescript
// Before
		console.warn(`[pi-dcp] Overriding existing rule: ${rule.name}`);
// After
		console.warn(`[context-pruning] Overriding existing rule: ${rule.name}`);
```

- [ ] **Step 2: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP" session-lifecycle/context-pruning/registry.ts`
Expected: no output

---

### Task 6: Update `workflow.ts` — stale comment

**Files:**
- Modify: `session-lifecycle/context-pruning/workflow.ts`

- [ ] **Step 1: Update line 125**

```typescript
// Before
 * Get pruning statistics (for future /dcp-stats command)
// After
 * Get pruning statistics (for future /cp-stats command)
```

- [ ] **Step 2: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP" session-lifecycle/context-pruning/workflow.ts`
Expected: no output

---

### Task 7: Update `cmds/init.ts` — config file path and messages

**Files:**
- Modify: `session-lifecycle/context-pruning/cmds/init.ts`

- [ ] **Step 1: Update all references**

```typescript
/**
 * Context Pruning Init Command
 * 
 * Generate a default cp.config.ts file in the current directory.
 */

import { writeConfigFile } from "../config";
import { join } from "path";
import type { CommandDefinition } from "../types";

export function createInitCommand(): CommandDefinition {
	return {
		description: "Generate a default cp.config.ts file in the current directory",
		handler: async (args, ctx) => {
			const configPath = join(process.cwd(), "cp.config.ts");
			const force = args?.toLowerCase() === "--force";

			try {
				await writeConfigFile(configPath, { force });
				ctx.ui.notify(`Config file created: ${configPath}`, "info");
			} catch (error: any) {
				if (error.message?.includes("already exists")) {
					ctx.ui.notify("Config file already exists. Use '/cp-init --force' to overwrite.", "warning");
				} else {
					ctx.ui.notify(`Failed to create config file: ${error.message || error}`, "error");
				}
			}
		},
	};
}
```

- [ ] **Step 2: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP" session-lifecycle/context-pruning/cmds/init.ts`
Expected: no output

---

### Task 8: Update `cmds/recent.ts` — usage strings

**Files:**
- Modify: `session-lifecycle/context-pruning/cmds/recent.ts`

- [ ] **Step 1: Update description and error message**

```typescript
	return {
		description: "Set the number of recent messages to always keep (e.g., /cp-recent 15)",
		handler: async (args, ctx) => {
			const count = parseInt(args || "10", 10);
			if (isNaN(count) || count < 0) {
				ctx.ui.notify("Invalid count. Usage: /cp-recent <number>", "error");
				return;
			}
```

- [ ] **Step 2: Verify no `dcp` remains**

Run: `grep -n "dcp\|DCP" session-lifecycle/context-pruning/cmds/recent.ts`
Expected: no output

---

### Task 9: Final sweep — verify entire context-pruning module is clean

- [ ] **Step 1: Run comprehensive grep across the whole module**

Run: `grep -rn "dcp\|DCP\|pi-dcp" session-lifecycle/context-pruning/`
Expected: no output

- [ ] **Step 2: Run grep across the whole repo (excluding docs/ and node_modules)**

Run: `grep -rn "dcp\|DCP\|pi-dcp" . --include="*.ts" --include="*.js" | grep -v node_modules | grep -v ".git" | grep -v "docs/"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add session-lifecycle/context-pruning/
git commit -m "refactor: rename dcp → cp commands, context-pruning identifiers throughout"
```

---

### Task 10: Update active reference docs

**Files:**
- Modify: `README.md`
- Modify: `docs/session-lifecycle-analysis.md`

- [ ] **Step 1: Update README.md line 256**

```markdown
<!-- Before -->
| [pi-dcp](https://github.com/zenobi-us/pi-dcp) | [zenobi-us](https://github.com/zenobi-us) | Dynamic Context Pruning — deduplication, superseded writes, error purging, recency protection |
<!-- After -->
| pi-dcp (inlined as context-pruning) | [zenobi-us](https://github.com/zenobi-us) | Dynamic Context Pruning — deduplication, superseded writes, error purging, recency protection |
```

- [ ] **Step 2: Update `docs/session-lifecycle-analysis.md` lines 35, 49, 65**

Line 35:
```markdown
### 2. context-pruning
```

Line 49:
```markdown
**Why it's critical:** Without pruning, context fills up with noise (duplicate outputs, stale errors, overwritten file versions). The agent loses ability to work effectively as the session grows. context-pruning is the automated solution to context pollution.
```

Line 65:
```markdown
**Relationship with context-pruning:** Complementary. context-pruning prunes individual messages. Auto-compact summarizes the remaining context into a compressed version. Both reduce token usage.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/session-lifecycle-analysis.md
git commit -m "docs: remove remaining dcp references from README and session-lifecycle-analysis"
```

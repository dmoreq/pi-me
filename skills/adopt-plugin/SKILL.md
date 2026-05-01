---
name: adopt-plugin
description: Adopt an external pi package into pi-me. Review, compare, refactor overlaps, optimize, and integrate. Use when adopting community pi extensions or merging external functionality.
---

# Plugin Adoption Workflow

Step-by-step process for reviewing an external pi package, comparing it against the pi-me codebase, planning adoption, implementing it with optimizations, and verifying with tests.

---

## Phase 1: Discovery & Review

### 1a. Explore Both Codebases

Start by understanding the full structure of both packages:

```bash
# External package
ls -la /path/to/external-package/
find /path/to/external-package -type f -not -path '*/node_modules/*' -not -path '*/.git/*'

# Our codebase
ls -la /path/to/pi-me/
find /path/to/pi-me -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.pi/*'
```

### 1b. Read All Source Files

Read every `.ts` source file from both packages. Focus on:
- Extension entry points (`export default function`)
- Core logic modules (separate files imported by hooks)
- Tool registrations (`pi.registerTool`)
- Command registrations (`pi.registerCommand`)
- Import dependencies (what packages they need)

```bash
# From external package
read(/path/to/external/checkpoint.ts)
read(/path/to/external/permission-core.ts)
# ... every source file

# From our codebase
read(/path/to/pi-me/foundation/secrets/secrets.ts)
read(/path/to/pi-me/session-lifecycle/git-checkpoint/git-checkpoint.ts)
# ... every source file
```

### 1c. Read README and package.json

Parse the external package's `README.md` and `package.json` to understand:
- What extensions are included (from `pi.extensions` array)
- Dependencies needed
- How to install/use

---

## Phase 2: Analysis & Comparison

### 2a. Build a Functionality Matrix

Create a comparison table mapping each external extension to the pi-me equivalent:

```markdown
| External Extension | pi-me Equivalent | Overlap Assessment |
|---|---|---|
| `checkpoint` | `git-checkpoint` | Both do git checkpoints. External version is more sophisticated (captures tracked+staged+untracked, persists as git refs, full restore UI) |
| `lsp` | (none) | Unique — adopt as-is |
| ... | ... | ... |
```

### 2b. Categorize Each Extension

- **Direct overlap** — Both packages have similar functionality. Analyze which is more capable.
- **Unique to external** — No pi-me equivalent. Adopt.
- **Unique to pi-me** — Keep.

### 2c. Analyze Optimization Opportunities

For overlapping functionality, look for:
- Redundant implementations (e.g., custom argument parsing when a dependency like `shell-quote` is available)
- Inefficient operations (e.g., spawning child processes when `fs.readFileSync` would work)
- Duplicate code (two similar implementations of the same function)
- Inline type definitions that duplicate framework types

For adopted extensions, look for:
- Configurable hardcoded values (timeouts, batch sizes, thresholds)
- Large files that could be split
- Unused patterns or dead code

---

## Phase 3: Write the Adoption Plan

### 3a. Create Branch and Plan Document

```bash
cd /path/to/pi-me
git init  # if not already a git repo
git checkout -b adopt-<plugin-name>
mkdir -p docs
```

Write a comprehensive plan to `docs/adopt-<plugin-name>-plan.md` covering:

1. **Executive Summary** — What is being adopted and why
2. **Functionality Comparison Matrix** — Table of all extensions
3. **Optimization Analysis** — Per-extension opportunities
4. **Refactoring Plan** — Phases with file mapping
5. **File Structure After Adoption** — Directory tree diagram
6. **Extension Count Summary** — Before/after
7. **Risk Assessment** — Severity ratings with mitigations
8. **Migration Steps** — Ordered checklist
9. **Key Optimization Wins** — Table of improvements
10. **Questions for Discussion** — Open items needing decisions

### 3b. Decide Overlap Strategy

For overlapping functionality:

| Situation | Strategy |
|---|---|
| External is much better | Replace pi-me version entirely |
| Different design philosophies | Merge the best of both |
| pi-me is better | Keep pi-me version, don't adopt |
| Complementary (solve different sub-problems) | Merge into unified system |

For the pi-hooks adoption, we made these decisions:
- **checkpoint**: Replace pi-me's minimal `git stash` wrapper with pi-hooks' full git-ref checkpoint
- **permission**: Merge pi-hooks' tier system with pi-me's safety nets (dangerous patterns + protected paths) into a unified 3-layer permission system
- **lsp, ralph-loop, repeat, token-rate**: Adopt as-is (no pi-me equivalent)

---

## Phase 4: Implementation

### 4a. Copy Unique Extensions

Create target directories and copy files:

```bash
cd /path/to/pi-me
mkdir -p target-directory/subdirectory/tests

# Copy each file
cp /path/to/external/ext.ts /path/to/pi-me/target-directory/ext.ts
```

When copying, place files in the appropriate pi-me category:
- `foundation/` — Core guards, secrets, permission, LSP, context
- `session-lifecycle/` — Checkpoints, compaction, naming, metrics
- `core-tools/` — Web search, todo, calc, ask, ralph-loop
- `content-tools/` — Notebook, mermaid, github, repeat
- `authoring/` — Commit helper, skill bootstrap, output artifacts

### 4b. Fix Import Paths

Check that imports work after relocating files. Use `grep` to find broken imports:

```bash
grep -n "from \"\.\/" /path/to/pi-me/target-directory/*.ts
```

Files that import from sibling modules in the same directory (e.g., `./lsp-core.js`) should work if those modules were also moved to the same directory.

### 4c. Apply Optimizations

Execute the optimizations identified in Phase 2c. Use precise edits:

1. **Replace custom parsers with dependency functions:**
```javascript
// Before:
import { spawn } from "child_process";
function parseArgs(cmd) { /* 20 lines of custom parsing */ }

// After:
import { parse } from "shell-quote";
function parseArgs(cmd) { return parse(cmd).filter(p => typeof p === "string"); }
```

2. **Replace child process with sync file reads:**
```javascript
// Before:
function readFirstLine(filePath) {
  return new Promise((resolve) => {
    const proc = spawn("head", ["-1", filePath], { stdio: ["ignore", "pipe", "ignore"] });
    // ...
  });
}

// After:
import { readFileSync } from "fs";
function readFirstLine(filePath) {
  try {
    return Promise.resolve(readFileSync(filePath, "utf-8").split("\n")[0]?.trim() ?? "");
  } catch { return Promise.resolve(""); }
}
```

### 4d. Merge Overlapping Functionality

For merges:

1. Copy the external module files into the target directory
2. Copy pi-me's safety/guard modules alongside them
3. Modify the entry point to import and integrate both:
```typescript
import { safetyPatterns } from "./safety-patterns.js";
import { protectedPaths, matchesGlob } from "./path-guard.js";
```

4. Add new check layers before existing logic:
```typescript
// Layer 1: Hard safety net (always active)
const safetyMatches = checkSafetyPatterns(command);
if (safetyMatches.length > 0) { /* block or confirm */ }

// Layer 2: Existing tier check
if (state.currentLevel === "bypassed") return undefined;
// ... tier classification
```

5. Delete old standalone modules that were merged:
```bash
rm -rf /path/to/pi-me/foundation/permission-gate/
rm -rf /path/to/pi-me/foundation/protected-paths/
rm /path/to/pi-me/session-lifecycle/git-checkpoint/git-checkpoint.ts
rmdir /path/to/pi-me/session-lifecycle/git-checkpoint/ 2>/dev/null
```

### 4e. Update package.json

Add new dependencies and update the extensions list:

```json
{
  "dependencies": {
    "shell-quote": "^1.8.3",
    "vscode-languageserver-protocol": "^3.17.5"
  },
  "pi": {
    "extensions": [
      "./foundation/secrets/secrets.ts",
      "./foundation/permission/permission.ts",
      "./foundation/lsp/lsp-hook.ts",
      "./foundation/lsp/lsp-tool.ts",
      ...
    ]
  }
}
```

**Load order matters:** Foundation first, then session lifecycle, then core tools, content tools, authoring.

---

## Phase 5: Testing

### 5a. Install Test Runner

```bash
cd /path/to/pi-me
npm install --save-dev tsx
```

Add a test script to `package.json`:
```json
{
  "scripts": {
    "test": "tsx --test path/to/tests/*.test.ts ..."
  }
}
```

### 5b. Write Tests for Each Module

Create test files in the same directory as the source files (or a `tests/` subdirectory):

```
foundation/permission/tests/
├── safety-patterns.test.ts   # Test dangerous command detection
├── path-guard.test.ts        # Test protected path matching
└── permission.test.ts        # Existing tests
```

**Test categories to cover:**

| Module | What to Test |
|--------|-------------|
| Safety patterns | Each dangerous command type matches; safe commands don't false-positive |
| Path guard | Glob matching (exact, globstar, single-star, dotfiles); protected paths list |
| Secrets | Plain obfuscation, replace mode, regex mode, deobfuscation, edge cases |
| Calc | Arithmetic, math functions, validation (blocks unsafe tokens), edge cases |
| Notebook | Cell read/edit/insert/delete, preview truncation, line splitting |
| Token rate | TPS calculation, cumulative stats |
| Agent discovery | Frontmatter parsing, quoted values, broken/missing frontmatter |

**Test patterns:**

Use `node:test` and `node:assert/strict`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("module-name", () => {
  describe("feature", () => {
    it("does something correctly", () => {
      assert.equal(result, expected);
    });
    
    it("handles edge case", () => {
      assert.ok(condition);
    });
  });
});
```

**Run tests frequently:**
```bash
npx tsx --test path/to/test1.test.ts path/to/test2.test.ts
```

### 5c. Fix Test Failures

Common test issues:
- **Import path errors**: Tests import `.js` but file is `.ts`. Ensure `tsx` is running the tests (not plain `node`).
- **Wrong assertions**: Actual behavior differs from expected. Fix the test to match reality.
- **Contradictory assertions**: Same input tested twice with opposite expectations.
- **Assertion off-by-one**: Length calculations miscounting prefix/suffix chars.

---

## Phase 6: Wrap Up

### 6a. Update Skills

Add skill files for new tools so the agent knows about them:

```
skills/lsp/SKILL.md         # LSP tool usage
skills/ralph-loop/SKILL.md   # Ralph loop usage
skills/permission/SKILL.md   # Permission system rules
```

### 6b. Update .gitignore

Add generated/artifact directories:
```
.pi/artifacts/
```

### 6c. Clean and Commit

```bash
cd /path/to/pi-me
git rm -r --cached .pi/artifacts/ 2>/dev/null  # Remove cached artifacts
git add -A
git status  # Review changes
git commit -m "feat: adopt <plugin-name> extensions

Adopted from <source>:
- Extension 1 (description)
- Extension 2 (description)

Merged overlapping functionality:
- ...

Optimizations:
- ..."

# Final test run
npx tsx --test all/test/files/*.test.ts
```

### 6d. Summary Output

Provide a clean summary:

```markdown
## Branch: adopt-plugin
## Commits: N
## Extensions: X → Y (net +Z)
## Tests: N tests across M files, 0 failures
## Files changed: ...
```

---

## Rules

1. **Always** read all source files from both packages before making decisions
2. **Always** create a plan document before touching any code
3. **Use** precise `edit` operations with exact `oldText` matching — never rewrite entire files
4. **Copy** files with `cp` then modify with `edit` — don't recreate from memory
5. **Merge** overlapping functionality into unified modules — don't leave duplicate implementations
6. **Delete** old modules that were replaced or merged
7. **Run** tests after every change to catch regressions early
8. **Commit** with descriptive conventional commit messages
9. **Never** commit `.pi/artifacts/` — add to `.gitignore`
10. **Document** new tools with skill files so future agents discover them

---

## Example: Full pi-hooks → pi-me Adoption

See the implementation on the `adopt-plugin` branch for the complete worked example:

```
pi-me/
├── docs/adopt-plugin-plan.md              # Full analysis and plan
├── foundation/
│   ├── lsp/                               # Adopted from pi-hooks
│   │   ├── lsp-core.ts
│   │   ├── lsp-hook.ts
│   │   ├── lsp-tool.ts
│   │   └── tests/
│   └── permission/                        # Merged: pi-hooks + pi-me
│       ├── permission.ts                  # 3-layer unified system
│       ├── permission-core.ts             # Command classification
│       ├── safety-patterns.ts             # From pi-me permission-gate
│       ├── path-guard.ts                  # From pi-me protected-paths
│       └── tests/
│           ├── safety-patterns.test.ts    # 32 tests
│           ├── path-guard.test.ts         # 31 tests
│           └── permission.test.ts         # Existing tests
├── session-lifecycle/
│   ├── git-checkpoint-new/                # Replaced with pi-hooks version
│   │   ├── checkpoint.ts                  # Optimized
│   │   ├── checkpoint-core.ts             # Optimized (shell-quote, fs.readFileSync)
│   │   └── tests/
│   └── token-rate/                        # Adopted from pi-hooks
│       ├── token-rate.ts
│       └── token-rate.test.ts             # 9 tests
├── core-tools/
│   ├── ralph-loop/                        # Adopted from pi-hooks
│   │   ├── ralph-loop.ts
│   │   ├── agents.ts
│   │   ├── types.d.ts
│   │   └── agents.test.ts                 # 6 tests
│   ├── calc.test.ts                       # 36 tests
├── content-tools/
│   ├── repeat/                            # Adopted from pi-hooks
│   │   ├── repeat.ts
│   │   └── types.d.ts
│   ├── notebook.test.ts                   # 15 tests
├── skills/
│   ├── lsp/SKILL.md
│   ├── permission/SKILL.md
│   └── ralph-loop/SKILL.md
```

**Results:** 22 extensions (up from 17), 144 tests across 8 test files, 0 failures, 3 safety extensions collapsed into 1 unified permission.

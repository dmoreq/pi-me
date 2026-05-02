# Phase 1 — Plugin Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove three redundant plugins (pi-oracle, pi-mempalace, super-pi) and co-locate compact-config with auto-compact, bringing the extension count from 54 to 51.

**Architecture:** Four isolated changes — three plugin removals and one file move. Each removal follows the same pattern: delete directory, remove two entries from `package.json` (extension path + dependency), run `npm install` to prune. The file move updates one path in `package.json` only.

**Tech Stack:** TypeScript, Node.js `npm`, pi extension system (`package.json` `pi.extensions` array)

---

### Task 1: Remove `pi-oracle`

**Files:**
- Delete: `core-tools/pi-oracle/` (entire directory)
- Modify: `package.json` lines 72 and 127

- [ ] **Step 1: Verify pi-oracle is registered**

```bash
grep -n "pi-oracle" package.json
```

Expected output:
```
72:      "./core-tools/pi-oracle/index.ts",
127:    "pi-oracle": "^0.6.13",
```

- [ ] **Step 2: Remove the directory**

```bash
rm -rf core-tools/pi-oracle
```

- [ ] **Step 3: Remove the extension path from `package.json`**

In `package.json`, delete this line from the `pi.extensions` array:
```json
"./core-tools/pi-oracle/index.ts",
```

- [ ] **Step 4: Remove the dependency from `package.json`**

In `package.json`, delete this line from `dependencies`:
```json
"pi-oracle": "^0.6.13",
```

- [ ] **Step 5: Prune the package**

```bash
npm install
```

Expected: lock file updates, `node_modules/pi-oracle` is gone.

- [ ] **Step 6: Verify removal**

```bash
ls node_modules/pi-oracle 2>/dev/null && echo "STILL EXISTS" || echo "REMOVED"
grep "pi-oracle" package.json && echo "STILL IN PACKAGE.JSON" || echo "CLEAN"
```

Expected: both print the clean/REMOVED variant.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass (pi-oracle had no tests).

- [ ] **Step 8: Commit**

```bash
git add core-tools/pi-oracle package.json package-lock.json
git commit -m "feat: remove pi-oracle (superseded by native oracle.ts)"
```

---

### Task 2: Remove `pi-mempalace`

**Files:**
- Delete: `core-tools/pi-mempalace/` (entire directory)
- Modify: `package.json` lines 69 and 126

- [ ] **Step 1: Verify pi-mempalace is registered**

```bash
grep -n "pi-mempalace\|mempalace" package.json
```

Expected output:
```
69:      "./core-tools/pi-mempalace/index.ts",
126:    "pi-mempalace-extension": "^0.2.0",
```

- [ ] **Step 2: Remove the directory**

```bash
rm -rf core-tools/pi-mempalace
```

- [ ] **Step 3: Remove the extension path from `package.json`**

In `package.json`, delete this line from the `pi.extensions` array:
```json
"./core-tools/pi-mempalace/index.ts",
```

- [ ] **Step 4: Remove the dependency from `package.json`**

In `package.json`, delete this line from `dependencies`:
```json
"pi-mempalace-extension": "^0.2.0",
```

- [ ] **Step 5: Prune the package**

```bash
npm install
```

- [ ] **Step 6: Verify removal**

```bash
ls node_modules/pi-mempalace-extension 2>/dev/null && echo "STILL EXISTS" || echo "REMOVED"
grep "mempalace" package.json && echo "STILL IN PACKAGE.JSON" || echo "CLEAN"
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add core-tools/pi-mempalace package.json package-lock.json
git commit -m "feat: remove pi-mempalace (memex covers structured knowledge org)"
```

---

### Task 3: Remove `super-pi`

**Files:**
- Delete: `core-tools/super-pi/` (entire directory)
- Modify: `package.json` lines 74 and 107

- [ ] **Step 1: Verify super-pi is registered**

```bash
grep -n "super-pi\|leing2021" package.json
```

Expected output:
```
74:      "./core-tools/super-pi/index.ts",
107:    "@leing2021/super-pi": "^0.23.4",
```

- [ ] **Step 2: Remove the directory**

```bash
rm -rf core-tools/super-pi
```

- [ ] **Step 3: Remove the extension path from `package.json`**

In `package.json`, delete this line from the `pi.extensions` array:
```json
"./core-tools/super-pi/index.ts",
```

- [ ] **Step 4: Remove the dependency from `package.json`**

In `package.json`, delete this line from `dependencies`:
```json
"@leing2021/super-pi": "^0.23.4",
```

- [ ] **Step 5: Prune the package**

```bash
npm install
```

- [ ] **Step 6: Verify removal**

```bash
ls "node_modules/@leing2021/super-pi" 2>/dev/null && echo "STILL EXISTS" || echo "REMOVED"
grep "super-pi\|leing2021" package.json && echo "STILL IN PACKAGE.JSON" || echo "CLEAN"
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add core-tools/super-pi package.json package-lock.json
git commit -m "feat: remove super-pi (subagent + ralph-loop cover iterative workflows)"
```

---

### Task 4: Co-locate `compact-config` with `auto-compact`

**Files:**
- Move: `session-lifecycle/compact-config.ts` → `session-lifecycle/auto-compact/compact-config.ts`
- Modify: `package.json` line 34

- [ ] **Step 1: Verify the current path**

```bash
grep -n "compact-config" package.json
ls session-lifecycle/compact-config.ts
ls session-lifecycle/auto-compact/
```

Expected: `compact-config.ts` exists as a loose file; `auto-compact/` contains `auto-compact.ts`.

- [ ] **Step 2: Check for any imports of compact-config**

```bash
grep -rn "compact-config" --include="*.ts" . | grep -v node_modules | grep -v "package.json"
```

Expected: no `.ts` file imports from `compact-config` — it is a standalone extension entry point.

- [ ] **Step 3: Move the file**

```bash
mv session-lifecycle/compact-config.ts session-lifecycle/auto-compact/compact-config.ts
```

- [ ] **Step 4: Update the extension path in `package.json`**

In `package.json`, change:
```json
"./session-lifecycle/compact-config.ts",
```
to:
```json
"./session-lifecycle/auto-compact/compact-config.ts",
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass (compact-config has no tests; the path change is purely structural).

- [ ] **Step 6: Commit**

```bash
git add session-lifecycle/auto-compact/compact-config.ts session-lifecycle/compact-config.ts package.json
git commit -m "refactor: co-locate compact-config with auto-compact"
```

---

### Task 5: Final verification

- [ ] **Step 1: Count extensions**

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('Extensions:', p.pi.extensions.length)"
```

Expected: `Extensions: 51` (was 54, removed 3).

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass, 0 failures.

- [ ] **Step 3: Verify no stale references**

```bash
grep -rn "pi-oracle\|pi-mempalace\|super-pi\|leing2021" --include="*.ts" --include="*.json" . | grep -v node_modules | grep -v "package-lock.json"
```

Expected: no output.

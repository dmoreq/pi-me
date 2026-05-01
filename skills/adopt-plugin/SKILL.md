---
name: adopt-plugin
description: Adopt an external pi package into pi-me. Review, compare, refactor overlaps, optimize, and integrate. Use when adopting community pi extensions or merging external functionality.
---

# Plugin Adoption Workflow

## Phase 1: Assess

### 1a. Explore the external package

```bash
ls -R /path/to/external-package/ | grep -v node_modules
```

Read the external `package.json` to extract `pi.extensions` — those are the files you need to review. Read every file listed in `pi.extensions`, plus their imports. Read the external `README.md` too.

### 1b. Compare against pi-me

For each external extension, find the pi-me equivalent (if any). Write an analysis to `docs/adopt-<name>-plan.md` with:

```markdown
## Comparison Matrix

| External Extension | pi-me Equivalent | Verdict |
|---|---|---|
| `checkpoint` | `git-checkpoint-new` | Replace: external version is richer |
| `lsp` | (none) | Adopt as-is |
| `permission` | `foundation/permission/` | Merge: combine tier system with safety nets |
| ... | ... | ... |

## Strategy

- **Unique to external** → Adopt as-is
- **External better** → Replace pi-me version
- **pi-me better** → Skip
- **Complementary** → Merge into unified module

## Optimization Opportunities

- Redundant implementations (custom parsers where a dep exists)
- Inefficient operations (spawning processes when sync fs would work)
- Large files that could be split
- Hardcoded values that should be configurable
```

### 1c. Create a branch

```bash
git checkout -b adopt-<plugin-name>
```

---

## Phase 2: Implement

### 2a. Copy unique extensions into the right pi-me layer

| Layer | Directory | For extensions that... |
|-------|-----------|----------------------|
| Foundation | `foundation/` | Guard safety, secrets, permission, LSP, context |
| Session Lifecycle | `session-lifecycle/` | Hooks at session/turn boundaries |
| Core Tools | `core-tools/` | General-purpose agent tools |
| Content Tools | `content-tools/` | File/resource manipulation |
| Authoring | `authoring/` | AI-assisted content creation |

```bash
cp /path/to/external/ext.ts pi-me/<layer>/ext.ts
```

### 2b. Merge overlapping functionality

When both packages have similar modules, merge into one unified module rather than keeping duplicates:

1. Copy external modules alongside pi-me modules in the same directory
2. Add imports in the entry point to pull in both sides
3. Layer the checks (e.g., safety nets → tier classification → bypass)
4. Delete the old standalone files that were absorbed
5. Remove old entries from `package.json` → `pi.extensions`

### 2c. Apply optimizations

- **Replace custom parsers with dependency functions** (e.g., `shell-quote` for arg parsing)
- **Replace child process spawns with sync filesystem calls** where possible
- **Extract types/interfaces into a separate `*-types.ts` file** if a module is large
- **Pre-compile regex patterns** into module-level caches

### 2d. Update package.json

Add new dependencies and register new extensions in `pi.extensions`, ordered by layer priority (foundation → lifecycle → tools → content → authoring):

```bash
npm install <new-dep>    # installs and updates package.json + lockfile
```

### 2e. Update packages[] config if the package name changed

The README and `package.json` `name` field must match how users register it. If scoping changes (e.g., `@scope/pkg` → `pkg`), run:

```bash
git filter-branch --tree-filter \
  "find . -type f -name '*.json' -o -name '*.md' | xargs sed -i '' 's/@old-scope\/old-name/new-name/g'" \
  <branch>
```

---

## Phase 3: Verify

### 3a. Run existing tests first

```bash
npm test
```

Fix any pre-existing failures before adding new code. All existing tests must pass.

### 3b. Write tests for adopted modules

Use `node:test` + `node:assert/strict`. Place test files in a `tests/` subdirectory next to the source. Test categories:

| Concern | What to test |
|---------|-------------|
| Correctness | Normal inputs produce expected outputs |
| Edge cases | Empty, null, boundary values |
| Safety | Dangerous inputs are rejected; safe inputs pass |
| False positives | Legitimate inputs aren't mistakenly blocked |

### 3c. Fix failures iteratively

Common issues:
- **Import `.js` but file is `.ts`** — ensure `tsx` runs the tests
- **Assertion off-by-one** — length calculations miscounting prefixes/suffixes
- **Contradictory assertions** — same input tested with inconsistent expectations

### 3d. Final commit

```bash
npm test                            # all passing
git status                          # review what changed
git add <files>                     # be precise — never git add -A
git commit -m "feat: adopt <plugin> extensions

Added:
- ext1: description
- ext2: description

Merged:
- extA + extB → unified-module

Tests: N new tests, 0 failures"
```

---

## Rules

1. **Read** all external source files before touching code
2. **Write** a plan doc with comparison matrix before implementing
3. **Copy** files with `cp`, then modify with precise `edit` — never recreate from memory
4. **Merge** overlapping modules — don't leave duplicates
5. **Delete** modules that were replaced or absorbed
6. **Run** `npm test` after every change
7. **Commit** with conventional commit messages; never `git add -A`
8. **Document** new tools with `skills/<tool>/SKILL.md` files

---

## Example: pi-hooks → pi-me Adoption

Reference: `adopt-plugin` branch.

**Strategy decisions:**
- `checkpoint` → replaced pi-me's `git stash` wrapper with full git-ref checkpoints
- `permission` → merged tier system + safety nets into unified 3-layer system
- `lsp`, `ralph-loop`, `repeat`, `token-rate` → adopted as-is (no pi-me equivalent)

**Result:** 22 extensions, 148 tests across 8 test files, 3 safety modules merged into 1.

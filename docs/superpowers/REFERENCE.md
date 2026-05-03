# Reference: Existing Specs & Plans

This document shows the specs and plans currently in the repository, and how to use them as templates.

---

## Current Projects

### 1. Extension Consolidation

**Spec:** [`specs/2026-05-03-extension-consolidation-design.md`](specs/2026-05-03-extension-consolidation-design.md)

**Status:** approved ✅

**Why it's a good example:**
- ✅ Problem statement is quantified ("35 extensions", "measurable startup overhead")
- ✅ Goals are specific ("reduce to 5", "add profile system")
- ✅ Multiple approaches shown (Approach A, Approach C, comparing tradeoffs)
- ✅ Detailed file changes (what moves, what deletes, what stays)
- ✅ Non-goals are explicit ("do not change implementation", "do not rename tools")
- ✅ Concrete acceptance criteria possible

**What to learn from it:**
- How to structure a multi-phase refactoring
- How to show file organization changes (use ASCII tables)
- How to explain why one approach was chosen over others
- How to define non-goals clearly

**Implementation Plan:** [`plans/2026-05-03-extension-consolidation-implementation.md`](plans/2026-05-03-extension-consolidation-implementation.md)

**Status:** draft (ready for tech review)

**What to learn from it:**
- How to break a spec into phases (Phase 1: merges, Phase 2: umbrellas)
- How to identify parallelizable work
- How to write detailed acceptance criteria per phase
- How to track progress with a table

---

## How to Use These as Templates

### For Spec Writing

**Copy structure from:** `Extension Consolidation Design`

**Structure to use:**
```
1. Problem (quantified)
2. Goals (specific)
3. Approach (multiple options)
4. Design Details (architecture, file changes)
5. Dependencies
6. Non-Goals
7. Implementation Notes
8. Acceptance Criteria
```

**Example of a good problem statement (from Extension Consolidation):**
```
## Problem

`package.json` registers 35 separate extension entry points. 
This causes two problems:

1. **Startup overhead** — each entry point runs independently, 
   registering its own event listeners and initialising its own 
   state. 35 registrations create measurable heap and startup-time cost.
2. **Hard to toggle** — disabling a feature requires editing 
   `package.json` directly. There is no user-facing on/off mechanism.
```

**Why it's good:**
- It's quantified ("35 extensions", "measurable heap")
- It identifies *two specific problems*, not vague "improve performance"
- It's clear why this matters (startup time, user experience)

---

### For Plan Writing

**Copy structure from:** `Extension Consolidation Implementation`

**Structure to use:**
```
1. Overview (problem summary + effort)
2. Phases (each with tasks, acceptance criteria, effort)
3. Testing Strategy
4. Progress Tracker (table with status)
5. Risk & Mitigation (optional but recommended)
6. Key Decisions
7. Assumptions
```

**Example of good tasks (from Extension Consolidation):**

```markdown
### 1.1 Auto-compact merge → `session-lifecycle/auto-compact/index.ts`

**Files to merge:**
- `session-lifecycle/auto-compact/auto-compact.ts` (current entry point)
- `session-lifecycle/auto-compact/compact-config.ts` (separate entry point)

**Action:**
1. Create `session-lifecycle/auto-compact/index.ts` that exports both
2. Delete `auto-compact.ts` and `compact-config.ts`

**Files changed:** [lists exactly what changes]
```

**Why it's good:**
- Task is **specific** (not "merge auto-compact stuff", but exact file names)
- Task is **small** (one person can finish it in < 1 day)
- Acceptance criteria are **testable** (files exist/deleted)
- It's **unambiguous** (no guessing what "merge" means)

---

## Templates Available

Use these files to scaffold new specs and plans:

1. **Spec Template:** [`templates/SPEC_TEMPLATE.md`](templates/SPEC_TEMPLATE.md)
   - Copy and fill in section by section
   - All sections are documented with examples

2. **Plan Template:** [`templates/PLAN_TEMPLATE.md`](templates/PLAN_TEMPLATE.md)
   - Copy and fill in section by section
   - Includes risk tracking and assumptions

---

## Quick Copy-Paste Checklist

When writing a spec, verify you have:

- [ ] **Problem:** Quantified (use numbers, not vague words)
- [ ] **Goals:** 2–3 specific, measurable outcomes
- [ ] **Approaches:** At least 2 options with tradeoffs
- [ ] **Design Details:** Architecture diagram or pseudocode
- [ ] **File Changes:** List what moves, deletes, changes, and new files
- [ ] **Dependencies:** External systems, breaking changes, etc.
- [ ] **Non-Goals:** What you're explicitly NOT doing
- [ ] **Acceptance Criteria:** All testable, no vague language

When writing a plan, verify you have:

- [ ] **Link to spec** at the top
- [ ] **Phases:** Break into independent chunks (≤3 tasks per phase)
- [ ] **Tasks:** Each ≤1 day of work, specific and actionable
- [ ] **Acceptance Criteria:** Per phase, testable
- [ ] **Effort:** Estimate per phase
- [ ] **Testing Strategy:** Unit/integration/manual QA
- [ ] **Progress Tracker:** Table with status column

---

## FAQ

**Q: Can I write a plan without a spec?**

A: Not recommended. The plan should say "Based on: [spec link]" — if there's no spec, you're missing the "why" and "what". Even a 1-page spec is better than none.

**Q: Should my spec match exactly the template?**

A: No. Use it as a *starting point*. Add sections as needed (e.g., "Migrations", "Rollback Plan"). The template is a minimum viable structure, not a strait jacket.

**Q: How detailed should file changes be?**

A: Enough that someone can understand the diff without running `git diff`. Use tables, ASCII diagrams, or bullet points. See Extension Consolidation's "File Changes Summary" section.

**Q: What if my feature is tiny?**

A: Write a one-page spec if needed. Example:
```markdown
## Problem
Config files are scattered; hard to find.

## Goals
- Single config location
- Documented in README

## Approach
Create `config.json` in root, move all config there, update docs.

## Non-Goals
- No config schema validation (yet)
- No migration for old configs

## Acceptance Criteria
- [ ] Single config.json works
- [ ] All tests pass
- [ ] README updated
```

**Q: Who writes the plan?**

A: The person (or team) who will implement it. They understand the work best.

**Q: Can I update the spec during implementation?**

A: Yes, but get re-approval first. Update the spec, post the change, get stakeholder sign-off, then continue. Document this in the plan's progress tracker.

---

## Workflow at a Glance

1. **Have an idea?** → Draft a spec (use `SPEC_TEMPLATE.md`)
2. **Done drafting?** → Mark status `in-review`, get 2 stakeholders
3. **Approved?** → Mark status `approved`, create a plan (use `PLAN_TEMPLATE.md`)
4. **Ready to work?** → Mark plan status `ready`, start executing
5. **Working?** → Update progress daily, block if needed
6. **Done?** → Mark plan `completed`, archive the spec

See [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md) for the full details.

---

## Get Help

- **How do I write a spec?** → [QUICK_START.md](QUICK_START.md) + [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md)
- **How do I use statuses?** → [STATUS_GUIDE.md](STATUS_GUIDE.md)
- **What's a good spec?** → This document, look at Extension Consolidation
- **I'm implementing and got stuck.** → Update the plan + spec, document blocker

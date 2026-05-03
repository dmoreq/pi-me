# Specs Workflow — Design & Implementation

This document defines the workflow for writing, reviewing, and implementing feature specifications in pi-me.

---

## Overview

A **spec** is a detailed design document that:
- Defines a problem statement and goals
- Proposes an architectural approach
- Details file changes, dependencies, and acceptance criteria
- Is **approved before implementation begins**

An **implementation plan** breaks the approved spec into actionable phases/tasks and tracks progress.

---

## Workflow Phases

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 0: Problem & Research (draft)                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Design & Spec (in-review)                              │
│ • Write spec with problem, goals, approach, file changes        │
│ • Get stakeholder sign-off                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
         ┌──────────────────────────────────────┐
         │ DECISION: Approve spec?              │
         └──────────────────────────────────────┘
                  ✗ (revise)        ✓ (approved)
                  │                 │
              Phase 1           Phase 2
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Implementation Planning (ready)                        │
│ • Break spec into phases/tasks                                   │
│ • Write implementation plan with acceptance criteria            │
│ • Estimate effort & dependencies                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Implementation & Testing (in-progress)                 │
│ • Execute implementation plan tasks                              │
│ • Write/update tests as you go                                   │
│ • Track progress in plan document                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Review & Merge (review)                                │
│ • Code review against spec & acceptance criteria                │
│ • Verify all tests pass                                          │
│ • Archive spec → `docs/superpowers/archives/`                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ DONE: Shipped (completed)                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Organization

```
docs/superpowers/
├── specs/                          # Active design documents
│   ├── YYYY-MM-DD-<name>.md       # Spec (problem, goals, approach)
│   └── ...
├── plans/                          # Implementation plans
│   ├── YYYY-MM-DD-<name>.md       # Plan (phases, tasks, tracking)
│   └── ...
├── archives/                       # Completed specs (moved here)
│   ├── 2026-05-01-<shipped>.md    # Archived spec + final status
│   └── ...
└── SPECS_WORKFLOW.md              # This file

```

---

## Spec Document Template

**File:** `docs/superpowers/specs/YYYY-MM-DD-<name>.md`

```markdown
# <Title>

**Date:** YYYY-MM-DD  
**Status:** draft | in-review | approved | archived  
**Author:** @username  

## Problem

What pain point or inefficiency does this solve?

## Goals

- Goal 1
- Goal 2
- Goal 3

## Approach

### Option A — [Name]
[Detailed explanation]

### Option B — [Name] (Recommended)
[Detailed explanation]

Why this option? Cost-benefit analysis.

## Design Details

### Architecture
[System design, diagrams, relationships]

### Key Changes
- File A: [what changes]
- File B: [what changes]
- File C: [new]

### Dependencies
- Does this require changes to another system?
- Breaking changes? (list them)
- Performance impact?

### Non-Goals

- What are we explicitly NOT doing?
- What's out of scope?

## Implementation Notes

- Estimated effort: [e.g., 2-3 days]
- Risk factors: [any blockers or unknowns?]
- Can this be done in parallel tracks? (yes/no)

## Acceptance Criteria

- [ ] All file changes match spec
- [ ] Tests written for new functionality
- [ ] No breaking changes (or documented)
- [ ] Code review approved
```

---

## Implementation Plan Template

**File:** `docs/superpowers/plans/YYYY-MM-DD-<name>.md`

```markdown
# <Title> — Implementation Plan

**Based on:** [Link to approved spec](../specs/YYYY-MM-DD-<name>.md)  
**Status:** draft | ready | in-progress | completed  
**Updated:** YYYY-MM-DD

---

## Overview

[1-2 sentence summary from spec]

**Effort:** [estimate in days/hours]  
**Can parallelize:** yes/no

---

## Phases

### Phase X — [Name]

**Tasks:**
- [ ] Task 1.1 — Description
- [ ] Task 1.2 — Description
- [ ] Task 1.3 — Description

**Acceptance Criteria:**
- File X changes match spec
- Tests pass for feature Y
- No regressions in Z

**Blockers/Notes:**
- Any dependencies on other phases?

### Phase Y — [Name]

[Same structure]

---

## Testing Strategy

- Unit tests for [component X]
- Integration tests for [feature Y]
- Manual QA steps: [list]

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | ⏳ in-progress | Started 2026-05-04 |
| Phase 2 | ⏱️ pending | Blocked by Phase 1 |

```

---

## Workflow Steps

### Step 1: Draft the Spec (Phase 0–1)

1. Create a new spec file: `docs/superpowers/specs/YYYY-MM-DD-<name>.md`
2. Write problem, goals, and approach sections
3. Get 2+ stakeholder reviews (in-review status)
4. Address feedback; update status to **approved**

**Who:** Feature owner / architect  
**Time:** 1–2 days  

### Step 2: Write Implementation Plan (Phase 2)

1. Review the approved spec
2. Create `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
3. Break into phases and tasks
4. Identify dependencies and effort
5. Get sign-off from tech lead

**Who:** Implementation lead  
**Time:** 1 day  

### Step 3: Implement (Phase 3)

1. Update the plan's progress tracker as you work
2. Follow the spec strictly; raise issues if spec needs revision
3. Write tests alongside implementation
4. Track blockers in the plan document

**Who:** Engineers  
**Time:** [Phase-dependent]

### Step 4: Code Review & Merge (Phase 4)

1. Code review verifies spec compliance and tests
2. CI/CD must pass
3. All acceptance criteria met
4. Merge to main

### Step 5: Archive (Phase 4 → Done)

1. After merge, move spec to `docs/superpowers/archives/`
2. Update spec status to **archived**
3. Add final status note
4. Reference the main branch commit hash

**File:** `docs/superpowers/archives/YYYY-MM-DD-<name>.md`  
**Header update:**
```markdown
**Status:** archived  
**Shipped:** 2026-05-10 ([abc1234](https://github.com/...))
```

---

## Status Definitions

| Status | Meaning | Location |
|--------|---------|----------|
| **draft** | Still researching, not ready for review | specs/ |
| **in-review** | Awaiting stakeholder sign-off | specs/ |
| **approved** | Ready for implementation | specs/ |
| **archived** | Shipped; moved to archives | archives/ |

**Plan statuses:**
| Status | Meaning |
|--------|---------|
| **draft** | Not finalized, awaiting tech review |
| **ready** | Ready to start work |
| **in-progress** | Work underway |
| **completed** | All phases done, code merged |

---

## Best Practices

### Writing Specs

1. **Be specific:** "Reduce extension entries from 35 to 5" (not "optimize extensions")
2. **Show your work:** Include design diagrams, pseudocode, or ASCII tables
3. **Anticipate concerns:** Address performance, backwards compatibility, testing
4. **Give options:** Show at least 2 approaches; explain why you chose one
5. **Define acceptance criteria upfront:** Who decides when you're done?

### Writing Plans

1. **Link to the spec:** Plans are subservient to specs; always reference it
2. **Break into phases:** Use dependencies to identify what can parallelize
3. **Be honest about unknowns:** "We may need to refactor X" → add a task
4. **Make tasks actionable:** Each task should be doable in ≤1 day
5. **Update as you go:** Mark tasks done immediately; don't batch updates

### Code Review

1. **Read the spec first:** Reviewer should verify code matches the spec
2. **Check acceptance criteria:** Are all acceptance criteria met?
3. **Ask about non-goals:** If code goes beyond the spec, flag it
4. **Test against the spec:** Run the tests; verify they cover spec examples

---

## Examples

### Good Spec (from pi-me)

- **File:** `docs/superpowers/specs/2026-05-03-extension-consolidation-design.md`
- **Strengths:**
  - Clear problem statement (35 extensions = startup overhead)
  - Concrete goals (reduce to 5, add profile system)
  - Multiple approaches (Approach A vs. C)
  - Detailed file changes (shows exactly what moves/deletes)
  - Non-goals (what's explicitly out of scope)

### Good Plan (from pi-me)

- **File:** `docs/superpowers/plans/2026-05-03-extension-consolidation-implementation.md`
- **Strengths:**
  - Breaks into 2 independent tracks (Phase 1 & 2 can parallelize)
  - Links to spec at top
  - Each task has clear acceptance criteria
  - References specific files that change

---

## Q&A

**Q: Do I need both a spec and a plan?**  
A: Yes. Specs are *why and what*; plans are *how and when*. Specs are lasting documents (archived); plans are working documents (updated during work).

**Q: Can I skip the spec for small features?**  
A: If it's truly trivial (fixing a typo, one-file change), use a GitHub issue + PR description instead. For anything architectural or touching 3+ files, write a spec.

**Q: Who approves specs?**  
A: At least 2 stakeholders (tech lead, affected maintainer, etc.). For major changes, post in project chat for async input.

**Q: What if I discover the spec is wrong mid-implementation?**  
A: Pause, update the spec, get re-approval, then continue. Don't silently deviate.

**Q: How long do specs take to write?**  
A: 4–8 hours for medium features (50–500 LOC change). 1–2 hours for tiny features. Plan accordingly.

---

## Checklist: Spec Review

- [ ] Problem statement is clear and quantified (e.g., "35 extensions")
- [ ] Goals are specific and measurable (e.g., "reduce to 5")
- [ ] At least 2 approaches are shown; tradeoffs explained
- [ ] File changes are detailed (what moves, deletes, changes)
- [ ] Dependencies on other systems are listed
- [ ] Acceptance criteria are testable
- [ ] Non-goals are explicit
- [ ] Estimated effort is given
- [ ] No vague language ("improve", "better") — be concrete

---

## Checklist: Implementation Plan Review

- [ ] Plan links to the approved spec
- [ ] Phases are ordered by dependency
- [ ] Tasks are small (≤1 day each)
- [ ] Acceptance criteria are testable
- [ ] Effort estimate is given per phase
- [ ] Testing strategy is described
- [ ] Blockers/risks are flagged
- [ ] Progress tracker exists and will be updated

# Specs & Plans — A Scalable Design Workflow

This directory contains the specification and implementation planning framework for pi-me feature development.

---

## What's Here

```
superpowers/
├── README.md                       (this file)
├── SPECS_WORKFLOW.md              (full workflow guide)
├── QUICK_START.md                 (5-minute quickstart)
├── STATUS_GUIDE.md                (status definitions & transitions)
├── REFERENCE.md                   (existing specs as examples)
│
├── specs/                         (active design documents)
│   ├── 2026-05-03-extension-consolidation-design.md
│   └── ...
│
├── plans/                         (implementation plans)
│   ├── 2026-05-03-extension-consolidation-implementation.md
│   └── ...
│
├── archives/                      (completed specs)
│   └── (empty, populated after shipping)
│
└── templates/                     (scaffold for new specs/plans)
    ├── SPEC_TEMPLATE.md
    └── PLAN_TEMPLATE.md
```

---

## Quick Start (2 Minutes)

### I have a feature idea. What do I do?

1. **Create a spec file:**
   ```bash
   cp docs/superpowers/templates/SPEC_TEMPLATE.md \
      docs/superpowers/specs/$(date +%Y-%m-%d)-my-feature.md
   ```

2. **Fill in the sections:**
   - Problem (be specific, use numbers)
   - Goals (2–3 outcomes)
   - At least 2 approaches
   - File changes you're making
   - Acceptance criteria

3. **Get feedback:**
   - Post in #engineering: "Spec [date-feature] is ready for review"
   - Tag 2 people
   - Address comments
   - Mark status `approved` when done

4. **Create an implementation plan:**
   ```bash
   cp docs/superpowers/templates/PLAN_TEMPLATE.md \
      docs/superpowers/plans/$(date +%Y-%m-%d)-my-feature.md
   ```

5. **Do the work.**

**See [QUICK_START.md](QUICK_START.md) for full details.**

---

## Core Workflow

```
Idea
  ↓
Spec (draft → in-review → approved)
  ↓
Plan (draft → ready → in-progress → completed)
  ↓
Code (implement, test)
  ↓
Review (against spec)
  ↓
Merge
  ↓
Archive (move spec to archives/, mark as completed)
```

---

## Key Principles

1. **Specs are Design, Plans are Execution**
   - Spec answers: *Why? What? How?*
   - Plan answers: *When? Who? How long?*

2. **Specs are Approved Before Work Starts**
   - No implementation without stakeholder sign-off
   - If the spec is wrong, update it and re-approve

3. **Plans are Living Documents**
   - Update daily as work progresses
   - Track blockers and unknowns
   - Mark tasks done immediately (don't batch)

4. **Break Work Into Small Phases**
   - Each phase ≤ 3 days of work
   - Phases can parallelize if independent
   - Each task ≤ 1 day

5. **Archive After Shipping**
   - Move specs to `archives/` when merged
   - Archive serves as history of what was built and why
   - Active `specs/` stays focused on current work

---

## Documents

### [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md) — Full Reference (40 min read)

The complete guide to the workflow. Includes:
- Full workflow diagram
- Spec and plan templates
- Best practices for writing each
- Status definitions
- Review checklists
- Q&A

**Use this when:**
- You're writing your first spec or plan
- You're unsure about a step
- You're reviewing someone else's work

### [QUICK_START.md](QUICK_START.md) — Get Moving (5 min read)

Fastest way to start. Includes:
- Copy-paste commands
- Template instructions
- Red flags to watch for
- Links to examples

**Use this when:**
- You have 5 minutes
- You know what to do, just need the steps

### [STATUS_GUIDE.md](STATUS_GUIDE.md) — Understanding Statuses (20 min read)

Deep dive into what each status means and when to transition. Includes:
- Status definitions with examples
- Transition flowcharts
- Common scenarios (spec feedback, blockers, shipping)
- Quick reference table

**Use this when:**
- You're unsure about a status
- You're reviewing someone else's spec/plan
- You need to transition a document

### [REFERENCE.md](REFERENCE.md) — Existing Examples (10 min read)

Shows the specs/plans already in the repo and what makes them good. Includes:
- Extension Consolidation (a well-written spec & plan)
- What to learn from each section
- Copy-paste checklist
- FAQ

**Use this when:**
- You want to see a real example
- You're writing your first spec and want to check your work
- You want to use an existing spec as a template

---

## File Organization

### `specs/` — Active Design Documents

**What goes here:**
- Detailed design for a proposed feature
- Problem statement, goals, approach
- File changes, dependencies, acceptance criteria
- Status: `draft` → `in-review` → `approved`

**Naming:** `YYYY-MM-DD-<feature-name>.md`

**Lifecycle:**
1. Author writes and marks `draft`
2. Author marks `in-review`, posts for feedback
3. Stakeholders review and sign off
4. Author marks `approved`
5. When work ships, spec moves to `archives/`

**Example:** `2026-05-03-extension-consolidation-design.md`

---

### `plans/` — Implementation Plans

**What goes here:**
- Breakdown of an approved spec into phases and tasks
- Effort estimates, testing strategy, dependencies
- Progress tracking and blockers
- Status: `draft` → `ready` → `in-progress` → `completed`

**Naming:** `YYYY-MM-DD-<feature-name>.md` (matches the spec date/name)

**Lifecycle:**
1. Implementation lead writes plan from approved spec
2. Tech lead reviews; plan marked `ready`
3. Work begins; plan marked `in-progress`
4. Progress updated daily
5. When code ships, plan marked `completed`

**Example:** `2026-05-03-extension-consolidation-implementation.md`

---

### `archives/` — Completed Specs

**What goes here:**
- Specs for features that are shipped and merged to main
- Historical record of *why and how* each feature was built

**Naming:** Same as original spec (no separate versioning)

**When to archive:**
- Code is merged to main
- All tests pass
- Spec status updated to `archived`
- Spec moved from `specs/` to `archives/`

**Use case:**
- "Why did we build feature X?" → Look in archives
- "What did we change about Y?" → Read the archived spec

---

### `templates/` — Scaffolds

**What goes here:**
- `SPEC_TEMPLATE.md` — Copy this to start a new spec
- `PLAN_TEMPLATE.md` — Copy this to start a new plan

**How to use:**
```bash
# Create a new spec
cp templates/SPEC_TEMPLATE.md specs/$(date +%Y-%m-%d)-my-feature.md

# Create a new plan
cp templates/PLAN_TEMPLATE.md plans/$(date +%Y-%m-%d)-my-feature.md
```

---

## Status at a Glance

### Spec Statuses

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `draft` | Writing, not ready for review | Get feedback internally, move to `in-review` |
| `in-review` | Awaiting stakeholder sign-off | Address feedback, move to `approved` |
| `approved` | Approved, ready for implementation | Create implementation plan, start work |
| `archived` | Shipped and merged to main | Historical reference |

### Plan Statuses

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `draft` | Being planned, not reviewed | Get tech lead sign-off, move to `ready` |
| `ready` | Finalized, can start work | Begin implementation, move to `in-progress` |
| `in-progress` | Work is underway | Update progress daily, move to `completed` when done |
| `completed` | All work done and merged | Archive related spec |

**Key rule:** A spec must be `approved` before a plan exists.

**See [STATUS_GUIDE.md](STATUS_GUIDE.md) for full details.**

---

## Getting Help

| Question | Answer |
|----------|--------|
| I have 5 minutes and want to start. | Read [QUICK_START.md](QUICK_START.md) |
| I need the full workflow. | Read [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md) |
| What does status X mean? | Read [STATUS_GUIDE.md](STATUS_GUIDE.md) |
| I want to see an example. | Read [REFERENCE.md](REFERENCE.md) |
| Where do I copy from? | Use `templates/SPEC_TEMPLATE.md` or `templates/PLAN_TEMPLATE.md` |

---

## Examples in This Repo

### Extension Consolidation (Good Spec ✅)

- **Spec:** [`specs/2026-05-03-extension-consolidation-design.md`](specs/2026-05-03-extension-consolidation-design.md)
- **Why it's good:** Quantified problem, multiple approaches, clear file changes, non-goals defined
- **Plan:** [`plans/2026-05-03-extension-consolidation-implementation.md`](plans/2026-05-03-extension-consolidation-implementation.md)
- **Why it's good:** Breaks into phases, small tasks, detailed acceptance criteria, parallelizable

---

## FAQ

**Q: How long does a spec take to write?**  
A: 4–8 hours for a medium feature (50–500 LOC). 1–2 hours for tiny features.

**Q: Do I need a plan for every spec?**  
A: Only for approved specs. Don't plan something that hasn't been approved.

**Q: What if the spec is wrong during implementation?**  
A: Stop, update the spec, get re-approval, then continue. Don't silently deviate.

**Q: Can I write a one-page spec?**  
A: Yes, if your feature is small. But it must still have problem, goals, approach, and acceptance criteria.

**Q: Who approves specs?**  
A: 2+ stakeholders (tech lead, affected maintainer, etc.). For small features, one is OK.

**Q: When do I move a spec to archives?**  
A: When the code is merged to main. Do this at the same time you mark the plan as `completed`.

---

## Workflow Diagram

```
┌──────────────────────────────────────────────────────────┐
│ PROBLEM IDENTIFIED                                       │
│ (idea, customer request, tech debt, etc.)               │
└──────────────────────────┬───────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ PHASE 1: SPEC (draft → in-review → approved)            │
│                                                           │
│ • Write problem, goals, approach                        │
│ • Define file changes                                    │
│ • Get 2+ stakeholder sign-off                           │
└──────────────────────────┬───────────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │ DECISION: Ship it?     │
              └────────────────────────┘
                 ✗ (revise)   ✓ (approved)
                    ↓              ↓
                back to      Phase 2
                draft        (planning)
                             ↓
┌──────────────────────────────────────────────────────────┐
│ PHASE 2: PLAN (draft → ready → in-progress → completed) │
│                                                           │
│ • Break spec into phases & tasks                        │
│ • Estimate effort                                        │
│ • Get tech lead sign-off                                │
└──────────────────────────┬───────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ PHASE 3: IMPLEMENT (in-progress)                        │
│                                                           │
│ • Write code, tests                                      │
│ • Update plan progress daily                            │
│ • Block if needed, don't deviate silently               │
└──────────────────────────┬───────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ PHASE 4: REVIEW & MERGE (review)                        │
│                                                           │
│ • Code review against spec & criteria                   │
│ • All tests pass                                         │
│ • Merge to main                                          │
└──────────────────────────┬───────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ PHASE 5: ARCHIVE                                        │
│                                                           │
│ • Move spec to archives/                               │
│ • Mark plan as completed                                │
│ • Update spec status to archived                        │
└──────────────────────────┬───────────────────────────────┘
                           ↓
                      SHIPPED ✅
```

---

## Contributing to This Framework

This workflow is living documentation. Found a gap? Have suggestions?

- Add examples to [REFERENCE.md](REFERENCE.md)
- Improve templates in `templates/`
- Update this README

The goal: make it easy to propose, plan, and ship features without chaos.

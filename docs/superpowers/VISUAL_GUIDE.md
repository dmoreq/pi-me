# Visual Guide — Specs & Plans Workflow

Quick visual reference for the workflow.

---

## The Five Phases

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PHASE 1       │     │   PHASE 2       │     │   PHASE 3       │
│                 │     │                 │     │                 │
│   DESIGN        │────→│   PLANNING      │────→│ IMPLEMENTATION  │
│                 │     │                 │     │                 │
│  Write spec     │     │ Write plan      │     │  Write code     │
│  Get approval   │     │ Get sign-off    │     │  Run tests      │
└─────────────────┘     └─────────────────┘     │ Update daily    │
                                                 └────────┬────────┘
                                                         │
                         ┌───────────────────────────────┘
                         │
                    ┌────▼────────────┐     ┌──────────────────┐
                    │   PHASE 4       │     │    PHASE 5       │
                    │                 │     │                  │
                    │   REVIEW        │────→│    ARCHIVE       │
                    │                 │     │                  │
                    │ Code review     │     │ Move to archives │
                    │ Verify spec     │     │ Mark done        │
                    │ Merge PR        │     └──────────────────┘
                    └─────────────────┘              │
                                                     │
                                            ┌────────▼─────────┐
                                            │   SHIPPED ✅     │
                                            └──────────────────┘
```

---

## Status Transitions for Specs

```
        START (idea)
            │
            ▼
        ┌─────────┐
        │ DRAFT   │ ◄──── writing, internal review
        └────┬────┘
             │ (ready for external feedback?)
             ├─ YES ──┐
             │        ▼
             │    ┌──────────┐
             │    │IN-REVIEW │ ◄──── stakeholder feedback
             │    └────┬─────┘
             │         │ (all feedback addressed?)
             │         ├─ YES ──┐
             │         │        ▼
             │         │    ┌──────────┐
             │         │    │APPROVED  │ ◄──── ready to implement
             │         │    └────┬─────┘
             │         │         │ (code shipped?)
             │         │         ├─ YES ──┐
             │         │         │        ▼
             │         │         │    ┌──────────┐
             │         │         │    │ARCHIVED  │ ◄──── move to archives/
             │         │         │    └──────────┘
             │         │         │
             └─────────┴─────────┘
             (feedback needs major changes?)
             go back to draft
```

---

## Status Transitions for Plans

```
        START (from approved spec)
            │
            ▼
        ┌────────┐
        │ DRAFT  │ ◄──── planning, tech lead review
        └────┬───┘
             │ (plan finalized & approved?)
             ├─ YES ──┐
             │        ▼
             │    ┌────────┐
             │    │ READY  │ ◄──── ready to work
             │    └────┬───┘
             │         │ (work begins)
             │         ▼
             │    ┌────────────┐
             │    │IN-PROGRESS │ ◄──── daily updates, track progress
             │    └────┬───────┘
             │         │ (all phases done?)
             │         ├─ YES ──┐
             │         │        ▼
             │         │    ┌───────────┐
             │         │    │COMPLETED  │ ◄──── code merged, spec archived
             │         │    └───────────┘
             │         │
             └─────────┘
             (major changes needed?)
             update plan or spec
```

---

## File Organization

```
docs/superpowers/
│
├─ README.md ......................... Start here
├─ QUICK_START.md ................... 5-minute guide
├─ SPECS_WORKFLOW.md ................ Full reference (40 min)
├─ STATUS_GUIDE.md .................. Status definitions
├─ REFERENCE.md ..................... Existing examples
├─ VISUAL_GUIDE.md .................. This file
│
├─ specs/ ........................... Active designs
│  ├─ 2026-05-03-extension-consolidation-design.md
│  └─ [your spec here]
│
├─ plans/ ........................... Implementation plans
│  ├─ 2026-05-03-extension-consolidation-implementation.md
│  └─ [your plan here]
│
├─ archives/ ........................ Completed specs
│  └─ [specs move here after shipping]
│
└─ templates/ ....................... Scaffolds
   ├─ SPEC_TEMPLATE.md
   └─ PLAN_TEMPLATE.md
```

---

## Document Reading Order

### For Someone New (30 minutes)

```
README.md (5 min)
    ↓
QUICK_START.md (5 min)
    ↓
REFERENCE.md (10 min, see existing examples)
    ↓
Pick template, start writing
```

### For Someone Doing Code Review (20 minutes)

```
SPECS_WORKFLOW.md section: "Best Practices" (5 min)
    ↓
STATUS_GUIDE.md (10 min)
    ↓
REFERENCE.md (5 min, refresh on good examples)
    ↓
Review the spec/plan
```

### For Someone Implementing (ongoing)

```
README.md (5 min)
    ↓
QUICK_START.md → create plan
    ↓
SPECS_WORKFLOW.md section: "Best Practices: Writing Plans" (10 min)
    ↓
Start Phase 1, update plan daily
    ↓
Hit a blocker?
    → Update plan, document blocker
    → Update spec if needed, get re-approval
    → Continue work
```

---

## What Goes Where?

### Spec: What to Include

```
┌─────────────────────────────────────┐
│         SPEC DOCUMENT               │
├─────────────────────────────────────┤
│ Title                               │ (clear, 5-10 words)
│ Date / Status / Author              │
├─────────────────────────────────────┤
│ Problem                             │ (quantified, specific)
├─────────────────────────────────────┤
│ Goals                               │ (2-3 bullet points)
├─────────────────────────────────────┤
│ Approach                            │ (at least 2 options)
│ - Option A (pros/cons)              │
│ - Option B (pros/cons)              │
│ - Why we chose [Option]             │
├─────────────────────────────────────┤
│ Design Details                      │ (architecture, diagrams)
│ - File changes (table or list)      │
│ - Dependencies                      │
│ - Non-goals                         │
├─────────────────────────────────────┤
│ Implementation Notes                │ (effort, risks)
├─────────────────────────────────────┤
│ Acceptance Criteria                 │ (testable checklist)
└─────────────────────────────────────┘
```

### Plan: What to Include

```
┌─────────────────────────────────────┐
│        PLAN DOCUMENT                │
├─────────────────────────────────────┤
│ Title                               │
│ Based on: [link to spec]            │ (MUST reference spec)
│ Status / Updated                    │
├─────────────────────────────────────┤
│ Overview                            │ (summary + effort)
├─────────────────────────────────────┤
│ Phases                              │ (break into chunks)
│ Phase 1 - [name]                    │
│ - Tasks (checklist)                 │
│ - Acceptance Criteria               │
│ - Effort estimate                   │
│ Phase 2 - [name]                    │
│ - ...                               │
├─────────────────────────────────────┤
│ Testing Strategy                    │ (unit/integration/manual)
├─────────────────────────────────────┤
│ Progress Tracker                    │ (table, update daily)
├─────────────────────────────────────┤
│ Risk & Mitigation (optional)        │
├─────────────────────────────────────┤
│ Key Decisions                       │
├─────────────────────────────────────┤
│ Assumptions                         │
└─────────────────────────────────────┘
```

---

## Decision Tree: Do I Need a Spec?

```
                    Is this a code change?
                            │
                    ┌───────┴───────┐
                    ▼               ▼
            Is it < 50 LOC?    Is it > 500 LOC?
              OR 1 file?         OR touches 3+ files?
                  │                   │
              YES │ NO              YES │ NO
                  ▼ │                   ▼ │
            ┌──────┴─────────────────────┐
            │  Tiny / trivial change     │  Medium change
            │  (typo, simple fix)        │  (new feature)
            │                            │
            │  → GitHub issue + PR       │  → WRITE SPEC
            │    description OK          │
            └──────────────┬─────────────┘
                           │
                      DONE ✅
```

---

## Effort Estimation Heuristic

```
Spec writing:
  Tiny feature (1 file)       → 1-2 hours
  Medium feature (3-5 files)  → 4-8 hours
  Large feature (refactoring) → 8-16 hours

Plan writing:
  Any spec                    → 1-2 hours (once spec is done)

Implementation:
  Depends on phases
  Each phase should be        → 1-3 days
  Each task should be         → < 1 day

Code review:
  Against spec                → 15-30 min

Archive:
  Move file, update status    → 5 min
```

---

## Red Flags

```
SPEC RED FLAGS 🚩

├─ "This is vague"
│  → Rewrite to be quantified (use numbers)
│
├─ "I don't know all the options"
│  → Research, then add multiple approaches
│
├─ "I can't write acceptance criteria"
│  → Spec isn't clear enough; rethink design
│
└─ "The problem isn't clear"
   → Ask: why does this matter? what breaks?


PLAN RED FLAGS 🚩

├─ "A task is bigger than 1 day"
│  → Break it into smaller tasks
│
├─ "I don't know the effort"
│  → Break it smaller, estimate each piece
│
├─ "The spec and plan don't match"
│  → Update the spec, not the code
│
└─ "We're deviating from the spec"
   → Stop. Update spec. Get re-approval.
```

---

## Example: Extension Consolidation

```
SPEC EXAMPLE
───────────
📄 2026-05-03-extension-consolidation-design.md

Problem
  → 35 extensions, slow startup, hard to toggle

Goals
  → Reduce to 5, add profile system, backwards compatible

Approaches
  → Option A: Umbrellas
  → Option C: Umbrellas + merges (chosen)

File Changes
  → Auto-compact merge
  → Session-name inline
  → 5 umbrellas (new)
  → package.json (35 → 5)

Non-Goals
  → Don't change implementation
  → Don't rename tools
  → Don't touch tests


PLAN EXAMPLE
───────────
📄 2026-05-03-extension-consolidation-implementation.md

Phase 1: Tiny Merges (3 tasks, 1 day)
  → Auto-compact merge
  → Session-name inline
  → Skill-args inline

Phase 2: Umbrellas (5 tasks, 1 day)
  → Foundation umbrella
  → Session-lifecycle umbrella
  → Core-tools umbrella
  → ...

Testing
  → All tests pass
  → No regressions

Progress: [updated daily]
```

---

## Quick Commands

```bash
# Create a new spec
cp docs/superpowers/templates/SPEC_TEMPLATE.md \
   docs/superpowers/specs/$(date +%Y-%m-%d)-my-feature.md

# Create a new plan
cp docs/superpowers/templates/PLAN_TEMPLATE.md \
   docs/superpowers/plans/$(date +%Y-%m-%d)-my-feature.md

# Archive a spec (after shipping)
mv docs/superpowers/specs/YYYY-MM-DD-feature.md \
   docs/superpowers/archives/

# List all active specs
ls docs/superpowers/specs/

# List all active plans
ls docs/superpowers/plans/

# List all archived specs
ls docs/superpowers/archives/
```

---

## One-Page Cheat Sheet

```
SPEC CHECKLIST                PLAN CHECKLIST
──────────────────            ──────────────
□ Title & date                □ Title & date
□ Status: draft               □ Status: draft
□ Problem (quantified)        □ Links to spec
□ Goals (2-3)                 □ Effort estimate
□ 2+ approaches               □ Phases (≤3 days each)
□ Design details              □ Tasks (≤1 day each)
□ File changes (specific)     □ Acceptance criteria
□ Dependencies                □ Testing strategy
□ Non-goals                   □ Progress tracker
□ Acceptance criteria         □ Blockers/risks
```

---

## Status Quick Ref

| Doc | Status | Ready? | Action |
|-----|--------|--------|--------|
| Spec | draft | ❌ | Internal review, get feedback |
| Spec | in-review | ❌ | Stakeholder review, address comments |
| Spec | approved | ✅ | Create plan, start work |
| Spec | archived | 📦 | Historical reference |
| Plan | draft | ❌ | Tech lead review |
| Plan | ready | ✅ | Start implementation |
| Plan | in-progress | 🔧 | Daily updates, block if needed |
| Plan | completed | ✅ | Archive spec, mark done |

# [Feature Title]

**Date:** YYYY-MM-DD  
**Status:** draft  
**Author:** @username  

## Problem

[What pain point or inefficiency does this solve? Be specific and quantified.]

Example: "Extension entry points number 35, causing measurable startup-time overhead and making feature toggles hard."

## Goals

- [Specific, measurable goal 1]
- [Specific, measurable goal 2]
- [Specific, measurable goal 3]

Example:
- Reduce extension entries from 35 to 5
- Add a user-facing profile system (minimal/dev/full)
- Maintain 100% backwards compatibility

## Approach

### Option A — [Descriptive Name]

[Detailed explanation of this approach]

**Pros:**
- Benefit 1
- Benefit 2

**Cons:**
- Drawback 1
- Drawback 2

### Option B — [Descriptive Name] (Recommended)

[Detailed explanation of this approach]

**Pros:**
- Benefit 1
- Benefit 2

**Cons:**
- Drawback 1
- Drawback 2

**Why this option?**

[Clear reasoning for why Option B is chosen over A, C, etc. Cost-benefit analysis.]

## Design Details

### Architecture

[Describe the system design. Include diagrams or ASCII art if helpful.]

Example:
```
┌──────────────────────────────────────┐
│ package.json (5 entries)             │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Each umbrella reads settings.json    │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Loads features based on profile      │
│ (minimal/dev/full)                   │
└──────────────────────────────────────┘
```

### Key Changes

[List the major file changes: what moves, what deletes, what's new]

Example:
- `core-tools/clipboard.ts` — **deleted** (inlined into umbrella)
- `core-tools/index.ts` — **new** (umbrella entry point)
- `package.json` — **modified** (extensions reduced from 35 to 5)

### Dependencies

- Does this require changes to another system? (list them)
- Any breaking changes? (list and explain migration path)
- Performance impact? (measurement plan)
- Backwards compatibility? (how do we maintain it?)

Example:
- No external dependencies
- Fully backwards compatible (defaults to "full" profile)
- No performance impact (profile loaded at startup only)

### Non-Goals

[What are we explicitly NOT doing? What's out of scope?]

Example:
- Do not change any extension's internal implementation
- Do not rename any tool names or slash commands
- Do not modify tests or test expectations

## Implementation Notes

- **Estimated effort:** [e.g., 2–3 days]
- **Risk factors:** [any blockers or unknowns?]
- **Parallelizable:** [yes/no — can work be split?]
- **Tech depth:** [e.g., "requires knowledge of extension API"]

## Acceptance Criteria

- [ ] All file changes match the spec
- [ ] Tests written for new functionality
- [ ] No breaking changes (or documented with migration guide)
- [ ] Code review approved
- [ ] All existing tests pass
- [ ] Documentation updated (if user-facing)
- [ ] Merged to main

## Open Questions

[Anything you're unsure about? Decisions not yet made?]

- Question 1?
- Question 2?

[These become blockers for the implementation plan or require stakeholder input.]

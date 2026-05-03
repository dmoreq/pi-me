# Status Guide — Specs & Plans

This document explains what each status means and when to transition.

---

## Spec Statuses

```
     draft                 in-review              approved
      ↓                       ↓                        ↓
   Writing            Awaiting feedback         Ready to implement
     ↓                       ↓                        ↓
   [feedback] ────→ [stakeholder sign-off] ──→ [planning begins]
     ↓                       ↓
   [revise]            [revise or approve]
     ↓                       ↓
  [back to draft]      [back to in-review]

     approved                                      archived
       ↓                                               ↓
    Implementation plan created           After code merges to main
       ↓                                               ↓
    Work begins                          Moved to docs/superpowers/archives/
```

### Status: `draft`

**Meaning:** Still researching, designing, not yet ready for stakeholder review.

**Location:** `docs/superpowers/specs/`

**What's allowed:**
- Sections are incomplete or rough
- You're still evaluating approaches
- No external review yet
- Can revise freely without notifying anyone

**When to transition to `in-review`:**
- All major sections filled in
- At least 2 approaches are documented
- Acceptance criteria are defined
- Ready for 2+ stakeholder reviews

**Example header:**
```markdown
**Status:** draft  
**Author:** @alice
```

---

### Status: `in-review`

**Meaning:** Awaiting stakeholder feedback and sign-off.

**Location:** `docs/superpowers/specs/`

**What's happening:**
- 2+ stakeholders are reading and commenting
- Author is addressing feedback
- Revisions are expected

**What you should do:**
- Post in #engineering channel: "Spec [YYYY-MM-DD-feature] is in review, feedback welcome"
- Tag specific people if needed: "@bob @carol please review"
- Address all feedback comments
- Update the spec and note what changed

**When to transition to `approved`:**
- 2+ stakeholders have signed off (comment: "+1, lgtm")
- All concerns addressed or documented as "Future Work"
- No open objections

**When to go back to `draft`:**
- Major feedback requires rethinking the approach
- Stakeholders disagree on the solution

**Example header:**
```markdown
**Status:** in-review  
**Author:** @alice  
**Reviewers:** @bob, @carol  
**Feedback:** [link to review discussion]
```

---

### Status: `approved`

**Meaning:** Stakeholders have signed off. Ready for implementation planning.

**Location:** `docs/superpowers/specs/`

**What this unlocks:**
- An implementation plan can now be created (`docs/superpowers/plans/`)
- Work can begin following the plan
- Deviations from the spec require a re-review

**How to mark as approved:**
- Update header:
  ```markdown
  **Status:** approved  
  **Approved by:** @bob, @carol  
  **Approved date:** 2026-05-05
  ```
- Post in #engineering: "Spec [YYYY-MM-DD-feature] approved! Implementation plan coming."

**Important:** If the spec is approved but no plan has been created yet, the spec remains `approved` (not archived).

---

### Status: `archived`

**Meaning:** Implementation is complete and merged to main.

**Location:** `docs/superpowers/archives/`

**Steps to archive:**
1. Implementation complete, code merged to main
2. Move file:
   ```bash
   mv docs/superpowers/specs/YYYY-MM-DD-feature.md \
      docs/superpowers/archives/YYYY-MM-DD-feature.md
   ```
3. Update header:
   ```markdown
   **Status:** archived  
   **Approved by:** @bob, @carol  
   **Shipped:** 2026-05-10  
   **Merge commit:** abc1234 ([link](https://github.com/...))
   ```

**Why archive?**
- Keeps the active `specs/` directory focused on *current* projects
- Archived specs serve as historical design records
- Easier to find "what did we build?" by looking at archives

---

## Plan Statuses

```
     draft                ready            in-progress           completed
      ↓                    ↓                    ↓                      ↓
   Planning           Planning done      Work underway          All done, merged
     ↓                    ↓                    ↓                      ↓
  [tech review]    [sign-off to start]  [daily progress]      [final review + merge]
                          ↓
                    [work begins]
```

### Status: `draft`

**Meaning:** Plan is being written; not yet reviewed or finalized.

**Location:** `docs/superpowers/plans/`

**What's allowed:**
- Phases/tasks may be incomplete or uncertain
- Estimates may be rough
- Dependencies not yet fully thought through
- Can revise freely

**When to transition to `ready`:**
- All phases are defined
- Tasks are specific and actionable (≤1 day each)
- Effort is estimated
- Tech lead has reviewed
- Dependencies are clear

---

### Status: `ready`

**Meaning:** Plan is finalized and reviewed. Work can start.

**Location:** `docs/superpowers/plans/`

**What this means:**
- Tech lead has approved the breakdown
- Estimates are realistic
- No surprises expected
- Work can begin immediately

**How to mark as ready:**
```markdown
**Status:** ready  
**Reviewed by:** @bob  
**Ready date:** 2026-05-06
```

---

### Status: `in-progress`

**Meaning:** Work is actively underway.

**Location:** `docs/superpowers/plans/`

**What you must do:**
- Update the progress tracker **daily** or after completing tasks
- Mark tasks done immediately (don't batch)
- Raise blockers in the plan document

**Example progress update:**
```markdown
| Phase | Status | Owner | Notes |
|-------|--------|-------|-------|
| Phase 1 | ✅ complete | @you | Finished 2026-05-07 |
| Phase 2 | ⏳ in-progress | @you | Started 2026-05-08, on track |
| Phase 3 | ⏱️ pending | @you | Will start 2026-05-10 |
```

**If you discover a problem:**
1. Add a note: "Blocker: [description]"
2. Update the plan (new task, revised estimate, etc.)
3. Do NOT proceed silently deviating from the plan
4. Example:
   ```markdown
   **Blocker:** Refactoring component X requires changes to spec.
   Action: Updated spec, awaiting re-approval. Phase 3 paused.
   ```

---

### Status: `completed`

**Meaning:** All work is done and merged to main.

**Location:** `docs/superpowers/plans/`

**Steps to mark completed:**
1. All tasks are ✅ done
2. All tests pass
3. Code is merged to main
4. Update header:
   ```markdown
   **Status:** completed  
   **Completed date:** 2026-05-15  
   **Merge commit:** def5678  
   **Related spec:** [archived spec](../archives/YYYY-MM-DD-feature.md)
   ```

**After completion:**
- Move the spec to `docs/superpowers/archives/`
- Update spec status to `archived`
- Link the plan to the archived spec (and vice versa)

---

## Status Transition Flowchart

### For Specs

```
START
  ↓
[write spec]
  ↓
status = "draft"
  ↓
[internal review: fix obvious issues]
  ↓
[ready for external feedback?]
  ├─ NO → stay in "draft", fix, repeat
  └─ YES ↓
    status = "in-review"
      ↓
    [wait for 2+ stakeholder reviews]
      ↓
    [concerns?]
      ├─ YES → status = "draft", revise, back to "in-review"
      └─ NO ↓
        status = "approved"
          ↓
        [create implementation plan]
          ↓
        [after merge]
          ↓
        status = "archived"
          ↓
        [move to archives/]
          ↓
        END
```

### For Plans

```
START
  ↓
[break spec into phases/tasks]
  ↓
status = "draft"
  ↓
[tech lead review]
  ↓
[realistic?]
  ├─ NO → revise, repeat
  └─ YES ↓
    status = "ready"
      ↓
    [work starts]
      ↓
    status = "in-progress"
      ↓
    [daily: update progress tracker]
      ↓
    [blocked?]
      ├─ YES → document blocker, pause
      └─ NO → continue
        ↓
      [all phases done?]
        ├─ NO → continue work
        └─ YES ↓
          [code review + merge]
            ↓
          status = "completed"
            ↓
          [archive related spec]
            ↓
          END
```

---

## Common Transitions

### Scenario 1: Spec feedback requires major changes

**Current state:** Spec is `in-review`

**Action:**
1. Update spec with major changes (multiple sections rewritten)
2. Add a note: "Major revision addressing feedback from [person]"
3. Stay in `in-review` (re-request review from same stakeholders)

**OR**

If changes are *very* major (different approach), you may revert to `draft` temporarily.

---

### Scenario 2: We discover the spec is incomplete during implementation

**Current state:** Plan is `in-progress`

**Action:**
1. Pause work on that task
2. Add to plan: "Blocker: Spec incomplete for [component]. Updating spec."
3. Update the spec
4. Get re-approval from stakeholders
5. Update plan and resume

**Do NOT proceed without updating the spec.**

---

### Scenario 3: An external dependency blocks us

**Current state:** Plan is `in-progress`, Phase 2 is blocked

**Action:**
1. Update plan's progress tracker:
   ```markdown
   | Phase | Status | Owner | Notes |
   |-------|--------|-------|-------|
   | Phase 2 | ⏱️ blocked | @you | Waiting for [dependency] |
   ```
2. Document the blocker clearly
3. Either: (a) proceed with Phase 3 if independent, or (b) pause and follow up

---

### Scenario 4: We've shipped and need to archive

**Current state:** Plan is `in-progress`, PR just merged

**Action:**

1. **Update the plan:**
   ```markdown
   **Status:** completed  
   **Completed:** 2026-05-15  
   **Merge:** abc1234
   ```

2. **Update the spec:**
   ```bash
   mv docs/superpowers/specs/YYYY-MM-DD-feature.md \
      docs/superpowers/archives/
   ```
   ```markdown
   **Status:** archived  
   **Shipped:** 2026-05-15  
   **Merge:** abc1234
   ```

3. **Cross-link:**
   - Plan header: `**Related spec:** [../archives/YYYY-MM-DD-feature.md]`
   - Spec header: `**Implementation:** [../plans/YYYY-MM-DD-feature.md]`

---

## Quick Reference

| Document | draft | in-review | approved | archived / completed |
|----------|-------|-----------|----------|----------------------|
| Spec | Writing | Feedback | Ready | Done |
| Plan | Writing | ❌ Not used | ✅ Ready | ✅ Done |

**Key rule:** A spec must be `approved` before a plan can exist.

**Key rule:** A plan transitions to `completed` when code merges; the spec transitions to `archived` at the same time.

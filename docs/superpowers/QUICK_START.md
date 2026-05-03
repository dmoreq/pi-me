# Quick Start — Writing Specs & Plans

## I want to propose a new feature. What do I do?

1. **Create a spec file:**
   ```bash
   touch docs/superpowers/specs/$(date +%Y-%m-%d)-my-feature.md
   ```

2. **Fill in the template** (copy from [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md#spec-document-template)):
   - Problem statement
   - Goals (2–3 bullet points)
   - At least 2 approaches with tradeoffs
   - Detailed file changes
   - Non-goals

3. **Get stakeholder sign-off:**
   - Post in #engineering channel
   - Request 2 reviewers
   - Update status: `draft` → `in-review` → `approved`

4. **You're done with the spec.** Next: implementation planning.

**Time estimate:** 4–8 hours

---

## I have an approved spec. How do I plan implementation?

1. **Create a plan file:**
   ```bash
   touch docs/superpowers/plans/$(date +%Y-%m-%d)-my-feature.md
   ```

2. **Fill in the template** (copy from [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md#implementation-plan-template)):
   - Link to the approved spec at the top
   - Break into phases (can they parallelize?)
   - Each phase has 3–5 tasks
   - Each task has acceptance criteria
   - Estimate effort per phase

3. **Review with tech lead:**
   - Does the breakdown make sense?
   - Are dependencies correct?
   - Do estimates seem realistic?

4. **Start work:**
   - Update plan status to `ready`
   - As you start each phase, update progress tracker
   - Mark tasks done immediately (don't batch)
   - Raise issues if you find spec problems

**Time estimate:** 1–2 hours

---

## I finished implementation. What's next?

1. **Code review:**
   - Reviewer checks code against spec & acceptance criteria
   - All tests pass

2. **Merge:**
   - PR approved
   - Merge to main
   - Get commit hash (e.g., `abc1234`)

3. **Archive the spec:**
   ```bash
   mv docs/superpowers/specs/YYYY-MM-DD-my-feature.md \
      docs/superpowers/archives/
   ```

4. **Update spec status:**
   ```markdown
   **Status:** archived  
   **Shipped:** 2026-05-10 ([abc1234](https://github.com/...))
   ```

5. **Mark plan as completed:**
   - Update plan status to `completed`
   - Link to the PR/commit

---

## Red Flags 🚩

| Red Flag | What To Do |
|----------|-----------|
| "The spec is too vague" | Pause. Rewrite the problem statement until it's quantified. |
| "I'm deviating from the spec" | Stop. Update the spec, get re-approval, then continue. |
| "I don't know how to estimate effort" | Break the task smaller. If still stuck, flag as a blocker. |
| "The acceptance criteria aren't testable" | Rewrite them. Replace "it should work" with "test X passes". |
| "Phase 2 depends on Phase 1, but we're out of time" | This is fine! Parallelize by using feature flags or stubs. |

---

## Examples in This Repo

- **Good spec:** [`2026-05-03-extension-consolidation-design.md`](specs/2026-05-03-extension-consolidation-design.md)
- **Good plan:** [`2026-05-03-extension-consolidation-implementation.md`](plans/2026-05-03-extension-consolidation-implementation.md)

Look at these before writing your own.

---

## Need Help?

- **Spec writing:** Read SPECS_WORKFLOW.md → "Best Practices: Writing Specs"
- **Plan writing:** Read SPECS_WORKFLOW.md → "Best Practices: Writing Plans"
- **Status definitions:** Read SPECS_WORKFLOW.md → "Status Definitions"
- **Review checklist:** Read SPECS_WORKFLOW.md → "Checklist: Spec Review"

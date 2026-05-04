---
name: development-workflow
description: Use when building a feature, fixing a bug, or making any code change that needs more than a trivial edit — covers the full lifecycle from brainstorming through to merge/PR
---

> **Alternative workflows:** For pure discipline needs: `/skill:test-driven-development`, `/skill:systematic-debugging`.

# Development Workflow

## Overview

A complete lifecycle for building features: explore, plan, isolate, implement, verify, review, complete. Each phase is optional — skip phases that don't apply to the current change.

**Core principle:** Match the process to the change size. A one-line fix doesn't need brainstorming. A new module does.

**Announce at start:** "I'm using the development-workflow skill."

## Phase Selector

| Change size | Phases to run |
|-------------|---------------|
| Trivial (typo, one-liner) | Verify → Complete |
| Small fix (few lines) | Verify → Review → Complete |
| Feature (new function/module) | Brainstorm → Plan → Isolate → Implement → Verify → Review → Complete |
| Large feature (multi-file) | Brainstorm → Plan → Isolate → Implement → Verify → Review → Complete |
| Unknown / needs exploration | Brainstorm → Plan → Isolate → Implement → Verify → Review → Complete |

## Phase 1: Brainstorming

**Use when:** Requirements are unclear, multiple approaches exist, or the design needs validation before coding.

Explore the idea through collaborative dialogue:
1. Understand current project state (files, docs, recent commits)
2. Ask questions one at a time to refine the idea
3. Propose 2-3 approaches with trade-offs, leading with your recommendation
4. Present design in small sections (200-300 words), validate each

**Output:** Design doc saved to `docs/plans/YYYY-MM-DD-<topic>-design.md`

## Phase 2: Writing Plans

**Use when:** The design is clear and you need a step-by-step implementation plan.

Create bite-sized implementation steps (each 2-5 minutes):
- Exact file paths for every task
- Complete code snippets (not "add validation")
- Test commands with expected output
- Commit commands between tasks

Save plan to: `docs/plans/YYYY-MM-DD-<feature>.md`

After saving, ask if they want to continue with implementation.

## Phase 3: Isolate Workspace

**Use when:** Starting implementation on any non-trivial change to avoid polluting the main workspace.

Create an isolated git worktree:
```bash
# Check existing worktree directories
ls -d .worktrees 2>/dev/null || ls -d worktrees 2>/dev/null

# Verify directory is gitignored (project-local only)
git check-ignore -q .worktrees

# Create worktree
git worktree add <path> -b feature/<name>
cd <path>
npm install  # or project-appropriate setup
npm test     # verify clean baseline
```

**Output:** Isolated worktree with passing tests.

## Phase 4: Implementation

Execute the plan. Choose the right approach:

### For same-session execution (default):
- One task at a time
- Follow TDD if the change warrants it
- Small, frequent commits
- Stop for feedback between logical groups

### For subprocess-driven execution (complex multi-task):
Dispatch a fresh subprocess per task with two-stage review:
1. **Implementer** — builds the task, self-reviews, commits
2. **Spec reviewer** — verifies code matches spec (nothing more, nothing less)
3. **Code quality reviewer** — checks architecture, testing, maintainability

Prompt templates are at `skills/development-workflow/prompts/`:
- `implementer-prompt.md`
- `spec-reviewer-prompt.md`
- `code-reviewer.md`

## Phase 5: Verification Before Completion

**Use before claiming anything is done.**

The Iron Law: `NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`

1. **Identify** — What command proves this claim?
2. **Run** — Execute the full command, fresh and complete
3. **Read** — Full output, check exit code, count failures
4. **Verify** — Does the output confirm the claim?
5. **Only then** — Make the claim with evidence

If you haven't run it in this message, you haven't verified it.

## Phase 6: Code Review

### Requesting review
After implementation, dispatch a code reviewer subprocess with the template at `prompts/code-reviewer.md`. Include the git SHA range and a summary of what changed.

### Receiving review feedback
When receiving feedback:

```
1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement or ask
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

**Never** performative agreement. **Always** technical evaluation. Push back with reasoning if the reviewer is wrong. Fix what's right.

## Phase 7: Finishing the Branch

**Use when:** Implementation is complete, tests pass, and you need to integrate.

1. **Verify tests** — run full suite
2. **Determine base branch** — `git merge-base HEAD main`
3. **Present options** using `ask_user_question`:
   - Merge back locally and clean up
   - Push and create PR
   - Keep branch as-is
   - Discard (requires confirmation)
4. **Execute** the chosen option
5. **Clean up** the worktree

## Red Flags

- Skipping plan phase for complex features
- Implementing on main/master without explicit approval
- Claiming completion without test verification
- Performative agreement on code review feedback
- Forgetting to clean up worktrees
- Subagent implementation without spec compliance review

## Supporting Files

Prompt templates are in `prompts/` within this skill directory:
- `implementer-prompt.md` — For dispatching implementation subprocesss
- `spec-reviewer-prompt.md` — For spec compliance review
- `code-reviewer.md` — For code quality review

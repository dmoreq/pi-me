---
name: authoring-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

> **REQUIRED BACKGROUND:** You MUST understand `/skill:test-driven-development` before using this skill. That skill defines the fundamental RED-GREEN-REFACTOR cycle. This skill adapts TDD to documentation.

# Authoring Skills

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (agents comply), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or tools. Skills help future agent instances find and apply effective approaches.

**Skills are:** Reusable techniques, patterns, tools, reference guides
**Skills are NOT:** Narratives about how you solved a problem once

## TDD Mapping for Skills

| TDD Concept | Skill Creation |
|-------------|----------------|
| **Test case** | Pressure scenario with subagent |
| **Production code** | Skill document (SKILL.md) |
| **Test fails (RED)** | Agent violates rule without skill (baseline) |
| **Test passes (GREEN)** | Agent complies with skill present |
| **Refactor** | Close loopholes while maintaining compliance |
| **Write test first** | Run baseline scenario BEFORE writing skill |
| **Watch it fail** | Document exact rationalizations agent uses |
| **Minimal code** | Write skill addressing those specific violations |
| **Watch it pass** | Verify agent now complies |
| **Refactor cycle** | Find new rationalizations → plug → re-verify |

The entire skill creation process follows RED-GREEN-REFACTOR.

## When to Create a Skill

**Create when:**
- Technique wasn't intuitively obvious to you
- You'd reference this again across projects
- Pattern applies broadly (not project-specific)
- Others would benefit

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in project config)
- Mechanical constraints (if enforceable with regex/validation, automate it)

## Skill Types

### Technique
Concrete method with steps to follow (condition-based-waiting, root-cause-tracing)

### Pattern
Way of thinking about problems (flatten-with-flags, test-invariants)

### Reference
API docs, syntax guides, tool documentation

## Directory Structure

```
skills/
  skill-name/
    SKILL.md              # Main reference (required)
    supporting-file.*     # Only if needed
```

**Flat namespace** — all skills in one searchable namespace

**Separate files for:**
1. **Heavy reference** (100+ lines) — API docs, comprehensive syntax
2. **Reusable tools** — Scripts, utilities, templates

**Keep inline:**
- Principles and concepts
- Code patterns (< 50 lines)
- Everything else

## SKILL.md Structure

**Frontmatter (YAML):**
- Two fields: `name` and `description`
- Max 1024 characters total
- `name`: Letters, numbers, hyphens only
- `description`: Third-person, starts with "Use when...", describes triggering conditions only (NEVER summarize workflow)

```
---
name: Skill-Name-With-Hyphens
description: Use when [specific triggering conditions and symptoms]
---
```

## RED-GREEN-REFACTOR for Skills

### RED: Write Failing Test (Baseline)
Run pressure scenario with subagent WITHOUT the skill. Document exact behavior — what choices, rationalizations, and which pressures triggered violations.

### GREEN: Write Minimal Skill
Write skill addressing those specific rationalizations. Run same scenario WITH skill — agent should now comply.

### REFACTOR: Close Loopholes
Agent found new rationalization? Add explicit counter. Re-test until bulletproof.

## The Iron Law

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

This applies to NEW skills AND EDITS to existing skills. No exceptions.

## Testing All Skill Types

| Type | Test Approach |
|------|---------------|
| **Discipline** (rules) | Pressure scenarios + identify rationalizations |
| **Technique** (how-to) | Application scenarios + edge cases |
| **Pattern** (mental model) | Recognition + application + counter-examples |
| **Reference** (APIs) | Retrieval + application + gap testing |

## Bulletproofing Skills Against Rationalization

- **Close every loophole explicitly** — forbid specific workarounds
- **Address "spirit vs letter"** — add: "Violating the letter of the rules is violating the spirit."
- **Build rationalization table** — capture every excuse from baseline testing
- **Create red flags list** — make it easy for agents to self-check

## Bootstrap Command

The `/bootstrap-skill` command scans a project and generates a `SKILL.md` for it:
```bash
# Use in project root
/bootstrap-skill
# Saves to .pi/skills/<project-name>/SKILL.md
```

Use at the start of a new repo, after significant structure changes, or to document project conventions for other agents.

## Claude Search Optimization (CSO)

- **Description = When to Use, NOT workflow summary.** A description summarizing workflow causes agents to skip reading the full skill.
- **Keyword coverage** — use error messages, symptoms, tools, synonyms
- **Descriptive naming** — active voice, verb-first: `authoring-skills` not `skill-authoring`
- **Token efficiency** — frequently-loaded skills: <200 words; others <500 words

## Skill Creation Checklist

- [ ] Create pressure scenarios (3+ combined pressures for discipline skills)
- [ ] Run scenarios WITHOUT skill — document baseline behavior verbatim
- [ ] Name uses only letters, numbers, hyphens
- [ ] YAML frontmatter with only name and description (max 1024 chars)
- [ ] Description starts with "Use when..." (triggering conditions only)
- [ ] Run scenarios WITH skill — verify agents now comply
- [ ] Identify NEW rationalizations, add explicit counters
- [ ] Build rationalization table from all test iterations
- [ ] Create red flags list
- [ ] Re-test until bulletproof
- [ ] Small flowchart only if decision non-obvious
- [ ] Quick reference table
- [ ] Common mistakes section
- [ ] Commit skill to git

## Cross-Referencing Other Skills

Use `/skill:<name>` format:
- **REQUIRED SUB-SKILL:** Use `/skill:test-driven-development`
- **REQUIRED BACKGROUND:** You MUST understand `/skill:systematic-debugging`

## Code Examples

One excellent example beats many mediocre ones. Choose the most relevant language. Complete and runnable, well-commented explaining WHY, from real scenario.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Narrative storytelling | Reusable technique, not a story |
| Multi-language examples | One excellent example |
| Code in flowcharts | Use code blocks |
| Generic labels | Labels with semantic meaning |
| Skipping testing | Always test before deploying |

## Red Flags

- "Skill is obviously clear" — test it
- "It's just a reference" — references can have gaps
- "Testing is overkill" — 15 min testing saves hours
- "I'll test if problems emerge" — problems = agents can't use it
- Creating multiple skills in batch without testing each

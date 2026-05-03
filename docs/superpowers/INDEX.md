# Index — Specs & Plans Workflow Documentation

A complete index of all documentation for the specs & plans workflow.

---

## 🚀 Start Here

**New to the workflow?** Start with one of these:

1. **[README.md](README.md)** — Main entry point (5 min)
   - Overview of the entire system
   - File organization
   - Status definitions
   - FAQ
   - Examples in the repo

2. **[QUICK_START.md](QUICK_START.md)** — Get moving in 5 minutes
   - Copy-paste commands
   - Basic instructions for each phase
   - Red flags
   - Links to detailed guides

---

## 📖 Complete Guides

**Need more details?** Pick a guide based on what you're doing:

### For Writing Specs

**Best resources:**
1. [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md#spec-document-template) — Spec template + best practices
2. [REFERENCE.md](REFERENCE.md) — See real examples (Extension Consolidation spec)
3. [templates/SPEC_TEMPLATE.md](templates/SPEC_TEMPLATE.md) — Copy this to start

**Quick checklist:**
- [SPECS_WORKFLOW.md#checklist-spec-review](SPECS_WORKFLOW.md#checklist-spec-review)

### For Writing Plans

**Best resources:**
1. [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md#implementation-plan-template) — Plan template + best practices
2. [REFERENCE.md](REFERENCE.md) — See real examples (Extension Consolidation plan)
3. [templates/PLAN_TEMPLATE.md](templates/PLAN_TEMPLATE.md) — Copy this to start

**Quick checklist:**
- [SPECS_WORKFLOW.md#checklist-implementation-plan-review](SPECS_WORKFLOW.md#checklist-implementation-plan-review)

### For Code Review

**Best resources:**
1. [STATUS_GUIDE.md](STATUS_GUIDE.md) — Understand statuses & transitions
2. [SPECS_WORKFLOW.md#checklist-spec-review](SPECS_WORKFLOW.md#checklist-spec-review) — Spec review checklist
3. [REFERENCE.md](REFERENCE.md) — Good spec/plan examples

### For Understanding Statuses

**Best resource:**
- [STATUS_GUIDE.md](STATUS_GUIDE.md) — Complete status reference with flowcharts

### For Visual Learners

**Best resource:**
- [VISUAL_GUIDE.md](VISUAL_GUIDE.md) — Diagrams, flowcharts, cheat sheets

---

## 📚 Reference Documents

| Document | Purpose | Time | For Whom |
|----------|---------|------|----------|
| [README.md](README.md) | Overview & entry point | 5 min | Everyone |
| [QUICK_START.md](QUICK_START.md) | Copy-paste quickstart | 5 min | New users |
| [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md) | Complete workflow guide | 40 min | Writers, reviewers |
| [STATUS_GUIDE.md](STATUS_GUIDE.md) | Status definitions & transitions | 20 min | Anyone unsure about status |
| [REFERENCE.md](REFERENCE.md) | Real examples & patterns | 10 min | First-time writers |
| [VISUAL_GUIDE.md](VISUAL_GUIDE.md) | Diagrams & cheat sheets | 5-10 min | Visual learners |
| [INDEX.md](INDEX.md) | This file (navigation) | 5 min | Finding docs |

---

## 🗂️ File Structure

```
docs/superpowers/
│
├─ README.md ........................... Main entry point ⭐
├─ QUICK_START.md ....................... 5-minute guide ⭐
├─ SPECS_WORKFLOW.md ................... Complete reference (40 min)
├─ STATUS_GUIDE.md ..................... Status definitions (20 min)
├─ REFERENCE.md ........................ Examples & patterns (10 min)
├─ VISUAL_GUIDE.md ..................... Diagrams & charts (5-10 min)
├─ INDEX.md ............................ This file (navigation)
│
├─ specs/
│  ├─ 2026-05-03-extension-consolidation-design.md [EXAMPLE]
│  └─ [future specs]
│
├─ plans/
│  ├─ 2026-05-03-extension-consolidation-implementation.md [EXAMPLE]
│  ├─ 2026-05-03-adopt-pi-lens-features.md [EXAMPLE]
│  └─ [future plans]
│
├─ archives/
│  └─ [specs move here after shipping]
│
└─ templates/
   ├─ SPEC_TEMPLATE.md ................. Copy to create new spec
   └─ PLAN_TEMPLATE.md ................. Copy to create new plan
```

---

## 🎯 Quick Navigation by Role

### 👤 I'm a Feature Owner/Designer
**Goal:** Propose a new feature via a spec

**Reading order:**
1. [README.md](README.md) (5 min)
2. [QUICK_START.md](QUICK_START.md) (5 min)
3. [REFERENCE.md](REFERENCE.md) → Extension Consolidation spec (5 min)
4. [templates/SPEC_TEMPLATE.md](templates/SPEC_TEMPLATE.md) → Start writing

**See also:**
- [SPECS_WORKFLOW.md#best-practices-writing-specs](SPECS_WORKFLOW.md#best-practices-writing-specs)
- [SPECS_WORKFLOW.md#checklist-spec-review](SPECS_WORKFLOW.md#checklist-spec-review)

---

### 👨‍💼 I'm a Tech Lead/Architect
**Goal:** Review and approve specs; oversee implementation plans

**Reading order:**
1. [README.md](README.md) (5 min)
2. [STATUS_GUIDE.md](STATUS_GUIDE.md) (20 min)
3. [SPECS_WORKFLOW.md#checklist-spec-review](SPECS_WORKFLOW.md#checklist-spec-review) (5 min)
4. [REFERENCE.md](REFERENCE.md) → Extension Consolidation (10 min)

**See also:**
- [SPECS_WORKFLOW.md#best-practices-writing-plans](SPECS_WORKFLOW.md#best-practices-writing-plans)
- [STATUS_GUIDE.md#scenario-1-spec-feedback-requires-major-changes](STATUS_GUIDE.md#scenario-1-spec-feedback-requires-major-changes)

---

### 🛠️ I'm an Engineer
**Goal:** Implement approved specs and track progress in plans

**Reading order:**
1. [README.md](README.md) (5 min)
2. [QUICK_START.md](QUICK_START.md) (5 min)
3. [STATUS_GUIDE.md](STATUS_GUIDE.md) (20 min)

**See also:**
- [SPECS_WORKFLOW.md#step-3-implement-phase-3](SPECS_WORKFLOW.md#step-3-implement-phase-3)
- [STATUS_GUIDE.md#scenario-2-we-discover-the-spec-is-incomplete-during-implementation](STATUS_GUIDE.md#scenario-2-we-discover-the-spec-is-incomplete-during-implementation)

---

### 👀 I'm a Code Reviewer
**Goal:** Verify code matches spec and acceptance criteria

**Reading order:**
1. [STATUS_GUIDE.md](STATUS_GUIDE.md) (20 min)
2. [SPECS_WORKFLOW.md#checklist-spec-review](SPECS_WORKFLOW.md#checklist-spec-review) (5 min)
3. [REFERENCE.md](REFERENCE.md) → Extension Consolidation (10 min)

**See also:**
- [SPECS_WORKFLOW.md#code-review](SPECS_WORKFLOW.md#code-review)

---

### 🎓 I'm New to This Workflow
**Goal:** Learn the entire system from scratch

**Reading order:**
1. [README.md](README.md) (5 min)
2. [QUICK_START.md](QUICK_START.md) (5 min)
3. [REFERENCE.md](REFERENCE.md) (10 min) — look at Extension Consolidation example
4. [STATUS_GUIDE.md](STATUS_GUIDE.md) (20 min)
5. [SPECS_WORKFLOW.md](SPECS_WORKFLOW.md) (40 min) — full reference

**Hands-on practice:**
1. Copy [templates/SPEC_TEMPLATE.md](templates/SPEC_TEMPLATE.md)
2. Write a small spec (even if not used)
3. Ask for feedback in #engineering

---

## 🔍 Find Information By Topic

### Workflow & Phases

- Full workflow diagram: [SPECS_WORKFLOW.md#workflow-phases](SPECS_WORKFLOW.md#workflow-phases)
- Visual workflow: [VISUAL_GUIDE.md#the-five-phases](VISUAL_GUIDE.md#the-five-phases)
- Spec phase details: [SPECS_WORKFLOW.md#step-1-draft-the-spec-phase-0-1](SPECS_WORKFLOW.md#step-1-draft-the-spec-phase-0-1)
- Plan phase details: [SPECS_WORKFLOW.md#step-2-write-implementation-plan-phase-2](SPECS_WORKFLOW.md#step-2-write-implementation-plan-phase-2)

### Statuses

- Spec statuses: [STATUS_GUIDE.md#spec-statuses](STATUS_GUIDE.md#spec-statuses)
- Plan statuses: [STATUS_GUIDE.md#plan-statuses](STATUS_GUIDE.md#plan-statuses)
- Status flowcharts: [STATUS_GUIDE.md#status-transition-flowchart](STATUS_GUIDE.md#status-transition-flowchart)
- Status transitions: [VISUAL_GUIDE.md#status-transitions-for-specs](VISUAL_GUIDE.md#status-transitions-for-specs)

### Templates & Examples

- Spec template: [SPECS_WORKFLOW.md#spec-document-template](SPECS_WORKFLOW.md#spec-document-template) or [templates/SPEC_TEMPLATE.md](templates/SPEC_TEMPLATE.md)
- Plan template: [SPECS_WORKFLOW.md#implementation-plan-template](SPECS_WORKFLOW.md#implementation-plan-template) or [templates/PLAN_TEMPLATE.md](templates/PLAN_TEMPLATE.md)
- Real spec example: [REFERENCE.md#extension-consolidation](REFERENCE.md#extension-consolidation)
- Real plan example: [REFERENCE.md#extension-consolidation-1](REFERENCE.md#extension-consolidation-1)

### Best Practices

- Writing specs: [SPECS_WORKFLOW.md#best-practices](SPECS_WORKFLOW.md#best-practices)
- Writing plans: [SPECS_WORKFLOW.md#best-practices-writing-plans](SPECS_WORKFLOW.md#best-practices-writing-plans)
- Code review: [SPECS_WORKFLOW.md#code-review](SPECS_WORKFLOW.md#code-review)

### Review Checklists

- Spec review: [SPECS_WORKFLOW.md#checklist-spec-review](SPECS_WORKFLOW.md#checklist-spec-review)
- Plan review: [SPECS_WORKFLOW.md#checklist-implementation-plan-review](SPECS_WORKFLOW.md#checklist-implementation-plan-review)
- One-page cheat sheet: [VISUAL_GUIDE.md#one-page-cheat-sheet](VISUAL_GUIDE.md#one-page-cheat-sheet)

### Common Scenarios

- Spec feedback requires major changes: [STATUS_GUIDE.md#scenario-1-spec-feedback-requires-major-changes](STATUS_GUIDE.md#scenario-1-spec-feedback-requires-major-changes)
- Spec incomplete during implementation: [STATUS_GUIDE.md#scenario-2-we-discover-the-spec-is-incomplete-during-implementation](STATUS_GUIDE.md#scenario-2-we-discover-the-spec-is-incomplete-during-implementation)
- External dependency blocks work: [STATUS_GUIDE.md#scenario-3-an-external-dependency-blocks-us](STATUS_GUIDE.md#scenario-3-an-external-dependency-blocks-us)
- Shipping & archiving: [STATUS_GUIDE.md#scenario-4-weve-shipped-and-need-to-archive](STATUS_GUIDE.md#scenario-4-weve-shipped-and-need-to-archive)

### Visuals & Diagrams

- 5 phases diagram: [VISUAL_GUIDE.md#the-five-phases](VISUAL_GUIDE.md#the-five-phases)
- Spec status flowchart: [VISUAL_GUIDE.md#status-transitions-for-specs](VISUAL_GUIDE.md#status-transitions-for-specs)
- Plan status flowchart: [VISUAL_GUIDE.md#status-transitions-for-plans](VISUAL_GUIDE.md#status-transitions-for-plans)
- File organization: [VISUAL_GUIDE.md#file-organization](VISUAL_GUIDE.md#file-organization)
- Decision tree: [VISUAL_GUIDE.md#decision-tree-do-i-need-a-spec](VISUAL_GUIDE.md#decision-tree-do-i-need-a-spec)
- Red flags: [VISUAL_GUIDE.md#red-flags](VISUAL_GUIDE.md#red-flags)

### Q&A

- General FAQ: [SPECS_WORKFLOW.md#qa](SPECS_WORKFLOW.md#qa)
- More FAQ: [REFERENCE.md#qa](REFERENCE.md#qa)

---

## 📝 How to Use This Index

**If you know what you're looking for:**
- Use the "Find Information By Topic" section above
- Click the link to jump to the relevant section

**If you're not sure where to start:**
- Find your role in "Quick Navigation by Role"
- Follow the suggested reading order

**If you want to deep-dive:**
- Start with [README.md](README.md)
- Then pick a guide based on your role
- Use "Find Information By Topic" for specific details

---

## 💾 Total Documentation

- **Core guides:** 6 documents (73 KB)
- **Templates:** 2 documents (6 KB)
- **Total:** ~2,200 lines of documentation
- **Entry points:** README.md, QUICK_START.md, REFERENCE.md
- **Depth levels:** 5 min (QUICK_START) → 40 min (SPECS_WORKFLOW) → deep dive (each topic)

---

## 🔗 Cross-Reference

### README.md references:

- Links to QUICK_START, STATUS_GUIDE, REFERENCE, SPECS_WORKFLOW
- Provides context for all other docs
- Good starting point for everyone

### QUICK_START.md references:

- Links to templates and SPECS_WORKFLOW
- Provides commands to get moving
- Points to detailed guides

### SPECS_WORKFLOW.md references:

- Complete reference
- Links to templates, examples, checklists
- Central hub for detailed information

### STATUS_GUIDE.md references:

- Standalone reference for status definitions
- Used by SPECS_WORKFLOW and REFERENCE
- Includes flowcharts and scenarios

### REFERENCE.md references:

- Points to actual examples (Extension Consolidation)
- Links to templates
- References SPECS_WORKFLOW for deeper info

### VISUAL_GUIDE.md references:

- Companion to SPECS_WORKFLOW
- Diagrams, flowcharts, cheat sheets
- Standalone quick reference

---

## 🆘 Help & Support

**Can't find what you're looking for?**

1. Check "Find Information By Topic" (above)
2. Use Ctrl+F to search within a document
3. Ask in #engineering channel

**Found an issue or gap in the docs?**

- Update this INDEX.md
- Improve the relevant guide
- Add an example or clarification
- Share improvements with the team

---

## 📋 Document Summary Table

| Doc | Size | Type | Time | Audience | Best For |
|-----|------|------|------|----------|----------|
| README.md | 14K | Guide | 5 min | Everyone | Overview & entry point |
| QUICK_START.md | 3.3K | Guide | 5 min | Starters | Copy-paste commands |
| SPECS_WORKFLOW.md | 13K | Reference | 40 min | Writers/reviewers | Complete workflow details |
| STATUS_GUIDE.md | 10K | Reference | 20 min | Anyone | Status definitions & flowcharts |
| REFERENCE.md | 7.2K | Examples | 10 min | First-timers | Real examples & patterns |
| VISUAL_GUIDE.md | 16K | Diagrams | 5-10 min | Visual learners | Flowcharts & cheat sheets |
| SPEC_TEMPLATE.md | 3.6K | Template | N/A | Spec writers | Scaffold for new specs |
| PLAN_TEMPLATE.md | 2.3K | Template | N/A | Plan writers | Scaffold for new plans |

---

Last updated: 2026-05-03

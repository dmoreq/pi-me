# π-me Documentation Index

**Version:** v0.5.0  
**Last Updated:** 2025-06-XX  
**Total Pages:** 20+ documents  
**Navigation Time:** 30 seconds to find what you need

---

## 🚀 Getting Started (5 min)

Start here for a quick introduction:

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[README.md](./README.md)** | Project overview, features, quick start | 5 min |
| **[QUICKSTART.md](./QUICKSTART.md)** | Install & run your first command | 3 min |
| **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System design, umbrella structure | 10 min |

---

## 📚 Core Concepts

Understanding the system:

### Extension System
- **[EXTENSIONS_TABLE.md](./EXTENSIONS_TABLE.md)** — All 37 extensions at a glance (quick reference)
- **[EXTENSION_REVIEW.md](./EXTENSION_REVIEW.md)** — Complete architecture review (comprehensive)

### Telemetry & Automation
- **[TELEMETRY.md](./docs/TELEMETRY.md)** — Agent automation triggers, badge system
- **[shared/telemetry-automation.ts](./shared/telemetry-automation.ts)** — Implementation reference

### Session Management
- **[session-lifecycle/context-intel/](./session-lifecycle/context-intel/)** — Context intelligence source code
- **[IMPLEMENTATION_PLAN_CLEANUP.md](./IMPLEMENTATION_PLAN_CLEANUP.md)** — v0.3.0 architecture decisions

---

## 🔧 Migration & Cleanup

Released versions & upgrade paths:

| Document | For | Timeline |
|----------|-----|----------|
| **[MIGRATION_GUIDE_v0.4.0.md](./MIGRATION_GUIDE_v0.4.0.md)** | Upgrading to v0.4.0 | Now |
| **[CHANGELOG.md](./CHANGELOG.md)** | What changed in each version | History |
| **[AUDIT_SUMMARY.md](./AUDIT_SUMMARY.md)** | What issues we fixed | Context |
| **[CLEANUP_PLAN.md](./CLEANUP_PLAN.md)** | 3-phase cleanup strategy | Reference |
| **[DECISION_MATRIX.md](./DECISION_MATRIX.md)** | Decisions & rationale | Reference |

---

## 📖 Complete Extension Reference

All 37 extensions documented by category:

### Foundation Layer (Always On)
- **Secrets** — Credential obfuscation
- **Permission** — 5-tier command safety
- **Safe Ops** — Safe command replacements
- **Context Window** — Token usage monitoring

→ **[EXTENSION_REVIEW.md § Foundation Layer](./EXTENSION_REVIEW.md#-foundation-layer)**

### Session Lifecycle (dev/full profiles)
- **Context Intel** — Handoff, recap, auto-compact
- **Git Checkpoint** — Save/restore working tree
- **Context Pruning** — Remove duplicates
- **Usage Extension** — Token tracking
- **Welcome Overlay** — Session tips
- **Session Name** — Auto-naming
- **Skill Args** — $1/$2 substitution

→ **[EXTENSION_REVIEW.md § Session Lifecycle](./EXTENSION_REVIEW.md#-session-lifecycle)**

### Core Tools (dev/full profiles)
- **Task Orchestration** — Multi-step dependency execution
- **Planning** — DAG-based plans
- **Memory** — Persistent facts & lessons
- **Formatter** — Auto-format on write
- **Code Quality** — Format→Fix→Analyze pipeline
- **File Intelligence** — Index imports/exports
- **Subprocess Orchestrator** — Plan→Task bridge
- **And 9 more...**

→ **[EXTENSION_REVIEW.md § Core Tools](./EXTENSION_REVIEW.md#-core-tools)**

### Content Tools (full profile only)
- **Web Tools** — Search & fetch
- **GitHub** — API access
- **File Picker** — TUI file selector
- **Repeat** — Command replay

→ **[EXTENSION_REVIEW.md § Content Tools](./EXTENSION_REVIEW.md#-content-tools)**

### Authoring Tools (dev/full profiles)
- **Commit Helper** — Generate commit messages
- **Skill Bootstrap** — Auto-generate SKILL.md

→ **[EXTENSION_REVIEW.md § Authoring Tools](./EXTENSION_REVIEW.md#-authoring-tools)**

---

## 🎯 Quick Lookups

### "How do I use X?"

| Feature | Documentation |
|---------|----------------|
| Add a new extension | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Extension Development |
| Create a skill | [Skill Bootstrap](./core-tools/skill-bootstrap/skill-bootstrap.ts) |
| Debug a command | [README.md § Troubleshooting](./README.md#troubleshooting) |
| View all telemetry triggers | [EXTENSION_REVIEW.md § Context Intel](./EXTENSION_REVIEW.md#context-intelligence) |
| Configure permissions | [EXTENSION_REVIEW.md § Permission](./EXTENSION_REVIEW.md#permission-system) |
| Use handoff/recap | [MIGRATION_GUIDE_v0.4.0.md](./MIGRATION_GUIDE_v0.4.0.md) |

### "What changed?"

| Version | What's New | Read Here |
|---------|-----------|-----------|
| v0.4.0 | Production-grade cleanup | [MIGRATION_GUIDE_v0.4.0.md](./MIGRATION_GUIDE_v0.4.0.md) |
| v0.3.1 | Soft deprecation | [CHANGELOG.md § 0.3.1](./CHANGELOG.md#031---soft-deprecation) |
| v0.3.0 | Major merge & refactor | [CHANGELOG.md § 0.3.0](./CHANGELOG.md#030---2025-05-03) |

---

## 📊 Analysis & Planning

Technical deep-dives and planning docs:

### Audits & Analysis
- **[AUDIT_INDEX.md](./AUDIT_INDEX.md)** — Audit navigation hub
- **[AUDIT_SUMMARY.md](./AUDIT_SUMMARY.md)** — Issues found & impact
- **[EXTENSION_REVIEW.md](./EXTENSION_REVIEW.md)** — All extensions detailed

### Performance & Quality
- **[PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)** — v0.5.0 optimization opportunities
- **[COVERAGE_AUDIT.md](./COVERAGE_AUDIT.md)** — Test coverage analysis & plan to 95%+

### Planning Documents
- **[IMPLEMENTATION_PLAN_CLEANUP.md](./IMPLEMENTATION_PLAN_CLEANUP.md)** — Full 3-release plan
- **[CLEANUP_PLAN.md](./CLEANUP_PLAN.md)** — Original cleanup strategy
- **[DECISION_MATRIX.md](./DECISION_MATRIX.md)** — Key decisions & rationale

---

## 🏗️ Architecture & Design

Understanding how π-me works:

### System Design
```
┌─ foundation/
│  └─ Always: secrets, permission, safe-ops, context-window
├─ session-lifecycle/
│  └─ dev/full: context-intel, checkpoint, pruning, usage, etc.
├─ core-tools/
│  ├─ Subset A (dev/full): orchestration, planning, memory, etc.
│  └─ Subset B (full only): subagent, ralph-loop, etc.
├─ content-tools/
│  └─ full only: web-tools, github, repeat, file-picker
└─ authoring/
   └─ dev/full: commit-helper, skill-bootstrap
```

→ **[EXTENSION_REVIEW.md § Architecture Highlights](./EXTENSION_REVIEW.md#-architecture-highlights)**

### Key Classes & Interfaces
- **ExtensionLifecycle** — Base class for all extensions
- **TranscriptBuilder** — Extract conversation transcripts
- **PromptBuilder** — Construct prompts for context management
- **CodeQualityPipeline** — Format → Fix → Analyze
- **FileStore** — JSON-based file indexing

→ **[EXTENSION_REVIEW.md § Design Patterns](./EXTENSION_REVIEW.md#-design-patterns)**

---

## 💻 Implementation & API

For developers building on π-me:

### Creating an Extension
```typescript
import { ExtensionLifecycle } from '../shared/lifecycle';

export class MyExtension extends ExtensionLifecycle {
  readonly name = 'my-ext';
  readonly version = '0.1.0';
  
  async onSessionStart(event, ctx) {
    // Your code here
  }
}

export default (pi) => new MyExtension(pi).register();
```

→ **[shared/lifecycle.ts](./shared/lifecycle.ts)** — Full documentation

### Key APIs
- **Telemetry:** `getTelemetry().register()`, `.heartbeat()`, `.notify()`
- **Context:** `ctx.getContextUsage()`, `.cwd`, `.getSession()`
- **Pi Agent:** `pi.on()`, `.command()`, `.tool()`

→ **[EXTENSION_REVIEW.md § Implementation Examples](./EXTENSION_REVIEW.md#-implementation-examples)**

---

## 📋 Checklists & Guides

Step-by-step procedures:

### Release Checklist
- Update CHANGELOG.md
- Run tests: `npm test`
- Update version in package.json
- Create git tag: `git tag vX.Y.Z`
- Build release notes

→ **[DECISION_MATRIX.md § Execution Checklist](./DECISION_MATRIX.md#execution-checklist)**

### Code Review Checklist
- [ ] Tests pass (`npm test`)
- [ ] TypeScript clean (`npm run typecheck`)
- [ ] No console logs (use telemetry instead)
- [ ] Extends ExtensionLifecycle (if extension)
- [ ] Registered in umbrella entry point
- [ ] Telemetry registration included

→ **[EXTENSION_REVIEW.md § Quality Checklist](./EXTENSION_REVIEW.md#-quality-checklist)**

---

## 🔍 Searching Across Docs

### By Topic
- **Telemetry:** EXTENSION_REVIEW.md, IMPLEMENTATION_PLAN_CLEANUP.md
- **Architecture:** ARCHITECTURE.md, EXTENSION_REVIEW.md, EXTENSIONS_TABLE.md
- **Migration:** MIGRATION_GUIDE_v0.4.0.md, CHANGELOG.md
- **Performance:** PERFORMANCE_OPTIMIZATION.md, COVERAGE_AUDIT.md

### By Extension
Use `Ctrl+F` in any of these:
- **EXTENSIONS_TABLE.md** — Quick lookup by name
- **EXTENSION_REVIEW.md** — Detailed architecture for each
- **README.md** — Featured extensions with examples

---

## 📞 Still Looking?

### Common Questions

| Question | Answer |
|----------|--------|
| Where's the source code for X? | Check EXTENSION_REVIEW.md, find module path |
| How do I run tests? | `npm test` — uses Node.js built-in test runner |
| How do I measure coverage? | `npm run test:coverage` (requires c8) |
| How do I add a new command? | Extend extension, call `pi.command()` |
| How do I report an issue? | Include: error message, steps, π-me version |
| How do I contribute? | Follow code review checklist above |

### File Organization
```
├── foundation/          ← Safety guards (always on)
├── session-lifecycle/   ← Session management
├── core-tools/          ← Agent capabilities
├── content-tools/       ← Content utilities
├── authoring/           ← AI assistance
├── shared/              ← Utilities & base classes
├── package.json         ← Dependencies & scripts
├── CHANGELOG.md         ← Release history
├── README.md            ← Project overview
└── [8 docs]/            ← This documentation
```

---

## 🎓 Learning Path

### For New Developers
1. **5 min:** [README.md](./README.md)
2. **5 min:** [QUICKSTART.md](./QUICKSTART.md)
3. **10 min:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. **Pick an extension** from EXTENSION_REVIEW.md
5. **Read its source code** in the specified directory
6. **Try extending it** — best way to learn

### For Maintainers
1. **[CHANGELOG.md](./CHANGELOG.md)** — Know what changed
2. **[EXTENSION_REVIEW.md](./EXTENSION_REVIEW.md)** — Understand architecture
3. **[DECISION_MATRIX.md](./DECISION_MATRIX.md)** — Understand decisions
4. **[PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)** — Optimization opportunities

### For Release Engineers
1. **[MIGRATION_GUIDE_v0.4.0.md](./MIGRATION_GUIDE_v0.4.0.md)** — Breaking changes
2. **[CHANGELOG.md](./CHANGELOG.md)** — Release notes
3. **[COVERAGE_AUDIT.md](./COVERAGE_AUDIT.md)** — Quality metrics

---

## 📈 Documentation Statistics

```
Total Documents:    20+
Total Content:      17K lines (markdown)
Total Size:         2.4 MB
Categories:         6 (Getting Started, Concepts, Migration, Reference, Analysis, Implementation)
Coverage:           All 37 extensions documented
Update Frequency:   With each release
```

---

## ✨ Navigation Tips

- **Ctrl+F** → Search within any document
- **Ctrl+Click** → Open links in new tab (on most platforms)
- **# Headings** → Each document has outline via headings
- **Breadcrumbs** → Jump to related docs via links

---

**Last Updated:** 2025-06-XX (v0.5.0)  
**Status:** Complete & Current  
**Feedback:** Issues? Questions? Check EXTENSION_REVIEW.md for contact info

---

**Table of Contents (All Documents)**

Quick Links to Every Document:
- [README.md](./README.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [MIGRATION_GUIDE_v0.4.0.md](./MIGRATION_GUIDE_v0.4.0.md)
- [EXTENSIONS_TABLE.md](./EXTENSIONS_TABLE.md)
- [EXTENSION_REVIEW.md](./EXTENSION_REVIEW.md)
- [AUDIT_INDEX.md](./AUDIT_INDEX.md)
- [AUDIT_SUMMARY.md](./AUDIT_SUMMARY.md)
- [CLEANUP_PLAN.md](./CLEANUP_PLAN.md)
- [DECISION_MATRIX.md](./DECISION_MATRIX.md)
- [IMPLEMENTATION_PLAN_CLEANUP.md](./IMPLEMENTATION_PLAN_CLEANUP.md)
- [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)
- [COVERAGE_AUDIT.md](./COVERAGE_AUDIT.md)
- [DOCS_INDEX.md](./DOCS_INDEX.md) ← You are here

# π-me v0.5.0

**Production-Grade AI Assistant Extension Suite** — 22 unified extensions, 639+ tests, SOLID-refactored, telemetry-driven automation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-639%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](./CHANGELOG.md)

A comprehensive extension suite for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent). **Production-grade quality** with safety guards, session lifecycle management, context intelligence, code quality pipelines, persistent memory, and telemetry-driven automation.

**22 extensions • 4 umbrellas • 639+ tests • 0 failures • MIT licensed.**

---

## Architecture Overview

```
pi-me v0.5.0 — Extension Consolidation
========================================

foundation/              ← Always loaded
├── secrets/              Secret scanning (env vars, API keys)
├── permission/           ★ Merged: 3-layer guard (safety → tiers → safe-ops)
│   ├── permission.ts        /permission, /permission-mode
│   ├── permission-core.ts   Command classification engine
│   ├── safety-patterns.ts   Hard safety net patterns
│   ├── safe-ops-layer.ts    Git/gh/rm protection (← from safe-ops.ts)
│   └── path-guard.ts        Protected path matching
└── context-monitor/       ★ NEW: unified context + usage monitor
    ├── context-widget.ts     Real-time context usage bar
    ├── usage-dashboard.ts    /usage, /cost commands
    └── ...

session-lifecycle/       ← dev/full profiles
├── context-intel/        ★ Merged: intelligence + pruning + read-awareness
│   ├── index.ts             Handoff, auto-compact, session recap
│   ├── plugins/
│   │   ├── context-pruning  Dedup, superseded writes, error purging
│   │   └── read-awareness   Track reads, block unread edits
│   ├── transcript-builder
│   └── prompt-builder
├── welcome/              ★ Merged: welcome header + session name
├── git-checkpoint/        Git checkpoint snapshots
└── skill-args/            Skill argument parsing

core-tools/              ← dev/full profiles
├── code-quality/         ★ Merged: pipeline + formatter runners
├── memory/               ★ Merged: memory + project-context scanner
├── task-orchestration/    Task DAG execution
├── planning/              Interactive plan mode
├── subprocess-orchestrator/
├── file-intelligence/     File summarization/inspection
├── thinking-steps/        Structured reasoning
└── ...

content-tools/           ← full profile only
├── web-tools/             Web fetch/search
├── repeat/                Repeat/replay tools
└── github.ts              GitHub integration

authoring/               ← full profile only
└── commit-helper/         Commit message generation

shared/                  ← Infrastructure
├── lifecycle.ts           ExtensionLifecycle base class (SOLID)
├── telemetry-automation.ts  12 automation triggers
├── automation-manager.ts    ★ NEW: sense → decide → act → inform
├── command-builder.ts       ★ NEW: DRY command patterns
└── ...
```

---

## 🔥 What's New in v0.5.0

### Extension Consolidation (20+ → 22 extensions)

| Change | Before | After |
|--------|--------|-------|
| **Permission + Safe Ops merged** | 2 extensions | 1 unified 3-layer guard |
| **Context Window + Usage merged** | 2 extensions | 1 unified monitor |
| **Context Intel + Pruning merged** | 2 extensions | 1 extension with plugins |
| **Read Guard → Context Intel** | 1 standalone | 1 plugin |
| **Formatter → Code Quality** | 1 standalone | pipeline adapter |
| **Welcome + Session Name merged** | 2 extensions | 1 unified module |
| **Memory + Skill Bootstrap merged** | 2 extensions | auto-project-context scanner |
| **Code Actions & File Picker removed** | 2 extensions | eliminated |

### Telemetry-Driven Automation

Extensions now proactively **sense** conditions and **inform** the user:

- **Session staleness**: warns when >20 messages over 30+ minutes → suggests /handoff
- **Context pressure**: warns at 85%+ token usage → suggests compaction
- **Memory readiness**: hints when 5+ messages pending consolidation
- **Auto-compact**: automatic context compaction at threshold (configurable)

---

## Quick Start

```bash
npm install pi-me
```

Add to your pi configuration:

```json
{
  "pi": {
    "extensions": ["pi-me"]
  }
}
```

---

## Key Commands

| Command | Extension | Description |
|---------|-----------|-------------|
| `/permission` | permission | Set permission level |
| `/safegit` | permission | Toggle git protection |
| `/saferm` | permission | Toggle rm→trash |
| `/usage` | context-monitor | Usage statistics dashboard |
| `/cost` | context-monitor | Cost report |
| `/handoff` | context-intel | Transfer context to new session |
| `/recap` | context-intel | Session summary |
| `/welcome-toggle` | welcome | Toggle welcome header |
| `/trust-me` | context-intel | Skip read-before-edit |
| `/memory-consolidate` | memory | Manually trigger consolidation |
| `/plan` | planning | Interactive plan mode |
| `/formatter` | code-quality | Configure formatting |
| `/usage` | context-monitor | Show usage stats |

---

## Test Suite

```bash
npm test    # 639+ tests, all passing
```

## License

MIT

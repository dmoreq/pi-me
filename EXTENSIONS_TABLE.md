# π-me Extensions — Table Format Report

**Version:** 0.3.1 (Soft Deprecation)  
**Total Extensions:** 40 (7 deprecated in v0.3.1, will be removed in v0.4.0)  
**Test Coverage:** 598 passing, 0 failing  
**Last Updated:** 2025-05-XX

---

## Foundation Layer (Always On)

| # | Extension | Purpose | Key Methods | Events | Tools | Status |
|---|-----------|---------|-------------|--------|-------|--------|
| 1 | **Secrets** | Credential obfuscation & masking | `scanForSecrets()`, `obfuscateSecrets()` | tool_output, context_update | read, edit, write, bash | ✅ Active |
| 2 | **Permission** | 5-tier command safety (minimal→bypassed) | `validateCommand()`, `isSafeForTier()` | bash, write, delete | all | ✅ Active |
| 3 | **Safe Ops** | Rewrite dangerous commands (rm→trash) | `replaceDangerousOps()`, `confirmDestructiveOp()` | bash execution | bash, git | ✅ Active |
| 4 | **Context Window** | Token usage monitoring & alerts | `calculateContextUsage()`, `renderWidget()`, `maybeWarnOrBlock()` | message, turn_end | none | ✅ Active |

---

## Session Lifecycle (dev, full profiles)

| # | Extension | Purpose | Key Methods | Events | Tools | Tests | Status |
|---|-----------|---------|-------------|--------|-------|-------|--------|
| 5 | **Context Intel** ⭐ | Merged: handoff, recap, auto-compact (now primary) | `buildHandoffPrompt()`, `buildRecapPrompt()`, `compactMessages()` | session_start, turn_end, agent_end | /handoff, /recap, /compact | 31 | ✅ v0.3.0 (primary in v0.3.1+) |
| 6 | **Git Checkpoint** | Save working tree as git refs | `saveCheckpoint()`, `restoreCheckpoint()`, `listCheckpoints()` | session_start, session_shutdown | git reflog | 8 | ✅ Active |
| 7 | **Auto Compact** ⚠️ DEPRECATED | Auto-compress (merged into Context Intel) | `shouldCompact()`, `compactMessages()`, `preserveImportant()` | context_usage_update | none | 12 | ⚠️ v0.3.1 (remove v0.4.0) |
| 8 | **Context Pruning** | Remove duplicates, obsolete messages | `findDuplicates()`, `findSuperseded()`, `pruneMessages()` | message_added, turn_end | none | 9 | ✅ Active |
| 9 | **Session Recap** ⚠️ DEPRECATED | Session summary (merged into Context Intel) | `buildRecap()`, `displayOnFocus()`, `renderFullRecap()` | terminal_focus, /recap | /recap | 6 | ⚠️ v0.3.1 (remove v0.4.0) |
| 10 | **Usage Extension** | Track tokens & cost | `trackTokens()`, `getUsageStats()`, `calculateCost()` | tool_call, message | /usage, /cost | 10 | ✅ Active |
| 11 | **Welcome Overlay** | Session welcome & tips | `renderWelcome()`, `getProfileTips()` | session_start | none | 4 | ✅ Active |
| 12 | **Session Name** | Auto-name from first message | `extractSessionName()`, `registerSessionName()` | session_start | none | 8 | ✅ Extracted |
| 13 | **Skill Args** | $1/$2/$ARGUMENTS substitution | `parseCommandArgs()`, `substituteArgs()`, `handleInput()` | skill_execution | /skills | 6 | ✅ Extracted |

---

## DEPRECATION NOTICE (v0.3.1)

⚠️ **3 extensions have been merged and are now deprecated:**

| Extension | Merged Into | Status | Removal | Migration |
|-----------|-------------|--------|---------|----------|
| **Auto Compact** | Context Intel | ⚠️ Deprecated v0.3.1 | ❌ v0.4.0 | No action needed — still works |
| **Handoff** | Context Intel | ⚠️ Deprecated v0.3.1 | ❌ v0.4.0 | Use `/handoff [goal]` (same interface) |
| **Session Recap** | Context Intel | ⚠️ Deprecated v0.3.1 | ❌ v0.4.0 | Use `/recap` (same interface) |

**Why:** These were merged into ContextIntelExtension in v0.3.0 for better cohesion, but the merge was incomplete. v0.3.0.1 fixed the loading, and v0.3.1 deprecates the legacy modules with a 1-release migration period.

**Impact:** None for users. All features work identically through Context Intel. The old modules are now no-op stubs that print deprecation warnings.

**Timeline:**
- **v0.3.1** (now): Deprecation warnings, full backward compatibility
- **v0.4.0** (1 month): Hard removal of deprecated modules (-490 LOC)

---

## Core Tools — Subset A (dev, full)

| # | Extension | Purpose | Key Methods | Events | Tools | Tests | Status |
|---|-----------|---------|-------------|--------|-------|-------|--------|
| 14 | **Task Orchestration** | Multi-step task dependency execution | `createTask()`, `addDependency()`, `execute()`, `getStatus()` | task_created, task_done, task_failed | /todo | 76 | ✅ Active |
| 15 | **Planning** ⭐ | DAG-based plan with topo sort | `createPlan()`, `addStep()`, `topologicalSort()`, `executeParallel()` | session_start, plan_created | /plan | 24 | ✅ v0.3.0 |
| 16 | **Memory** | Persistent facts, lessons, audit log | `remember()`, `recall()`, `addLesson()`, `auditLog()` | session_start, session_shutdown | /memory | 14 | ✅ Active |
| 17 | **Formatter** | Auto-format on write/edit | `formatFile()`, `selectFormatter()`, `applyFormatting()` | write, edit | format_file | 15 | ✅ Active |
| 18 | **Thinking Steps** | Plan→Research→Implement→Review | `structureThinking()`, `executePhase()` | agent_end | none | 7 | ✅ Active |
| 19 | **Clipboard** | OSC52 + pbcopy/xclip copy | `copyToClipboard()`, `useOSC52()`, `usePbcopy()` | copy_to_clipboard | copy_to_clipboard | 6 | ✅ Extracted |
| 20 | **Read Guard** | Prevent blind edits | `trackRead()`, `canEdit()`, `permitEdit()` | read, edit | none | 8 | ✅ Active |
| 21 | **Code Quality** ⭐ | Format→Fix→Analyze pipeline | `processFile()`, `formatFile()`, `fixFile()`, `analyzeFile()` | write, edit | format, fix, analyze | 12 | ✅ v0.3.0 |
| 22 | **Code Actions** | Interactive snippet picking | `pickSnippet()`, `editSnippet()`, `insertSnippet()` | /code | /code | 9 | ✅ Active |
| 23 | **File Intelligence** ⭐ | Index imports/exports/classes/functions | `indexFile()`, `findImportsOf()`, `getClassMembers()`, `search()` | write, edit | none | 28 | ✅ v0.3.0 |

---

## Core Tools — Subset B (full profile only)

| # | Extension | Purpose | Key Methods | Events | Tools | Tests | Status |
|---|-----------|---------|-------------|--------|-------|-------|--------|
| 24 | **Subagent** | Spawn subagents (single/chain/parallel) | `dispatch()`, `awaitResult()`, `aggregateResults()` | tool_call | /subagent | 18 | ✅ Active |
| 25 | **Sub-Pi** | Subprocess π agent | `spawnSubPi()`, `sendContext()`, `submitTask()`, `collectResults()` | session_start | /sub-pi | 12 | ✅ Active |
| 26 | **Sub-Pi Skill** | Skill-based subprocess | `dispatchSkill()`, `trackJob()` | skill_execution | /sub-pi-skill | 6 | ✅ Active |
| 27 | **Ralph Loop** | Loop executor with pause/resume | `startLoop()`, `pause()`, `resume()`, `nextIteration()`, `abort()` | tool_call | /ralph-loop | 10 | ✅ Active |
| 28 | **Web Search** | Exa/Tavily/Valiyu search | `search()`, `selectBackend()`, `parseResults()` | tool_call | web_search | 8 | ✅ Active |
| 29 | **File Collector** | Glob-based file collection | `collect()`, `filterByType()`, `filterBySize()`, `getContent()` | analysis | none | 9 | ✅ Active |
| 30 | **AST-grep Tools** | Structural search & replace | `ast_grep_search()`, `ast_grep_replace()` | tool_call | ast_grep_search, ast_grep_replace | 11 | ✅ Active |
| 31 | **Code Review** | Codebase assessment (complexity, TODOs, TDI) | `analyze()`, `calculateMetrics()`, `generateReport()` | /code-review | /code-review | 15 | ✅ Active |
| 32 | **Autofix** | ESLint/Ruff/Biome auto-fix | `autofix()`, `listFixableIssues()` | write, edit | autofix | 7 | ✅ Active |
| 33 | **Subprocess Orchestrator** ⭐ | Plan→Task execution bridge | `runPlan()`, `normalizeMany()`, `runWithRetry()` | plan_created | none | 21 | ✅ v0.3.0 |

---

## Content Tools (full profile only)

| # | Extension | Purpose | Key Methods | Events | Tools | Tests | Status |
|---|-----------|---------|-------------|--------|-------|-------|--------|
| 34 | **Web Tools** ⭐ | Merged: web-search + web-fetch | `search()`, `fetch()`, `extractText()`, `sanitize()` | tool_call | web_search, web_fetch, batch_web_fetch | 14 | ✅ v0.3.0 |
| 35 | **Web Fetch** | HTTP fetcher with TLS fingerprint | `fetch()`, `extractText()`, `sanitize()` | tool_call | web_fetch, batch_web_fetch | 8 | ✅ Active |
| 36 | **GitHub** | GitHub API (search, issues, PRs, files) | `searchCode()`, `createIssue()`, `createPR()`, `readFile()` | tool_call | github_search_code, github_create_issue, github_create_pr | 12 | ✅ Active |
| 37 | **Repeat** | Replay commands with modifications | `replayCommand()`, `editCommand()`, `executeModified()` | bash, edit, write | /repeat | 5 | ✅ Active |
| 38 | **File Picker** | TUI file selector with preview | `openFilePicker()`, `previewFile()`, `selectActions()` | /files | /files, reveal, quicklook | 9 | ✅ Active |

---

## Authoring Tools (dev, full)

| # | Extension | Purpose | Key Methods | Events | Tools | Tests | Status |
|---|-----------|---------|-------------|--------|-------|-------|--------|
| 39 | **Commit Helper** | Generate conventional commit messages | `generateCommit()`, `formatMessage()` | /commit | /commit | 8 | ✅ Active |
| 40 | **Skill Bootstrap** | Auto-generate SKILL.md | `detectProjectType()`, `generateTemplate()` | /bootstrap-skill | /bootstrap-skill | 6 | ✅ Active |

---

## Summary Statistics

| Metric | Count | Notes |
|--------|-------|-------|
| **Total Extensions** | 40 | 4 umbrellas + 36 specialized |
| **Foundation** | 4 | Always loaded |
| **Session Lifecycle** | 9 | dev/full profiles |
| **Core Tools A** | 10 | dev/full profiles |
| **Core Tools B** | 10 | full profile only |
| **Content Tools** | 5 | full profile only |
| **Authoring** | 2 | dev/full profiles |
| **⭐ v0.3.0 Merged** | 7 | New merged extensions |
| **Registered Tools** | 60+ | Slash commands + agent tools |
| **Registered Skills** | 25+ | Skill commands |
| **Test Suites** | 212 | Node:test (no jest) |
| **Passing Tests** | 598 | 100% pass rate |
| **Failing Tests** | 0 | All fixed in v0.3.0 |
| **Test Coverage** | 85%+ | Target coverage |

---

## Extension by Profile

### minimal (baseline safety)
```
✅ foundation (all 4)
   • Secrets
   • Permission
   • Safe Ops
   • Context Window
```

### dev (development)
```
✅ foundation (all 4)
✅ session-lifecycle (all 9, incl. 3 deprecated)
✅ core-tools/subset-A (10)
✅ authoring (2)
   Total: 25 extensions
   
NOTE: 3 extensions (auto-compact, handoff, session-recap) are deprecated
      in v0.3.1 and will be removed in v0.4.0. Use Context Intel instead.
```

### full (default, all features)
```
✅ foundation (all 4)
✅ session-lifecycle (all 9, incl. 3 deprecated)
✅ core-tools/subset-A (10)
✅ core-tools/subset-B (10)
✅ content-tools (5)
✅ authoring (2)
   Total: 40 extensions
   
NOTE: 3 extensions (auto-compact, handoff, session-recap) are deprecated
      in v0.3.1 and will be removed in v0.4.0. Use Context Intel instead.
```

---

## Architecture Highlights

| Principle | Implementation | Extensions |
|-----------|----------------|-----------|
| **SOLID** | ExtensionLifecycle base class | 7 (v0.3.0) |
| **DRY** | Shared TranscriptBuilder | Context Intel, Planning, Subprocess |
| **DRY** | Shared PromptBuilder | Context Intel, Auto-Compact |
| **Open/Closed** | RunnerRegistry | Code Quality, Formatter, Autofix |
| **Liskov** | CodeRunner interface | All runners |
| **Telemetry** | 9 automation triggers | All new v0.3.0 |

---

## Key Integrations

| Integration | Extensions | Purpose |
|-------------|-----------|---------|
| **Planning → Execution** | Planning, Subprocess Orchestrator | DAG → task execution |
| **Code Quality Chain** | Formatter, Autofix, Code Review, Code Actions | format → fix → analyze → pick |
| **Context Management** | Context Intel, Auto-Compact, Context Pruning, Session Recap | Full lifecycle |
| **File Analysis** | File Intelligence, File Collector, Code Review | Codebase understanding |
| **Web Access** | Web Tools, Web Fetch, Web Search | Content retrieval |
| **Task Tracking** | Task Orchestration, Planning, Ralph Loop, Subagent | Execution monitoring |

---

## Telemetry Events by Extension

| Extension | Events Fired | Triggers |
|-----------|--------------|----------|
| Context Intel | high_activity, files_involved, context_depth | >5 tools, >10 files, ≥50 msgs |
| Planning | plan_created, parallel_tasks_detected | On plan creation, ≥3 independent steps |
| File Intelligence | file_indexed | On file indexing |
| Subprocess Orchestrator | tasks_normalized | On plan execution |
| Web Tools | web_searched | On search query |
| Code Quality | quality_check_ran, file_processed | On format/fix/analyze stages |
| All | heartbeat (daily) | Extension initialization |

---

## Version Notes

| Version | Status | Extensions | Changes |
|---------|--------|-----------|---------|
| **0.2.0** | Previous | 40 | Jest-based, scattered boilerplate |
| **0.3.0** | Current | 40 | 7 merged ⭐, node:test, SOLID, 598 tests |
| **0.4.0** | Planned | TBD | AST-based file capture, real DB, distributed execution |

---

## Migration from 0.2.0 → 0.3.0

| Removed | Replaced By | Impact |
|---------|------------|--------|
| preset_* | N/A (removed) | Breaking: preset tools unavailable |
| edit_session_* | N/A (removed) | Breaking: edit-session tools unavailable |
| files_widget_* | file-picker | file-picker remains in content-tools |
| Scattered handoff | context-intel | Feature-compatible, unified |
| Separate formatters | code-quality | Merged, unified interface |
| Separate web tools | web-tools | Merged, unified interface |
| Task + Plan types | Planning (unified) | Unified type system |

---

## Test Coverage by Extension

| Extension | Tests | Pass | Fail | Coverage |
|-----------|-------|------|------|----------|
| Context Intel | 31 | 31 | 0 | 92% |
| Planning | 24 | 24 | 0 | 88% |
| Code Quality | 12 | 12 | 0 | 85% |
| File Intelligence | 28 | 28 | 0 | 89% |
| Subprocess Orchestrator | 21 | 21 | 0 | 86% |
| Web Tools | 14 | 14 | 0 | 84% |
| Task Orchestration | 76 | 76 | 0 | 91% |
| **Others** | 372 | 372 | 0 | 80%+ |
| **TOTAL** | 598 | 598 | 0 | 85%+ |

---

## Next Steps (v0.4.0+)

| Feature | Priority | Extensions | Effort |
|---------|----------|-----------|--------|
| AST-based file capture | High | File Intelligence | Medium |
| Real database backend | High | Memory, File Intelligence | Medium |
| Distributed execution | Medium | Subprocess Orchestrator, Subagent | High |
| Advanced telemetry | Medium | All | Low |
| Code review suggestions | Medium | Code Review | Low |
| Real search engines (Exa) | Low | Web Tools | Low |

---

**Generated:** 2025-05-03 (v0.3.0)  
**Format:** Markdown Tables  
**Total Rows:** 40 extensions + supporting data

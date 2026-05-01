# rpiv-mono Adoption Plan

**Source:** [juicesharp/rpiv-mono](https://github.com/juicesharp/rpiv-mono)

Adopting 4 packages from the rpiv-mono monorepo into pi-me, replacing or
augmenting equivalent extensions.

| Package | Lines | Files | pi-me Current | Action |
|---------|-------|-------|--------------|--------|
| `rpiv-btw` | 603 | 3 | None | **New** — `/btw` side question |
| `rpiv-args` | 213 | 2 | None | **New** — `$1/$ARGUMENTS` for skills |
| `rpiv-ask-user-question` | 3,648 | 36 | `ask.ts` (50 lines) | **Replace** — structured questions |
| `rpiv-warp` | 450 | 4 | None | **New** — Warp OSC 777 notifications |

---

## 1. rpiv-btw → `/btw` Side Question

**What:** `/btw "should I use React or Vue?"` asks the primary model a one-off
question using cloned conversation context. Answer renders in an overlay —
never pollutes the main agent session.

**Why:** Currently there's no way to ask a quick side question without
contaminating context. Unique, zero-overlap feature.

**Files to copy:**
```
core-tools/btw/
  index.ts          (entry point)
  btw.ts            (core logic + /btw command)
  btw-ui.ts         (overlay renderer)
  prompts/
    btw-system.txt  (system prompt for side model)
```

**Commands:** `/btw <question>`

---

## 2. rpiv-args → Skill Argument Substitution

**What:** Intercepts `/skill:name arg1 arg2` and substitutes `$1`, `$2`,
`$ARGUMENTS`, `$@`, `${@:N:L}` in the skill body. Skills become parameterized
templates without any skill file changes.

**Why:** Skills currently have no argument support — every skill invocation gets
the full raw body. This enables reusable skills that adapt to user input.

**Files to copy:**
```
session-lifecycle/skill-args/
  index.ts          (entry point)
  args.ts           (tokeniser + substitutor)
```

---

## 3. rpiv-ask-user-question → Replace `ask.ts`

**What:** Structured multi-question UI with:
- Side-by-side markdown preview for code snippets, diagrams, mockups
- Multi-select checkboxes
- Free-text "Type something" fallback
- "Chat about this" escape hatch to abandon questionnaire

**Why:** pi-me's `ask.ts` only supports basic `text`/`confirm`/`choice` —
single question, text-only options. This replaces it with a full questionnaire
system. The agent gets `promptGuidelines` so it knows when and how to use it.

**Files to copy (36 files):**
```
core-tools/ask-user-question/       (entire package)
```

**Commands:** Tool `ask_user_question` (replaces old `ask` tool)

---

## 4. rpiv-warp → Warp Terminal Notifications

**What:** Emits Warp-specific OSC 777 structured escape sequences on pi
lifecycle events: `session_start`, `stop`, `idle_prompt`, `tool_complete`.
Auto-detects Warp environment — complete no-op outside Warp.

**Why:** Users running pi inside Warp terminal get native notifications in
their Warp session list (similar to Claude Code's Warp integration).

**Files to copy:**
```
session-lifecycle/warp-notify/
  index.ts          (entry point + lifecycle hooks)
  payload.ts        (structured payload builders)
  protocol.ts       (version negotiation + env detection)
  warp-notify.ts    (OSC 777 writer to /dev/tty)
```

---

## Implementation Order

1. **rpiv-btw** — simplest, most unique, highest immediate value
2. **rpiv-args** — tiny, unlocks skill parameterization
3. **rpiv-warp** — self-contained, niche but useful
4. **rpiv-ask-user-question** — complex (36 files), replaces existing tool

## Impact

| Metric | Before | After |
|--------|--------|-------|
| Extensions | 51 | 55 (+4) |
| New commands | — | `/btw` |
| New tools | — | `ask_user_question` (replaces `ask`) |
| New hooks | — | skill param substitution, Warp OSC 777 |

## Credits

All adopted from [@juicesharp/rpiv-mono](https://github.com/juicesharp/rpiv-mono)
under MIT license. Package authors preserved in file headers.

/**
 * thinking-steps — Simple three-mode thinking rendering for Pi's TUI.
 *
 * Uses only pi's public API (`setHiddenThinkingLabel`) — no monkey-patching.
 *
 * Modes:
 *   collapsed  — "Thinking (3 steps)..."
 *   summary    — bullet-list of detected step headlines
 *   expanded   — native Pi thinking renderer
 *
 * Controls: Alt+T to cycle, /thinking-steps <mode|project|global> to set.
 * Persistence: session entries (current session), JSON files (project/global).
 *
 * Lines: ~280 (vs. 2,784 in the original pi-thinking-steps).
 */
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────────

type ThinkingMode = "collapsed" | "summary" | "expanded";
type PrefScope = "project" | "global";

const CUSTOM_ENTRY_TYPE = "thinking-steps.mode";
const PREF_FILE = "thinking-steps.json";

// ─── Content extraction ─────────────────────────────────────────────────────

/** Accumulate thinking text from delta events. */
function appendDelta(current: string, delta: unknown): string {
  if (typeof delta === "string") return current + delta;
  return current;
}

// ─── Step detection ─────────────────────────────────────────────────────────

function detectSteps(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const steps: string[] = [];
  const markers = /^(\d+[.)]\s+|[-*+]\s+|(first|next|then|finally|now|step\s*\d+|let'?s|i(?:'ll|\s+will)|okay[,.]?)\s)/i;
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, "");
    if (markers.test(clean)) steps.push(summarize(clean.replace(markers, "")));
  }
  if (steps.length === 0 && lines.length <= 5) {
    for (const line of lines.slice(0, 4)) steps.push(summarize(line));
  } else if (steps.length === 0) {
    steps.push("Analyzing...");
  }
  return steps;
}

function summarize(text: string, maxLen = 80): string {
  const cleaned = text.replace(/^[*\-•▪▸►»›\s]+/, "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned || "Working...";
  return cleaned.slice(0, maxLen - 1).trimEnd() + "…";
}

// ─── Label building ─────────────────────────────────────────────────────────

function buildLabel(mode: ThinkingMode, text: string): string | undefined {
  if (mode === "expanded") return undefined;
  if (mode === "collapsed") {
    const steps = detectSteps(text);
    const n = steps.length;
    return n > 0 ? `Thinking (${n} step${n !== 1 ? "s" : ""})...` : "Thinking...";
  }
  const steps = detectSteps(text);
  return steps.length > 0 ? steps.map(s => `  • ${s}`).join("\n") : "Thinking...";
}

// ─── File persistence ───────────────────────────────────────────────────────

function prefPath(scope: PrefScope, cwd: string): string {
  if (scope === "global") {
    const home = process.env.HOME?.trim() || homedir();
    return join(home, ".pi", "agent", "state", PREF_FILE);
  }
  return join(cwd, ".pi", PREF_FILE);
}

async function readPref(scope: PrefScope, cwd: string): Promise<ThinkingMode | undefined> {
  try {
    const raw = await readFile(prefPath(scope, cwd), "utf-8");
    const parsed = JSON.parse(raw) as { mode?: string };
    if (parsed.mode === "collapsed" || parsed.mode === "summary" || parsed.mode === "expanded")
      return parsed.mode;
  } catch { /* no pref */ }
  return undefined;
}

async function writePref(scope: PrefScope, cwd: string, mode: ThinkingMode): Promise<void> {
  const p = prefPath(scope, cwd);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify({ mode }, null, 2) + "\n", "utf-8");
}

async function clearPref(scope: PrefScope, cwd: string): Promise<void> {
  await rm(prefPath(scope, cwd), { force: true });
}

// ─── Extension ──────────────────────────────────────────────────────────────

export default function thinkingSteps(pi: ExtensionAPI): void {
  let mode: ThinkingMode = "summary";
  let isThinking = false;
  let thinkingText = "";

  function setMode(ctx: ExtensionContext, m: ThinkingMode, persist = true): void {
    mode = m;
    if (persist) pi.appendEntry(CUSTOM_ENTRY_TYPE, { mode: m });
    ctx.ui.setHiddenThinkingLabel(buildLabel(m, thinkingText));
    ctx.ui.setStatus("thinking-steps",
      `${ctx.ui.theme.fg("muted", "thinking:")} ${ctx.ui.theme.fg("accent", m)}`);
  }

  function cycle(): ThinkingMode {
    if (mode === "collapsed") return "summary";
    if (mode === "summary") return "expanded";
    return "collapsed";
  }

  async function restoreMode(ctx: ExtensionContext): Promise<ThinkingMode> {
    const entries = ctx.sessionManager.getEntries() as Array<{
      type?: string; customType?: string; data?: { mode?: string };
    }>;
    const saved = entries
      .filter(e => e.type === "custom" && e.customType === CUSTOM_ENTRY_TYPE)
      .pop();
    if (saved?.data?.mode && ["collapsed","summary","expanded"].includes(saved.data.mode))
      return saved.data.mode as ThinkingMode;
    return (await readPref("project", ctx.cwd))
        ?? (await readPref("global", ctx.cwd))
        ?? "summary";
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    mode = await restoreMode(ctx);
    ctx.ui.setHiddenThinkingLabel(buildLabel(mode, ""));
    ctx.ui.setStatus("thinking-steps",
      `${ctx.ui.theme.fg("muted", "thinking:")} ${ctx.ui.theme.fg("accent", mode)}`);
  });

  pi.on("message_update", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const ev = event.assistantMessageEvent as {
      type: string; contentIndex?: number; textDelta?: string;
    };

    if (ev.type === "thinking_start") {
      isThinking = true;
      thinkingText = "";
      ctx.ui.setHiddenThinkingLabel(buildLabel(mode, thinkingText));
      return;
    }
    if (ev.type === "thinking_delta") {
      thinkingText = appendDelta(thinkingText, ev.textDelta);
      ctx.ui.setHiddenThinkingLabel(buildLabel(mode, thinkingText));
      return;
    }
    if (ev.type === "thinking_end") {
      // Final update — label stays until message_end clears it
      ctx.ui.setHiddenThinkingLabel(buildLabel(mode, thinkingText));
      isThinking = false;
    }
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role === "assistant") {
      isThinking = false;
      thinkingText = "";
      ctx.ui.setHiddenThinkingLabel(buildLabel(mode, ""));
    }
  });

  // ── Shortcut ──────────────────────────────────────────────────────────

  pi.registerShortcut("alt+t", {
    description: "Cycle thinking view (collapsed, summary, expanded)",
    handler: async (ctx) => {
      const next = cycle();
      setMode(ctx, next);
      ctx.ui.notify(`Thinking view: ${next}`, "info");
    },
  });

  // ── Command ───────────────────────────────────────────────────────────

  pi.registerCommand("thinking-steps", {
    description: "Set thinking view mode or save a project/global default",
    getArgumentCompletions: async (text) => {
      const pf = (text ?? "").trim().toLowerCase();
      return ["collapsed","summary","expanded","project","global"]
        .filter(v => v.startsWith(pf))
        .map(v => ({ value: v, label: v }));
    },
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        setMode(ctx, cycle());
        ctx.ui.notify(`Thinking view: ${mode}`, "info");
        return;
      }
      const parts = trimmed.split(/\s+/);
      const first = parts[0]!.toLowerCase();

      if (["project","global"].includes(first)) {
        const scope = first as PrefScope;
        const rest = parts.slice(1).join(" ").trim().toLowerCase();
        if (rest === "clear" || rest === "reset") {
          await clearPref(scope, ctx.cwd);
          ctx.ui.notify(`Cleared ${scope} thinking view default`, "info");
        } else if (["collapsed","summary","expanded"].includes(rest)) {
          const m = rest as ThinkingMode;
          await writePref(scope, ctx.cwd, m);
          setMode(ctx, m);
          ctx.ui.notify(`Thinking view: ${m} (saved for ${scope})`, "info");
        } else {
          ctx.ui.notify(
            "Usage: /thinking-steps [mode] | [project|global] [mode|clear]", "warning");
        }
        return;
      }
      if (["collapsed","summary","expanded"].includes(first)) {
        setMode(ctx, first as ThinkingMode);
        ctx.ui.notify(`Thinking view: ${first}`, "info");
        return;
      }
      ctx.ui.notify(
        "Usage: /thinking-steps [mode] | [project|global] [mode|clear]", "warning");
    },
  });
}

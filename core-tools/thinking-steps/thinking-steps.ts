/**
 * thinking-steps — Simple three-mode thinking rendering for Pi's TUI.
 */
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { appendDelta, buildLabel, isValidThinkingMode, modeLabel, type PrefScope, type ThinkingMode } from "./thinking-utils.ts";

const CUSTOM_ENTRY_TYPE = "thinking-steps.mode";
const PREF_FILE = "thinking-steps.json";
const DEFAULT_MODE: ThinkingMode = "summary";

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
    if (isValidThinkingMode(parsed.mode)) return parsed.mode;
  } catch {}
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

export default function thinkingSteps(pi: ExtensionAPI): void {
  let mode: ThinkingMode = DEFAULT_MODE;
  let thinkingText = "";

  function render(ctx: ExtensionContext): void {
    ctx.ui.setHiddenThinkingLabel(buildLabel(mode, thinkingText));
    ctx.ui.setStatus("thinking-steps", ctx.ui.theme.fg("dim", `Thinking: ${modeLabel(mode)}`));
  }

  function setMode(ctx: ExtensionContext, next: ThinkingMode, persist = true): void {
    mode = next;
    if (persist) pi.appendEntry(CUSTOM_ENTRY_TYPE, { mode: next });
    render(ctx);
  }

  function cycle(): ThinkingMode {
    if (mode === "collapsed") return "summary";
    if (mode === "summary") return "expanded";
    if (mode === "expanded") return "hidden";
    return "collapsed";
  }

  async function restoreMode(ctx: ExtensionContext): Promise<ThinkingMode> {
    const entries = ctx.sessionManager.getEntries() as Array<{ type?: string; customType?: string; data?: { mode?: string } }>;
    const saved = entries.filter(e => e.type === "custom" && e.customType === CUSTOM_ENTRY_TYPE).pop();
    if (isValidThinkingMode(saved?.data?.mode)) return saved!.data!.mode!;
    return (await readPref("project", ctx.cwd)) ?? (await readPref("global", ctx.cwd)) ?? DEFAULT_MODE;
  }

  pi.on("session_start", async (_event, ctx) => {
    mode = await restoreMode(ctx);
    render(ctx);
  });

  pi.on("message_update", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const ev = event.assistantMessageEvent as { type: string; textDelta?: string };
    if (ev.type === "thinking_start") thinkingText = "";
    if (ev.type === "thinking_delta") thinkingText = appendDelta(thinkingText, ev.textDelta);
    if (ev.type === "thinking_end" || ev.type === "thinking_delta" || ev.type === "thinking_start") render(ctx);
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    thinkingText = "";
    render(ctx);
  });

  pi.registerShortcut("alt+t", {
    description: "Cycle thinking view (collapsed, summary, expanded, hidden)",
    handler: async (ctx) => {
      setMode(ctx, cycle());
      ctx.ui.notify(`Thinking view: ${modeLabel(mode)}`, "info");
    },
  });

  pi.registerCommand("thinking-steps", {
    description: "Set thinking view mode or save a project/global default",
    getArgumentCompletions: async (text) => {
      const pf = (text ?? "").trim().toLowerCase();
      return ["collapsed", "summary", "expanded", "hidden", "project", "global"]
        .filter(v => v.startsWith(pf))
        .map(v => ({ value: v, label: v }));
    },
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        setMode(ctx, cycle());
        ctx.ui.notify(`Thinking view: ${modeLabel(mode)}`, "info");
        return;
      }

      const [first = "", ...restParts] = trimmed.split(/\s+/);
      const firstLower = first.toLowerCase();
      const rest = restParts.join(" ").trim().toLowerCase();

      if (["project", "global"].includes(firstLower)) {
        const scope = firstLower as PrefScope;
        if (rest === "clear" || rest === "reset") {
          await clearPref(scope, ctx.cwd);
          ctx.ui.notify(`Cleared ${scope} thinking view default`, "info");
        } else if (isValidThinkingMode(rest)) {
          await writePref(scope, ctx.cwd, rest);
          setMode(ctx, rest);
          ctx.ui.notify(`Thinking view: ${modeLabel(rest)} (saved for ${scope})`, "info");
        } else {
          ctx.ui.notify("Usage: /thinking-steps [mode] | [project|global] [mode|clear]", "warning");
        }
        return;
      }

      if (isValidThinkingMode(firstLower)) {
        setMode(ctx, firstLower);
        ctx.ui.notify(`Thinking view: ${modeLabel(firstLower)}`, "info");
        return;
      }

      ctx.ui.notify("Usage: /thinking-steps [mode] | [project|global] [mode|clear]", "warning");
    },
  });
}

export { appendDelta, buildLabel };

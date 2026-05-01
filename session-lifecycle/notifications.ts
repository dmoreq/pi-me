/**
 * Notifications Extension — Background alerts + funny working messages.
 *
 * Background notify: Detects long-running tasks, alerts when terminal is
 * backgrounded (beep, focus, speech, OS notification).
 *
 * Funny messages: Replaces "Working..." spinner label with random humor.
 *
 * Config (~/.pi/agent/settings.json): "backgroundNotify": { ... }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  getBackgroundNotifyConfig,
  type BackgroundNotifyConfig, type TerminalInfo,
  playBeep, displayOSXNotification, speakMessage, bringTerminalToFront,
  detectTerminalInfo, isTerminalInBackground, checkSayAvailable,
  loadPronunciations, checkTerminalNotifierAvailable, isTerminalNotifierAvailable,
  BEEP_SOUNDS, SAY_MESSAGES, getCurrentDirName, replaceMessageTemplates,
} from "../shared/index.js";
import * as fs from "node:fs/promises";
import * as os from "node:os";

// ============================================================================
// Funny Messages
// ============================================================================

const FUNNY = [
  "Simmering... (esc to interrupt)", "Julienning... (esc to interrupt)",
  "Braising... (esc to interrupt)", "Reducing... (esc to interrupt)",
  "Caramelizing... (esc to interrupt)", "Whisking... (esc to interrupt)",
  "Compiling vibes... (esc to interrupt)", "Refactoring reality... (esc to interrupt)",
  "Reticulating splines... (esc to interrupt)", "Herding bytes... (esc to interrupt)",
  "Converting coffee to code... (esc to interrupt)", "Shaving yaks... (esc to interrupt)",
  "Hugging the cache... (esc to interrupt)", "Almost done™... (esc to interrupt)",
  "Summoning documentation... (esc to interrupt)", "Counting to infinity... (esc to interrupt)",
  "Aligning parentheses... (esc to interrupt)", "Spinning up tiny hamsters... (esc to interrupt)",
  "Kneading... (esc to interrupt)", "Plating... (esc to interrupt)",
  "Garnishing... (esc to interrupt)", "Zesting... (esc to interrupt)",
  "Mise en placing... (esc to interrupt)", "Emulsifying... (esc to interrupt)",
  "Tempering chocolate... (esc to interrupt)", "Folding gently... (esc to interrupt)",
  "Preheating... (esc to interrupt)", "Basting... (esc to interrupt)",
  "Blanching... (esc to interrupt)", "Deglazing... (esc to interrupt)",
];

function pickFunny(): string {
  return FUNNY[Math.floor(Math.random() * FUNNY.length)] ?? "Working... (esc to interrupt)";
}

// ============================================================================
// Types & State
// ============================================================================

interface SessionState {
  beepOverride: boolean | null;
  beepSoundOverride: string | null;
  focusOverride: boolean | null;
  sayOverride: boolean | null;
  sayMessageOverride: string | null;
  funnyOverride: boolean | null;
  terminalInfo: TerminalInfo;
  lastToolTime: number | undefined;
  totalActiveTime: number;
}

function resetState(state: SessionState): void {
  state.beepOverride = null; state.beepSoundOverride = null;
  state.focusOverride = null; state.sayOverride = null;
  state.sayMessageOverride = null; state.funnyOverride = null;
  state.lastToolTime = undefined; state.totalActiveTime = 0;
}

function getEffective(state: SessionState, config: BackgroundNotifyConfig) {
  return {
    beep: state.beepOverride ?? config.beep,
    focus: state.focusOverride ?? config.bringToFront,
    say: state.sayOverride ?? config.say,
    sound: state.beepSoundOverride ?? config.beepSound,
    sayMessage: state.sayMessageOverride ?? config.sayMessage,
  };
}

function extractOptionText(action: string, iconPrefix: string): string | null {
  if (!action || action === "❌ Cancel" || action === "───") return null;
  return action.startsWith(iconPrefix)
    ? action.replace(iconPrefix, "").replace(" ✓", "").replace(/^"|"$/g, "") : null;
}

// ============================================================================
// Extension
// ============================================================================

export default function (pi: ExtensionAPI) {
  const state: SessionState = {
    beepOverride: null, beepSoundOverride: null, focusOverride: null,
    sayOverride: null, sayMessageOverride: null, funnyOverride: null,
    terminalInfo: {}, lastToolTime: undefined, totalActiveTime: 0,
  };

  // ── Commands: Notifications ──

  pi.registerCommand("notify-beep", {
    description: "Toggle beep/sound on task completion",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      state.beepOverride = state.beepOverride === null ? !config.beep : !state.beepOverride;
      ctx.ui.notify(state.beepOverride ? "🔊 Beep: ON" : "🔇 Beep: OFF", "info");
    },
  });

  pi.registerCommand("notify-focus", {
    description: "Toggle bring-terminal-to-front on task completion",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      state.focusOverride = state.focusOverride === null ? !config.bringToFront : !state.focusOverride;
      ctx.ui.notify(state.focusOverride ? "🪟 Focus: ON" : "⬜ Focus: OFF", "info");
    },
  });

  pi.registerCommand("notify-say", {
    description: "Toggle speech on task completion",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      state.sayOverride = state.sayOverride === null ? !config.say : !state.sayOverride;
      if (state.sayOverride) {
        const spoken = replaceMessageTemplates(getEffective(state, config).sayMessage);
        speakMessage(spoken);
        ctx.ui.notify(`🗣️ Speech: ON ("${spoken}")`, "info");
      } else {
        ctx.ui.notify("🔇 Speech: OFF", "info");
      }
    },
  });

  pi.registerCommand("notify-threshold", {
    description: "Set notification threshold in ms",
    handler: async (args, ctx) => {
      const ms = parseInt(args || "2000");
      if (isNaN(ms) || ms < 0) { ctx.ui.notify("Usage: /notify-threshold <ms>", "warning"); return; }
      const home = process.env.HOME || os.homedir();
      const sp = `${home}/.pi/agent/settings.json`;
      let s: any = {};
      try { s = JSON.parse(await fs.readFile(sp, "utf-8")); } catch {}
      s.backgroundNotify = { ...s.backgroundNotify, thresholdMs: ms };
      await fs.mkdir(`${home}/.pi/agent`, { recursive: true });
      await fs.writeFile(sp, JSON.stringify(s, null, 2), "utf-8");
      ctx.ui.notify(`⏱️ Threshold: ${ms}ms`, "info");
    },
  });

  pi.registerCommand("notify-status", {
    description: "Show notification settings",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      const eff = getEffective(state, config);
      const rows = [
        "╭─── Notifications ───╮",
        `  ${eff.beep ? "🔊" : "🔇"} Beep: ${eff.beep ? "ON" : "OFF"}`,
        `  ${eff.focus ? "🪟" : "⬜"} Focus: ${eff.focus ? "ON" : "OFF"}`,
        `  ${eff.say ? "🗣️" : "🔇"} Speech: ${eff.say ? "ON" : "OFF"}`,
        `  💬 "${eff.sayMessage}"`,
        `  🎵 ${eff.sound}  ⏱️ ${config.thresholdMs}ms`,
        `  😂 Funny: ${state.funnyOverride ? "ON" : "OFF"}`,
        "╰─────────────────────╯",
      ];
      ctx.ui.notify(rows.join("\n"), "info");
    },
  });

  pi.registerCommand("notify-save-global", {
    description: "Save current settings as global defaults",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      const eff = getEffective(state, config);
      const home = process.env.HOME || os.homedir();
      const sp = `${home}/.pi/agent/settings.json`;
      let s: any = {};
      try { s = JSON.parse(await fs.readFile(sp, "utf-8")); } catch {}
      s.backgroundNotify = {
        ...s.backgroundNotify,
        beep: eff.beep, bringToFront: eff.focus, beepSound: eff.sound,
        say: eff.say, sayMessage: eff.sayMessage, thresholdMs: config.thresholdMs,
      };
      await fs.mkdir(`${home}/.pi/agent`, { recursive: true });
      await fs.writeFile(sp, JSON.stringify(s, null, 2), "utf-8");
      ctx.ui.notify("✅ Saved", "info");
    },
  });

  // ── Command: Funny Messages ──

  pi.registerCommand("fun-working", {
    description: "Toggle funny working messages",
    handler: async (_args, ctx) => {
      state.funnyOverride = !state.funnyOverride;
      if (!state.funnyOverride) {
        ctx.ui.setWorkingMessage();
        ctx.ui.notify("Default working message restored", "info");
      } else {
        if (!ctx.isIdle()) ctx.ui.setWorkingMessage(pickFunny());
        ctx.ui.notify("😂 Funny working messages: ON", "info");
      }
    },
  });

  // ── Hooks ──

  pi.on("session_start", async (_, ctx) => {
    resetState(state);
    state.terminalInfo = await detectTerminalInfo();
    await checkSayAvailable();
    await checkTerminalNotifierAvailable();
    await loadPronunciations();
    if (ctx.hasUI && (await isTerminalNotifierAvailable())) {
      ctx.ui.notify("📢 terminal-notifier available", "info");
    }
  });

  pi.on("agent_start", (_event, ctx) => {
    state.lastToolTime = Date.now();
    state.totalActiveTime = 0;
    if (state.funnyOverride && ctx.hasUI) ctx.ui.setWorkingMessage(pickFunny());
  });

  pi.on("tool_result", () => {
    if (state.lastToolTime) state.totalActiveTime += Date.now() - state.lastToolTime;
    state.lastToolTime = Date.now();
  });

  pi.on("agent_end", async (_, ctx) => {
    if (state.funnyOverride && ctx.hasUI) ctx.ui.setWorkingMessage();

    if (!state.lastToolTime) return;
    state.totalActiveTime += Date.now() - state.lastToolTime;
    const duration = state.totalActiveTime;
    state.lastToolTime = undefined;
    state.totalActiveTime = 0;

    const config = await getBackgroundNotifyConfig(ctx);
    const eff = getEffective(state, config);
    if (!eff.beep && !eff.focus && !eff.say) return;
    if (duration < config.thresholdMs) return;
    if (!(await isTerminalInBackground(state.terminalInfo))) return;

    const acts: string[] = [];
    if (eff.beep) { displayOSXNotification(replaceMessageTemplates(eff.sayMessage), eff.sound, state.terminalInfo); acts.push("beeped"); }
    if (eff.focus) { await bringTerminalToFront(state.terminalInfo); acts.push("focused"); }
    if (eff.say) { speakMessage(eff.sayMessage); acts.push("spoke"); }

    if (ctx.hasUI) ctx.ui.notify(`Done in ${(duration / 1000).toFixed(1)}s (${acts.join(", ")})`, "info");
  });
}

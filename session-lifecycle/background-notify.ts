/**
 * Background Task Completion Extension
 *
 * Detects long-running tasks and notifies you when they complete while the terminal is backgrounded.
 *
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "backgroundNotify": {
 *     "thresholdMs": 2000,
 *     "beep": true,
 *     "beepSound": "Funk",
 *     "bringToFront": false,
 *     "say": false,
 *     "sayMessage": "Task completed"
 *   }
 * }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  getBackgroundNotifyConfig,
  type BackgroundNotifyConfig,
  type TerminalInfo,
  playBeep,
  displayOSXNotification,
  speakMessage,
  bringTerminalToFront,
  detectTerminalInfo,
  isTerminalInBackground,
  checkSayAvailable,
  loadPronunciations,
  checkTerminalNotifierAvailable,
  isTerminalNotifierAvailable,
  BEEP_SOUNDS,
  SAY_MESSAGES,
  getCurrentDirName,
  replaceMessageTemplates,
} from "../shared/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface SessionState {
  beepOverride: boolean | null;
  beepSoundOverride: string | null;
  focusOverride: boolean | null;
  sayOverride: boolean | null;
  sayMessageOverride: string | null;
  terminalInfo: TerminalInfo;
  lastToolTime: number | undefined;
  totalActiveTime: number;
}

const DEFAULT_CONFIG: BackgroundNotifyConfig = {
  thresholdMs: 2000,
  beep: true,
  beepSound: "Funk",
  bringToFront: false,
  say: false,
  sayMessage: "Done in {dirname}",
};

enum NotificationAction {
  Beeped = "beeped",
  Spoke = "spoke",
  BroughtToFront = "brought to front",
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function resetSessionState(state: SessionState): void {
  state.beepOverride = null;
  state.beepSoundOverride = null;
  state.focusOverride = null;
  state.sayOverride = null;
  state.sayMessageOverride = null;
  state.lastToolTime = undefined;
  state.totalActiveTime = 0;
}

function extractOptionText(action: string, iconPrefix: string): string | null {
  if (!action || action === "❌ Cancel" || action === "───") {
    return null;
  }
  if (action.startsWith(iconPrefix)) {
    return action.replace(iconPrefix, "").replace(" ✓", "").replace(/^"|"$/g, "");
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Extension
// ─────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const state: SessionState = {
    beepOverride: null,
    beepSoundOverride: null,
    focusOverride: null,
    sayOverride: null,
    sayMessageOverride: null,
    terminalInfo: {},
    lastToolTime: undefined,
    totalActiveTime: 0,
  };

  registerCommands(pi, state);

  pi.on("session_start", async (_, ctx) => {
    // Reset session state
    resetSessionState(state);

    // Detect terminal, check for say command, check for terminal-notifier, and load pronunciations
    state.terminalInfo = await detectTerminalInfo();
    await checkSayAvailable();
    await checkTerminalNotifierAvailable();
    await loadPronunciations();

    if (ctx.hasUI && (await isTerminalNotifierAvailable())) {
      ctx.ui.notify("📢 Using terminal-notifier for notifications (clicking will activate Terminal)", "info");
    }
  });

  pi.on("agent_start", () => {
    state.lastToolTime = Date.now();
    state.totalActiveTime = 0;
  });

  pi.on("tool_result", () => {
    if (state.lastToolTime) {
      state.totalActiveTime += Date.now() - state.lastToolTime;
    }
    state.lastToolTime = Date.now();
  });

  pi.on("agent_end", async (_, ctx) => {
    if (!state.lastToolTime) return;

    // Add final segment
    state.totalActiveTime += Date.now() - state.lastToolTime;
    const duration = state.totalActiveTime;

    state.lastToolTime = undefined;
    state.totalActiveTime = 0;

    const config = await getBackgroundNotifyConfig(ctx);
    const eff = getEffective(state, config);

    if (!eff.beep && !eff.focus && !eff.say) return;
    if (duration < config.thresholdMs) return;

    const isBackground = await isTerminalInBackground(state.terminalInfo);
    if (!isBackground) return;

    const tasks: Promise<void>[] = [];
    const actions: NotificationAction[] = [];

    // Non-blocking: OS X notification (includes sound on macOS), speech plays in background
    if (eff.beep) {
      const notificationMessage = replaceMessageTemplates(eff.sayMessage);
      displayOSXNotification(notificationMessage, eff.sound, state.terminalInfo);
      actions.push(NotificationAction.Beeped);
    }
    if (eff.focus) {
      tasks.push(bringTerminalToFront(state.terminalInfo));
      actions.push(NotificationAction.BroughtToFront);
    }
    if (eff.say) {
      speakMessage(eff.sayMessage);
      actions.push(NotificationAction.Spoke);
    }

    await Promise.all(tasks);

    if (ctx.hasUI) {
      ctx.ui.notify(`Task completed in ${(duration / 1000).toFixed(1)}s (${actions.join(", ")})`, "info");
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getEffective(state: SessionState, config: BackgroundNotifyConfig) {
  return {
    beep: state.beepOverride ?? config.beep,
    focus: state.focusOverride ?? config.bringToFront,
    say: state.sayOverride ?? config.say,
    sound: state.beepSoundOverride ?? config.beepSound,
    sayMessage: state.sayMessageOverride ?? config.sayMessage,
  };
}

async function saveGlobalSettings(ctx: ExtensionContext, updates: Partial<BackgroundNotifyConfig>): Promise<void> {
  try {
    // Read existing settings file
    const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
    let fileSettings: any = {};

    try {
      const content = await fs.readFile(settingsPath, "utf8");
      fileSettings = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    // Merge updates
    fileSettings.backgroundNotify = {
      ...(fileSettings.backgroundNotify ?? {}),
      ...updates,
    };

    // Write back to file
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(fileSettings, null, 2), "utf8");

    console.log("Settings saved to:", settingsPath, updates);
  } catch (err) {
    console.error("Failed to save settings:", err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

function registerCommands(pi: ExtensionAPI, state: SessionState) {
  pi.registerCommand("notify-beep", {
    description: "Toggle beep notification (off if on, select sound if off)",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      const current = state.beepOverride ?? config.beep;

      if (current) {
        // Currently ON, turn OFF
        state.beepOverride = false;
        ctx.ui.notify("🔇 Beep OFF", "warning");
      } else {
        // Currently OFF, let user select a sound
        const currentSound = state.beepSoundOverride ?? config.beepSound;
        const options = [
          "🔊 Use current sound",
          "───",
          ...BEEP_SOUNDS.map((s) => `🎵 ${s}${s === currentSound ? " ✓" : ""}`),
          "───",
          "❌ Cancel"
        ];

        const action = await ctx.ui.select(`Turn beep ON - Select sound (current: ${currentSound})`, options);

        if (!action || action === "❌ Cancel" || action === "───") {
          return;
        }

        if (action === "🔊 Use current sound") {
          state.beepOverride = true;
          ctx.ui.notify(`🔊 Beep ON (${currentSound})`, "info");
          playBeep(currentSound);
        } else {
          const sound = extractOptionText(action, "🎵 ");
          if (sound) {
            state.beepOverride = true;
            state.beepSoundOverride = sound;
            ctx.ui.notify(`🔊 Beep ON (${sound})`, "info");
            playBeep(sound);
          }
        }
      }
    },
  });

  pi.registerCommand("notify-focus", {
    description: "Toggle bring-to-front",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      const current = state.focusOverride ?? config.bringToFront;
      state.focusOverride = !current;

      ctx.ui.notify(state.focusOverride ? "🪟 Focus ON" : "⬜ Focus OFF", state.focusOverride ? "info" : "warning");
    },
  });

  pi.registerCommand("notify-say", {
    description: "Toggle speech notification (off if on, select message if off)",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      const current = state.sayOverride ?? config.say;

      if (current) {
        // Currently ON, turn OFF
        state.sayOverride = false;
        ctx.ui.notify("🔇 Speech OFF", "warning");
      } else {
        // Currently OFF, let user select a message
        const currentMessage = state.sayMessageOverride ?? config.sayMessage;
        const options = [
          "🗣️  Use current message",
          "───",
          ...SAY_MESSAGES.map((m) => `💬 "${m}"${m === currentMessage ? " ✓" : ""}`),
          "───",
          "✏️  Enter custom message...",
          "───",
          "❌ Cancel"
        ];

        const action = await ctx.ui.select(`Turn speech ON - Select message (current: "${currentMessage}")`, options);

        if (!action || action === "❌ Cancel" || action === "───") {
          return;
        }

        if (action === "🗣️  Use current message") {
          state.sayOverride = true;
          ctx.ui.notify(`🗣️  Speech ON ("${currentMessage}")`, "info");
          speakMessage(currentMessage);
        } else if (action.startsWith("💬 ")) {
          const message = action.replace('💬 "', '').replace('"', '').replace(" ✓", "");
          state.sayOverride = true;
          state.sayMessageOverride = message;
          ctx.ui.notify(`🗣️  Speech ON ("${message}")`, "info");
          speakMessage(message);
        } else if (action === "✏️  Enter custom message...") {
          const customMessage = await ctx.ui.input("Enter message to speak");
          if (customMessage && customMessage.trim()) {
            state.sayOverride = true;
            state.sayMessageOverride = customMessage.trim();
            ctx.ui.notify(`🗣️  Speech ON ("${customMessage.trim()}")`, "info");
            speakMessage(customMessage.trim());
          }
        }
      }
    },
  });

  pi.registerCommand("notify-threshold", {
    description: "Set notification threshold (minimum task duration)",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);

      const options = [
        `1000ms (1s)${config.thresholdMs === 1000 ? " ✓" : ""}`,
        `2000ms (2s)${config.thresholdMs === 2000 ? " ✓" : ""}`,
        `3000ms (3s)${config.thresholdMs === 3000 ? " ✓" : ""}`,
        `5000ms (5s)${config.thresholdMs === 5000 ? " ✓" : ""}`,
        `10000ms (10s)${config.thresholdMs === 10000 ? " ✓" : ""}`,
        "───",
        "❌ Cancel"
      ];

      const action = await ctx.ui.select(`Threshold (current: ${config.thresholdMs}ms)`, options);

      if (!action || action === "❌ Cancel" || action === "───") {
        return;
      }

      const match = action.match(/^(\d+)ms/);
      if (match) {
        const newThreshold = parseInt(match[1], 10);
        await saveGlobalSettings(ctx, { thresholdMs: newThreshold });
        ctx.ui.notify(`⏱️  Threshold set to ${newThreshold}ms`, "info");
      }
    },
  });

  pi.registerCommand("notify-status", {
    description: "Show notification settings",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      const eff = getEffective(state, config);

      const beepIcon = eff.beep ? "🔊" : "🔇";
      const focusIcon = eff.focus ? "🪟" : "⬜";
      const sayIcon = eff.say ? "🗣️" : "🔇";

      const globalBeepIcon = config.beep ? "🔊" : "🔇";
      const globalFocusIcon = config.bringToFront ? "🪟" : "⬜";
      const globalSayIcon = config.say ? "🗣️" : "🔇";

      const hasOverrides = state.beepOverride !== null || state.focusOverride !== null || state.beepSoundOverride !== null || state.sayOverride !== null || state.sayMessageOverride !== null;

      const status = [
        "╭─ Background Notify Status ─╮",
        "",
        "Current (Effective):",
        `  ${beepIcon} Beep: ${eff.beep ? "ON" : "OFF"}`,
        `  ${focusIcon} Focus: ${eff.focus ? "ON" : "OFF"}`,
        `  ${sayIcon} Speech: ${eff.say ? "ON" : "OFF"}`,
        `  💬 Message: "${eff.sayMessage}"`,
        eff.sayMessage.includes("{dirname}") ? `  → Spoken: "${replaceMessageTemplates(eff.sayMessage)}"` : "",
        `  🎵 Sound: ${eff.sound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
        "",
        "Global Defaults:",
        `  ${globalBeepIcon} Beep: ${config.beep ? "ON" : "OFF"}`,
        `  ${globalFocusIcon} Focus: ${config.bringToFront ? "ON" : "OFF"}`,
        `  ${globalSayIcon} Speech: ${config.say ? "ON" : "OFF"}`,
        `  💬 Message: "${config.sayMessage}"`,
        config.sayMessage.includes("{dirname}") ? `  → Spoken: "${replaceMessageTemplates(config.sayMessage)}"` : "",
        `  🎵 Sound: ${config.beepSound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
      ];

      if (hasOverrides) {
        status.push("");
        status.push("Session Overrides:");
        if (state.beepOverride !== null) {
          status.push(`  ${state.beepOverride ? "🔊" : "🔇"} Beep: ${state.beepOverride ? "ON" : "OFF"}`);
        }
        if (state.focusOverride !== null) {
          status.push(`  ${state.focusOverride ? "🪟" : "⬜"} Focus: ${state.focusOverride ? "ON" : "OFF"}`);
        }
        if (state.beepSoundOverride !== null) {
          status.push(`  🎵 Sound: ${state.beepSoundOverride}`);
        }
        if (state.sayOverride !== null) {
          status.push(`  ${state.sayOverride ? "🗣️" : "🔇"} Speech: ${state.sayOverride ? "ON" : "OFF"}`);
        }
        if (state.sayMessageOverride !== null) {
          status.push(`  💬 Message: "${state.sayMessageOverride}"`);
          if (state.sayMessageOverride.includes("{dirname}")) {
            status.push(`     → Spoken: "${replaceMessageTemplates(state.sayMessageOverride)}"`);
          }
        }
      }

      status.push("");
      status.push(`💻 Terminal: ${state.terminalInfo.terminalApp ?? "(unknown)"}`);
      status.push("╰────────────────────────────╯");

      ctx.ui.notify(status.join("\n"), "info");
    },
  });

  pi.registerCommand("notify-save-global", {
    description: "Save current settings as global defaults",
    handler: async (_, ctx) => {
      const config = await getBackgroundNotifyConfig(ctx);
      const eff = getEffective(state, config);

      await saveGlobalSettings(ctx, {
        beep: eff.beep,
        bringToFront: eff.focus,
        beepSound: eff.sound,
        say: eff.say,
        sayMessage: eff.sayMessage,
        thresholdMs: config.thresholdMs,
      });

      ctx.ui.notify("✅ Settings saved to ~/.pi/agent/settings.json", "info");

      const status = [
        `  ${eff.beep ? "🔊" : "🔇"} Beep: ${eff.beep ? "ON" : "OFF"}`,
        `  ${eff.focus ? "🪟" : "⬜"} Focus: ${eff.focus ? "ON" : "OFF"}`,
        `  ${eff.say ? "🗣️" : "🔇"} Speech: ${eff.say ? "ON" : "OFF"}`,
        `  💬 Message: "${eff.sayMessage}"`,
        `  🎵 Sound: ${eff.sound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
      ].filter(Boolean).join("\n");

      ctx.ui.notify(status, "info");
    },
  });
}

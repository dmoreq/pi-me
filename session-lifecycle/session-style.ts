/**
 * Session Style Extension — Emoji + Color branding for pi sessions.
 *
 * Emoji: Auto-assigns or lets you pick an emoji for the status bar.
 *   Modes: "immediate" (random), "delayed" (after N messages).
 *
 * Color: Assigns a distinct ANSI 256-color band to each session's footer,
 *   rotating through a 40-color palette for maximum visual distinction.
 *
 * Config (~/.pi/agent/settings.json):
 *   "sessionEmoji": { enabledByDefault, autoAssignMode, autoAssignThreshold, ... }
 *   "sessionColor": { enabledByDefault, blockChar, blockCount }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfigOrDefault } from "../shared/pi-config.js";
import { z } from "zod";

// ============================================================================
// Emoji — Types & Constants
// ============================================================================

interface SessionEmojiConfig {
  enabledByDefault: boolean;
  autoAssignMode: "immediate" | "delayed";
  autoAssignThreshold: number;
  emojiSet: "default" | "animals" | "tech" | "fun" | "custom";
  customEmojis: string[];
}

interface EmojiHistoryEntry { sessionId: string; emoji: string; timestamp: number; context: string; }

const DEFAULT_EMOJI_CONFIG: SessionEmojiConfig = {
  enabledByDefault: true, autoAssignMode: "immediate", autoAssignThreshold: 3,
  emojiSet: "default", customEmojis: [],
};

const EMOJI_SETS: Record<string, string[]> = {
  default: ["🚀", "✨", "🎯", "💡", "🔥", "⚡", "🎨", "🌟", "💻", "🎭"],
  animals: ["🐱", "🐶", "🐼", "🦊", "🐻", "🦁", "🐯", "🐨", "🐰", "🦉"],
  tech: ["💻", "🖥️", "⌨️", "🖱️", "💾", "📱", "🔌", "🔋", "🖨️", "📡"],
  fun: ["🎉", "🎊", "🎈", "🎁", "🎂", "🍕", "🍩", "🌮", "🎮", "🎲"],
};



// ============================================================================
// Color — Types & Constants
// ============================================================================

interface SessionColorConfig {
  enabledByDefault: boolean;
  blockChar: string;
  blockCount: number | "full";
}

const DEFAULT_COLOR_CONFIG: SessionColorConfig = {
  enabledByDefault: true, blockChar: "▁", blockCount: "full",
};

const COLOR_FILE = path.join(os.homedir(), ".pi", "session-color-state.json");

const COLOR_PALETTE: number[] = [
  196, 51, 226, 129, 46, 208, 27, 213, 118, 160,
  87, 220, 93, 34, 202, 75, 199, 154, 124, 45,
  214, 135, 40, 166, 69, 205, 190, 88, 80, 228,
  97, 28, 172, 63, 197, 82, 130, 39, 219, 106,
];

const BLOCK_CHARS = [
  { char: "▁", name: "Lower 1/8 block" }, { char: "▂", name: "Lower 1/4 block" },
  { char: "▄", name: "Lower half block" }, { char: "█", name: "Full block" },
  { char: "▔", name: "Upper 1/8 block" }, { char: "▀", name: "Upper half block" },
  { char: "─", name: "Light horizontal" }, { char: "━", name: "Heavy horizontal" },
  { char: "═", name: "Double horizontal" },
];

const RESET = "\x1b[0m";

// ============================================================================
// State & Config Helpers
// ============================================================================

interface EmojiState {
  emoji: string | null; messageCount: number; assigned: boolean;
  selecting: boolean; enabledOverride: boolean | null;
}

interface ColorStatePersisted { lastColorIndex: number; sessionId: string; timestamp: number; }

interface ColorState {
  colorIndex: number | null; assigned: boolean; enabledOverride: boolean | null;
  blockCharOverride: string | null; blockCharIndex: number;
}

// ============================================================================
// Color Persistence Helpers
// ============================================================================

function readColorState(): ColorStatePersisted | null {
  try {
    if (fs.existsSync(COLOR_FILE)) return JSON.parse(fs.readFileSync(COLOR_FILE, "utf-8"));
  } catch {}
  return null;
}

function writeColorState(state: ColorStatePersisted): void {
  try { fs.writeFileSync(COLOR_FILE, JSON.stringify(state, null, 2), "utf-8"); } catch {}
}

// ============================================================================
// Main Extension
// ============================================================================

export default function (pi: ExtensionAPI) {
  // ── Emoji State ──
  const emoji: EmojiState = {
    emoji: null, messageCount: 0, assigned: false, selecting: false, enabledOverride: null,
  };

  // ── Color State ──
  const color: ColorState = {
    colorIndex: null, assigned: false, enabledOverride: null,
    blockCharOverride: null, blockCharIndex: 0,
  };
  let currentCtx: ExtensionContext | null = null;
  let resizeHandler: (() => void) | null = null;

  // ── Config Readers (using shared zod-validated loader) ──

  const EmojiConfigSchema = z.object({
    enabledByDefault: z.boolean().default(true),
    autoAssignMode: z.enum(["immediate", "delayed"]).default("immediate"),
    autoAssignThreshold: z.number().default(3),
    emojiSet: z.enum(["default", "animals", "tech", "fun", "custom"]).default("default"),
    customEmojis: z.array(z.string()).default([]),
  });

  const ColorConfigSchema = z.object({
    enabledByDefault: z.boolean().default(true),
    blockChar: z.string().default("\u2581"),
    blockCount: z.union([z.number(), z.literal("full")]).default("full"),
  });

  function getEmojiConfig(): SessionEmojiConfig {
    const raw = loadConfigOrDefault({
      filename: "settings.json",
      schema: z.object({ sessionEmoji: EmojiConfigSchema }).partial(),
      defaults: {},
    });
    const fromFile = (raw as any)?.sessionEmoji ?? {};
    return { ...DEFAULT_EMOJI_CONFIG, ...fromFile };
  }

  function getColorConfig(): SessionColorConfig {
    const raw = loadConfigOrDefault({
      filename: "settings.json",
      schema: z.object({ sessionColor: ColorConfigSchema }).partial(),
      defaults: {},
    });
    const fromFile = (raw as any)?.sessionColor ?? {};
    return { ...DEFAULT_COLOR_CONFIG, ...fromFile };
  }

  // ── Color: Status Display ──

  function updateColorStatus(ctx: ExtensionContext, config: SessionColorConfig) {
    if (color.colorIndex === null) return;
    const c = COLOR_PALETTE[color.colorIndex];
    const count = config.blockCount === "full" ? (process.stdout.columns || 80) : config.blockCount;
    const ch = color.blockCharOverride ?? config.blockChar;
    ctx.ui.setStatus("0-color-band", `\x1b[38;5;${c}m${ch.repeat(count)}${RESET}`);
  }

  function setupColorResize(ctx: ExtensionContext, config: SessionColorConfig) {
    if (resizeHandler) process.stdout.off("resize", resizeHandler);
    if (config.blockCount === "full" && color.colorIndex !== null) {
      currentCtx = ctx;
      resizeHandler = () => {
        if (currentCtx && color.colorIndex !== null) {
          const enabled = color.enabledOverride ?? config.enabledByDefault;
          if (enabled) updateColorStatus(currentCtx, config);
        }
      };
      process.stdout.on("resize", resizeHandler);
    }
  }

  // ── Color: Session Init ──

  function initColor(ctx: ExtensionContext) {
    Object.assign(color, { colorIndex: null, assigned: false, enabledOverride: null, blockCharOverride: null, blockCharIndex: 0 });
    const config = getColorConfig();
    if (!config.enabledByDefault) { ctx.ui.setStatus("0-color-band", ""); return; }

    const sid = ctx.sessionManager.getSessionId();
    const persisted = readColorState();
    if (persisted?.sessionId === sid) {
      color.colorIndex = persisted.lastColorIndex;
      color.assigned = true;
      updateColorStatus(ctx, config);
      setupColorResize(ctx, config);
      return;
    }
    const next = ((persisted?.lastColorIndex ?? -1) + 1) % COLOR_PALETTE.length;
    color.colorIndex = next;
    color.assigned = true;
    writeColorState({ lastColorIndex: next, sessionId: sid, timestamp: Date.now() });
    updateColorStatus(ctx, config);
    setupColorResize(ctx, config);
  }

  // ── Emoji: Helpers ──

  function getEmojiList(config: SessionEmojiConfig): string[] {
    return config.emojiSet === "custom" ? config.customEmojis : (EMOJI_SETS[config.emojiSet] ?? EMOJI_SETS.default);
  }

  function getEmojiHistory(ctx: ExtensionContext): EmojiHistoryEntry[] {
    try {
      const sessions = (ctx.sessionManager as any).getSessions?.() ?? [];
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      return sessions
        .filter((s: any) => s.emoji && (s.timestamp ?? s.createdAt) > cutoff)
        .map((s: any) => ({ sessionId: s.id, emoji: s.emoji, timestamp: s.timestamp ?? s.createdAt, context: s.firstMessage ?? "" }))
        .sort((a: any, b: any) => b.timestamp - a.timestamp);
    } catch { return []; }
  }

  function getRecentEmojis(ctx: ExtensionContext): Set<string> {
    return new Set(getEmojiHistory(ctx).slice(0, 10).map(h => h.emoji));
  }

  function findExistingEmoji(ctx: ExtensionContext): string | null {
    try {
      const sid = ctx.sessionManager.getSessionId();
      return getEmojiHistory(ctx).find(h => h.sessionId === sid)?.emoji ?? null;
    } catch { return null; }
  }

  function persistEmoji(ctx: ExtensionContext, _pi: ExtensionAPI, e: string) {
    try {
      const mgr = ctx.sessionManager as any;
      if (mgr.setMetadata) mgr.setMetadata("emoji", e);
      if (mgr.persist) mgr.persist();
    } catch {}
  }

  function formatTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }



  function selectRandomEmoji(ctx: ExtensionContext, config: SessionEmojiConfig): string {
    const emojis = getEmojiList(config);
    const recent = getRecentEmojis(ctx);
    const available = emojis.filter(e => !recent.has(e));
    return (available.length > 0 ? available : emojis)[Math.floor(Math.random() * (available.length || emojis.length))];
  }

  // ── Emoji: Assignment ──

  async function assignEmoji(ctx: ExtensionContext, config: SessionEmojiConfig) {
    if (emoji.assigned || emoji.selecting) return;
    emoji.selecting = true;
    try {
      const e = selectRandomEmoji(ctx, config);
      emoji.emoji = e; emoji.assigned = true;
      persistEmoji(ctx, pi, e);
      ctx.ui.setStatus("0-emoji", e);
    } finally { emoji.selecting = false; }
  }

  // ── Emoji: Init ──

  async function initEmoji(ctx: ExtensionContext) {
    Object.assign(emoji, { emoji: null, messageCount: 0, assigned: false, selecting: false, enabledOverride: null });
    const config = getEmojiConfig();
    if (!config.enabledByDefault) { ctx.ui.setStatus("0-emoji", ""); return; }
    const existing = findExistingEmoji(ctx);
    if (existing) { emoji.emoji = existing; emoji.assigned = true; ctx.ui.setStatus("0-emoji", existing); return; }
    if (config.autoAssignMode === "immediate") await assignEmoji(ctx, config);
    else ctx.ui.setStatus("0-emoji", `⏳ (${config.autoAssignThreshold})`);
  }

  async function handleEmojiAgentStart(ctx: ExtensionContext) {
    const config = getEmojiConfig();
    const enabled = emoji.enabledOverride ?? config.enabledByDefault;
    if (!enabled || emoji.assigned || config.autoAssignMode === "immediate") return;
    emoji.messageCount++;
    if (emoji.messageCount >= config.autoAssignThreshold) await assignEmoji(ctx, config);
    else ctx.ui.setStatus("0-emoji", `⏳ (${config.autoAssignThreshold - emoji.messageCount})`);
  }

  function setManualEmoji(ctx: ExtensionContext, e: string) {
    emoji.emoji = e; emoji.assigned = true;
    persistEmoji(ctx, pi, e);
    ctx.ui.setStatus("0-emoji", e);
  }

  // ========================================================================
  // Commands: Emoji
  // ========================================================================

  pi.registerCommand("emoji", {
    description: "Toggle session emoji on/off", handler: async (_, ctx) => {
      const config = getEmojiConfig();
      emoji.enabledOverride = !(emoji.enabledOverride ?? config.enabledByDefault);
      if (!emoji.enabledOverride) { ctx.ui.setStatus("0-emoji", ""); ctx.ui.notify("Emoji: OFF", "info"); return; }
      if (!emoji.assigned) await assignEmoji(ctx, config);
      ctx.ui.notify(`Emoji: ON (${emoji.emoji ?? "..."})`, "info");
    },
  });

  // ── Emoji: Set Command ──

  pi.registerCommand("emoji-set", {
    description: "Set session emoji manually", handler: async (args, ctx) => {
      const input = args?.trim() ?? "";
      if (input) { setManualEmoji(ctx, input); return; }
      if (!ctx.hasUI) return;
      // Interactive: choose from set
      const config = getEmojiConfig();
      const emojis = getEmojiList(config);
      const action = await ctx.ui.select("Choose emoji", [...emojis, "🎲 Random", "❌ Cancel"]);
      if (!action || action === "❌ Cancel") return;
      if (action === "🎲 Random") {
        setManualEmoji(ctx, selectRandomEmoji(ctx, config));
      } else {
        setManualEmoji(ctx, action);
      }
    },
  });

  // ── Emoji: Config Command ──

  pi.registerCommand("emoji-config", {
    description: "View emoji settings", handler: async (_, ctx) => {
      const config = getEmojiConfig();
      const enabled = emoji.enabledOverride ?? config.enabledByDefault;
      ctx.ui.notify(`─── Session Emoji ───\nStatus: ${enabled ? "🎨 ON" : "⬜ OFF"}  │  Current: ${emoji.emoji ?? "(none)"}\nMode: ${config.autoAssignMode}  │  Threshold: ${config.autoAssignThreshold}  │  Set: ${config.emojiSet}`, "info");
      if (!ctx.hasUI) return;
      const action = await ctx.ui.select("Options", ["🎨 Preview sets", "📋 View history", "❌ Cancel"]);
      if (action?.startsWith("🎨")) {
        for (const [name, e] of Object.entries(EMOJI_SETS)) ctx.ui.notify(`${name}: ${e.join(" ")}`, "info");
      } else if (action?.startsWith("📋")) {
        const hist = getEmojiHistory(ctx);
        if (hist.length === 0) ctx.ui.notify("No history in past 24h", "info");
        else hist.slice(0, 10).forEach((h, i) => {
          ctx.ui.notify(`${i + 1}. ${h.emoji} - ${formatTimeAgo(h.timestamp)}${h.sessionId === ctx.sessionManager.getSessionId() ? " (current)" : ""}`, "info");
        });
      }
    },
  });

  // ── Emoji: History Command ──

  pi.registerCommand("emoji-history", {
    description: "Show emoji history (24h)", handler: async (_, ctx) => {
      const hist = getEmojiHistory(ctx);
      if (hist.length === 0) { ctx.ui.notify("No history in past 24h", "info"); return; }
      const unique = new Set(hist.map(h => h.emoji));
      ctx.ui.notify(`📊 Emoji History - ${hist.length} sessions, ${unique.size} unique`, "info");
      hist.slice(0, 15).forEach((h, i) => {
        ctx.ui.notify(`${i + 1}. ${h.emoji} - ${formatTimeAgo(h.timestamp)}${h.sessionId === ctx.sessionManager.getSessionId() ? " (current)" : ""}`, "info");
      });
    },
  });

  // ========================================================================
  // Commands: Color
  // ========================================================================

  pi.registerCommand("color", {
    description: "Toggle session color on/off", handler: async (_, ctx) => {
      const config = getColorConfig();
      color.enabledOverride = !(color.enabledOverride ?? config.enabledByDefault);
      if (!color.enabledOverride) { ctx.ui.setStatus("0-color-band", ""); ctx.ui.notify("Color: OFF", "info"); }
      else { updateColorStatus(ctx, config); ctx.ui.notify(`Color: ON (${color.colorIndex})`, "info"); }
    },
  });

  // ── Color: Set Command ──

  pi.registerCommand("color-set", {
    description: "Set session color by index (0-39)", handler: async (args, ctx) => {
      const input = parseInt(args?.trim() ?? "");
      if (isNaN(input) || input < 0 || input >= COLOR_PALETTE.length) {
        ctx.ui.notify(`Usage: /color-set <0-${COLOR_PALETTE.length - 1}>. Pick from palette:`, "warning");
        const blocks = COLOR_PALETTE.map((c, i) => `\x1b[38;5;${c}m${i.toString().padStart(2)}${RESET}`).join(" ");
        ctx.ui.notify(blocks, "info");
        return;
      }
      color.colorIndex = input; color.assigned = true;
      writeColorState({ lastColorIndex: input, sessionId: ctx.sessionManager.getSessionId(), timestamp: Date.now() });
      updateColorStatus(ctx, getColorConfig());
      ctx.ui.notify(`Color set to index ${input}`, "info");
    },
  });

  // ── Color: Next Command ──

  pi.registerCommand("color-next", {
    description: "Cycle to next color", handler: async (_, ctx) => {
      if (color.colorIndex === null) { ctx.ui.notify("No color assigned", "error"); return; }
      color.colorIndex = (color.colorIndex + 1) % COLOR_PALETTE.length;
      color.assigned = true;
      writeColorState({ lastColorIndex: color.colorIndex, sessionId: ctx.sessionManager.getSessionId(), timestamp: Date.now() });
      updateColorStatus(ctx, getColorConfig());
      ctx.ui.notify(`Color: ${color.colorIndex}`, "info");
    },
  });

  // ── Color: Block Char Command ──

  pi.registerCommand("color-char", {
    description: "Set or cycle block character", handler: async (args, ctx) => {
      const config = getColorConfig();
      const input = (args ?? "").trim();
      if (color.colorIndex === null) { ctx.ui.notify("No color assigned yet", "error"); return; }
      if (input) { color.blockCharOverride = input; updateColorStatus(ctx, config); ctx.ui.notify(`Block char: "${input}"`, "info"); return; }
      color.blockCharIndex = (color.blockCharIndex + 1) % BLOCK_CHARS.length;
      const next = BLOCK_CHARS[color.blockCharIndex];
      color.blockCharOverride = next.char;
      updateColorStatus(ctx, config);
      ctx.ui.notify(`${next.char} ${next.name}`, "info");
    },
  });

  // ── Color: Config Command ──

  pi.registerCommand("color-config", {
    description: "View color settings", handler: async (_, ctx) => {
      const config = getColorConfig();
      const enabled = color.enabledOverride ?? config.enabledByDefault;
      const persisted = readColorState();
      ctx.ui.notify(`─── Session Color ───\nStatus: ${enabled ? "🎨 ON" : "⬜ OFF"}  │  Index: ${color.colorIndex ?? "(none)"}\nChar: "${color.blockCharOverride ?? config.blockChar}"  │  Palette: ${COLOR_PALETTE.length} colors`, "info");
      if (persisted) ctx.ui.notify(`Last used: index ${persisted.lastColorIndex}`, "info");
      if (!ctx.hasUI) return;
      const action = await ctx.ui.select("Options", ["🎨 Preview all colors", "🔄 Reset sequence", "❌ Cancel"]);
      if (action?.startsWith("🎨")) {
        for (let i = 0; i < COLOR_PALETTE.length; i += 10) {
          ctx.ui.notify(COLOR_PALETTE.slice(i, i + 10).map(c => `\x1b[38;5;${c}m██${RESET}`).join(" "), "info");
        }
      } else if (action?.startsWith("🔄")) {
        writeColorState({ lastColorIndex: -1, sessionId: "", timestamp: Date.now() });
        ctx.ui.notify("Sequence reset. Next session starts at color 0.", "info");
      }
    },
  });

  // ========================================================================
  // Hooks
  // ========================================================================

  pi.on("session_start", async (_, ctx) => {
    initColor(ctx);
    await initEmoji(ctx);
  });

  pi.on("session_switch", async (event, ctx) => {
    if (event.reason === "new") {
      initColor(ctx);
      await initEmoji(ctx);
    }
  });

  pi.on("agent_start", async (_, ctx) => {
    await handleEmojiAgentStart(ctx);
  });
}

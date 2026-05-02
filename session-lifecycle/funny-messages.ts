/**
 * Funny Messages Extension — Replaces "Working..." spinner with random food/cooking humor.
 *
 * Extracted from session-lifecycle/notifications.ts to separate concerns.
 *
 * Commands:
 *   /fun-working  — Toggle funny working messages on/off
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

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
// Extension
// ============================================================================

export default function (pi: ExtensionAPI) {
  let funnyOverride = false;

  // ── Command ──

  pi.registerCommand("fun-working", {
    description: "Toggle funny working messages",
    handler: async (_args, ctx) => {
      funnyOverride = !funnyOverride;
      if (!funnyOverride) {
        ctx.ui.setWorkingMessage();
        ctx.ui.notify("Default working message restored", "info");
      } else {
        if (!ctx.isIdle()) ctx.ui.setWorkingMessage(pickFunny());
        ctx.ui.notify("😂 Funny working messages: ON", "info");
      }
    },
  });

  // ── Hooks ──

  pi.on("agent_start", (_event, ctx) => {
    if (funnyOverride && ctx.hasUI) ctx.ui.setWorkingMessage(pickFunny());
  });

  pi.on("agent_end", (_, ctx) => {
    if (funnyOverride && ctx.hasUI) ctx.ui.setWorkingMessage();
  });
}

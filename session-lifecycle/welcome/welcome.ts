/**
 * Welcome Module — Persistent welcome header + auto session naming.
 *
 * Provides:
 * - Persistent welcome header with mascot, shortcuts, tips
 * - Auto-naming sessions from the first user message
 * - Commands: /welcome-toggle, /welcome-builtin
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ============================================================================
// Constants
// ============================================================================

const STATUS_KEY = "welcome-header";
const SESSION_NAME_STATUS_KEY = "session-name";
const MAX_NAME_LENGTH = 60;

// ============================================================================
// Session Name Logic
// ============================================================================

export function sessionNameFromMessage(text: string): string {
  let cleaned = text.replace(/^\/\S+\s*/, "").trim();
  if (!cleaned) cleaned = text.replace(/^\//, "").trim();
  if (cleaned.length > MAX_NAME_LENGTH) {
    const truncated = cleaned.slice(0, MAX_NAME_LENGTH);
    const lastSpace = truncated.lastIndexOf(" ");
    cleaned = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  }
  return cleaned || `Session ${new Date().toLocaleDateString()}`;
}

// ============================================================================
// Welcome Module
// ============================================================================

export class WelcomeModule {
  private welcomeEnabled = true;
  private firstMessageSeen = false;

  register(pi: ExtensionAPI): void {
    // ── Session lifecycle ──────────────────────────────────────

    pi.on("session_start", async (_event, ctx) => {
      if (!ctx.hasUI) return;

      this.firstMessageSeen = false;

      // Check for existing session name
      const existingName = pi.getSessionName();
      if (existingName) {
        this.firstMessageSeen = true;
        ctx.ui.setStatus(SESSION_NAME_STATUS_KEY, ctx.ui.theme.fg("dim", `💬  Session: ${existingName}`));
      }

      // Set welcome header
      if (this.welcomeEnabled) {
        this.setWelcomeHeader(ctx);
      }

      ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", this.welcomeEnabled ? "🖖  Welcome: on" : "🖖  Welcome: off"));
    });

    pi.on("input", async (event, ctx) => {
      if (this.firstMessageSeen) return { action: "continue" };
      if (!event.text.trim()) return { action: "continue" };

      this.firstMessageSeen = true;
      const name = sessionNameFromMessage(event.text);
      pi.setSessionName(name);

      if (ctx.hasUI) {
        ctx.ui.setStatus(SESSION_NAME_STATUS_KEY, ctx.ui.theme.fg("dim", `💬  Session: ${name}`));
      }

      return { action: "continue" };
    });

    pi.on("session_shutdown", async (_event, ctx) => {
      this.firstMessageSeen = false;
      if (ctx.hasUI) {
        ctx.ui.setStatus(STATUS_KEY, undefined);
        ctx.ui.setStatus(SESSION_NAME_STATUS_KEY, undefined);
      }
    });

    // ── Commands ──────────────────────────────────────────────

    pi.registerCommand("welcome-toggle", {
      description: "Toggle the persistent welcome header on/off",
      handler: async (_args, ctx) => {
        this.welcomeEnabled = !this.welcomeEnabled;
        if (this.welcomeEnabled) {
          this.setWelcomeHeader(ctx);
          ctx.ui.notify("Welcome header enabled", "info");
        } else {
          ctx.ui.setHeader(undefined);
          ctx.ui.notify("Welcome header disabled, built-in header restored", "info");
        }
        if (ctx.hasUI) {
          ctx.ui.setStatus(
            STATUS_KEY,
            ctx.ui.theme.fg("dim", this.welcomeEnabled ? "🖖  Welcome: on" : "🖖  Welcome: off"),
          );
        }
      },
    });

    pi.registerCommand("welcome-builtin", {
      description: "Restore the built-in collapsible startup header",
      handler: async (_args, ctx) => {
        ctx.ui.setHeader(undefined);
        ctx.ui.notify("Built-in header restored", "info");
      },
    });
  }

  // ── Header Rendering ────────────────────────────────────────

  private setWelcomeHeader(ctx: { hasUI: boolean; ui: any }) {
    if (!ctx.hasUI) return;

    ctx.ui.setHeader((_tui: any, theme: any) => {
      const piBlue = (text: string) => theme.fg("accent", text);
      const dim = (text: string) => theme.fg("dim", text);
      const green = (text: string) => theme.fg("success", text);
      const yellow = (text: string) => theme.fg("warning", text);
      const cyan = (text: string) => theme.fg("accent", text);
      const muted = (text: string) => theme.fg("muted", text);

      const block = "█";
      const pupil = "▌";
      const eye = `${block}${pupil}`;
      const lineEyes = `     ${eye}  ${eye}`;
      const lineBar = `  ${piBlue(block.repeat(14))}`;
      const lineLeg = `     ${piBlue(block.repeat(2))}    ${piBlue(block.repeat(2))}`;
      const mascot = ["", lineEyes, lineBar, lineLeg, lineLeg, lineLeg, lineLeg];

      const shortcuts = [
        `${dim("Shortcuts:")}  ${yellow("Ctrl+I")} interrupt  ${yellow("Ctrl+L")} clear  ${yellow("Ctrl+D")} exit  ${yellow("/")} commands  ${yellow("!")} bash  ${green("Ctrl+O")} expand tools  ${cyan("Tab")} cycle model`,
      ];

      const tips = [
        `${dim("Tip:")} Pi can explain its own features and look up its docs. Ask how to use or extend Pi.`,
      ];

      const resources = [
        `${muted("Resources:")}  ${dim("Docs: /docs")}  ${dim("Skills: /skills")}  ${dim("Extensions: Ctrl+E")}`,
      ];

      const allLines = [...mascot, "", ...shortcuts, ...tips, ...resources, ""];

      return {
        render(_width: number): string[] {
          return allLines;
        },
        invalidate() {},
      };
    });
  }
}

/** Convenience default export */
export default function (pi: ExtensionAPI) {
  const module = new WelcomeModule();
  module.register(pi);
}

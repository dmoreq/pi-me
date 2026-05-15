/**
 * CommandBuilder — DRY command registration for pi-me extensions.
 *
 * Provides reusable patterns for common command types:
 * - toggle: Enable/disable toggle for a boolean setting
 * - status: Show current extension status
 *
 * All follow consistent patterns — /<name>, /<name>-<action> — so users
 * have a uniform experience across extensions.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ============================================================================
// Toggle Command
// ============================================================================

export interface ToggleOptions {
  name: string;
  description: string;
  getState: () => boolean;
  setState: (enabled: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}

/**
 * Register a toggle command pair: /<name> and /<name>-on / /<name>-off.
 *
 * Usage:
 *   CommandBuilder.toggle(pi, {
 *     name: "pruning",
 *     description: "Toggle context pruning on/off",
 *     getState: () => pruningEnabled,
 *     setState: (v) => { pruningEnabled = v; },
 *   });
 *   // Registers: /pruning (toggle), /pruning-on, /pruning-off
 */
export function registerToggleCommand(
  pi: ExtensionAPI,
  opts: ToggleOptions,
): void {
  pi.registerCommand(opts.name, {
    description: opts.description,
    handler: async (_args, ctx) => {
      const current = opts.getState();
      opts.setState(!current);
      ctx.ui.notify(
        !current
          ? `🟢 ${opts.onLabel ?? `${opts.name}: ON`}`
          : `🔴 ${opts.offLabel ?? `${opts.name}: OFF`}`,
        "info",
      );
    },
  });

  pi.registerCommand(`${opts.name}-on`, {
    description: `Enable ${opts.name}`,
    handler: async (_args, ctx) => {
      opts.setState(true);
      ctx.ui.notify(`🟢 ${opts.onLabel ?? `${opts.name}: ON`}`, "info");
    },
  });

  pi.registerCommand(`${opts.name}-off`, {
    description: `Disable ${opts.name}`,
    handler: async (_args, ctx) => {
      opts.setState(false);
      ctx.ui.notify(`🔴 ${opts.offLabel ?? `${opts.name}: OFF`}`, "info");
    },
  });
}

// ============================================================================
// Status Command
// ============================================================================

export interface StatusOptions {
  name: string;
  description: string;
  getStatusLines: (ctx: ExtensionContext) => string[];
}

/**
 * Register a status command: /<name>-status.
 *
 * Usage:
 *   CommandBuilder.status(pi, {
 *     name: "memory",
 *     description: "Show memory status",
 *     getStatusLines: (ctx) => [`Facts: 42`, `Lessons: 7`],
 *   });
 *   // Registers: /memory-status
 */
export function registerStatusCommand(
  pi: ExtensionAPI,
  opts: StatusOptions,
): void {
  pi.registerCommand(`${opts.name}-status`, {
    description: opts.description,
    handler: async (_args, ctx) => {
      const lines = opts.getStatusLines(ctx);
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

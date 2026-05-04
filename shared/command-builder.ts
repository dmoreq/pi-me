/**
 * CommandBuilder — DRY command registration for pi-me extensions.
 *
 * Provides reusable patterns for common command types:
 * - settings: Configuration dialog with selectable values
 * - toggle: Enable/disable toggle for a boolean setting
 * - status: Show current extension status
 *
 * All follow consistent patterns — /<name>, /<name>-<action> — so users
 * have a uniform experience across extensions.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ============================================================================
// Settings Command
// ============================================================================

export interface SettingDefinition<T extends Record<string, any>> {
  /** Label shown in the TUI settings list */
  label: string;
  /** Current value */
  value: T[keyof T];
  /** Allowed values */
  values: T[keyof T][];
  /** Description for each value (optional) */
  valueDescriptions?: Record<string, string>;
}

export interface SettingsCommandOptions<T extends Record<string, any>> {
  name: string;
  description: string;
  settings: SettingDefinition<T>[];
  onSave: (key: keyof T, value: T[keyof T]) => void;
}

/**
 * Register a settings command that shows current values and allows toggling.
 * For TUI mode: shows an interactive dialog.
 * For print mode: prints current values.
 *
 * Usage:
 *   CommandBuilder.settings(pi, {
 *     name: "cq-config",
 *     description: "Configure code quality behavior",
 *     settings: [
 *       { label: "Auto-format", value: true, values: [true, false] },
 *     ],
 *     onSave: (key, value) => { config[key] = value; },
 *   });
 */
export function registerSettingsCommand<T extends Record<string, any>>(
  pi: ExtensionAPI,
  opts: SettingsCommandOptions<T>,
): void {
  pi.registerCommand(opts.name, {
    description: opts.description,
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        const lines = opts.settings.map(
          s => `${s.label}: ${s.value}`,
        );
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      // Build interactive selection
      const lines = opts.settings.map(
        (s, i) => `${i + 1}. ${s.label}: ${s.value}`,
      );
      ctx.ui.notify(
        [`${opts.description}:`, ...lines, "", "Edit settings via settings.json directly."].join("\n"),
        "info",
      );
    },
  });
}

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

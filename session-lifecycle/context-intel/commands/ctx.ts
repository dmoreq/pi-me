/**
 * Unified /ctx command — replaces 6 separate /cp-* commands.
 *
 * Usage:
 *   /ctx stats           — Show unified stats (pruning + memory + context)
 *   /ctx pruning on|off  — Toggle pruning pipeline
 *   /ctx memory on|off   — Toggle memory persistence
 *   /ctx compact on|off  — Toggle auto-compaction
 *   /ctx recap on|off    — Toggle auto-recap
 *   /ctx debug on|off    — Toggle debug logging
 *   /ctx config          — Show current ContextIntelConfig
 */

import type { ContextIntelConfig } from "../types.js";
import type { ContextMonitor } from "../core/context-monitor.js";

export function createCtxCommand(
  config: ContextIntelConfig,
  monitor: ContextMonitor,
) {
  return {
    description: "Control context intelligence features: /ctx [stats|pruning|memory|compact|recap|debug|config]",
    handler: async (args: string, ctx: any) => {
      const trimmed = args.trim().toLowerCase();

      if (!trimmed || trimmed === "stats") {
        const stats = monitor.getStats();
        const lines = [
          "─── Context Intelligence Stats ───",
          `Messages: ${stats.messageCount}`,
          `Turns: ${stats.turnCount}`,
          `Tool calls: ${stats.toolCallCount}`,
          `Bash calls: ${stats.bashCallCount}`,
          `Files touched: ${stats.touchedFiles.length}`,
          `Pruned: ${stats.prunedCount}/${stats.totalProcessed}`,
          `Token usage: ${stats.tokenUsage ? `${Math.round((stats.tokenUsage.total / (stats.tokenUsage.contextWindow || 1)) * 100)}%` : "N/A"}`,
        ];
        // Also show touched files if any
        if (stats.touchedFiles.length > 0) {
          lines.push(`\nFiles: ${stats.touchedFiles.slice(0, 10).join(", ")}${stats.touchedFiles.length > 10 ? "..." : ""}`);
        }
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      if (trimmed === "config") {
        ctx.ui.notify(JSON.stringify(config, null, 2), "info");
        return;
      }

      const parts = trimmed.split(/\s+/);
      const feature = parts[0];
      const action = parts[1];

      if (!action || (action !== "on" && action !== "off")) {
        ctx.ui.notify("Usage: /ctx <feature> on|off", "warning");
        return;
      }

      const enabled = action === "on";
      switch (feature) {
        case "pruning":
          config.pruning.enabled = enabled;
          ctx.ui.notify(`Pruning ${enabled ? "enabled" : "disabled"}`, "info");
          break;
        case "memory":
          config.memory.autoConsolidate = enabled;
          ctx.ui.notify(`Memory auto-consolidation ${enabled ? "enabled" : "disabled"}`, "info");
          break;
        case "compact":
          config.automation.autoCompactEnabled = enabled;
          ctx.ui.notify(`Auto-compaction ${enabled ? "enabled" : "disabled"}`, "info");
          break;
        case "recap":
          config.automation.autoRecapEnabled = enabled;
          ctx.ui.notify(`Auto-recap ${enabled ? "enabled" : "disabled"}`, "info");
          break;
        case "debug":
          config.pruning.rules = config.pruning.rules; // no-op, debug flag lives on config
          ctx.ui.notify(`Debug mode ${enabled ? "enabled" : "disabled"} (will log pruning decisions to console)`, "info");
          break;
        default:
          ctx.ui.notify(`Unknown feature: ${feature}. Use: pruning, memory, compact, recap, debug`, "warning");
      }
    },
  };
}

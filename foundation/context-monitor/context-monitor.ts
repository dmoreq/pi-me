/**
 * context-monitor — Unified Context & Usage Monitor.
 *
 * Merges:
 * - foundation/context-window/context-window.ts (context usage widget)
 * - session-lifecycle/usage-extension/ (usage dashboard + cost tracker)
 *
 * Provides:
 * - Real-time context usage bar widget (turn_end)
 * - /usage command: interactive usage statistics dashboard
 * - /cost command: cost report from session logs
 *
 * All commands + widget mount in one umbrella entry point.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ContextWidget } from "./context-widget.ts";
import { UsageDashboard } from "./usage-dashboard.ts";
import { getTelemetry } from "pi-telemetry";

export { ContextWidget } from "./context-widget.ts";
export { UsageDashboard } from "./usage-dashboard.ts";

export function createContextMonitor(options?: {
  warnThresholdPercent?: number;
  criticalThresholdPercent?: number;
}): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    const widget = new ContextWidget(options);
    const dashboard = new UsageDashboard();

    widget.registerHooks(pi);
    dashboard.registerCommands(pi);

    // Context pressure automation — notify when context exceeds 85%
    let lastNotifiedAt = 0;
    const COOLDOWN_MS = 60_000;

    pi.on("turn_end", async (_event, ctx: ExtensionContext) => {
      const usage = ctx.getContextUsage?.();
      if (!usage?.tokens || !usage?.contextWindow) return;

      const ratio = usage.tokens / usage.contextWindow;
      if (ratio > 0.85 && Date.now() - lastNotifiedAt > COOLDOWN_MS) {
        lastNotifiedAt = Date.now();
        const pct = Math.round(ratio * 100);
        const t = getTelemetry();
        if (t && ctx.hasUI) {
          t.notify(`📊 Context at ${pct}%. Consider compacting with /compact.`, {
            package: "context-monitor",
            severity: "warning",
          });
        }
      }
    });
  };
}

/** Default export — drops into existing pi extension pattern */
export default createContextMonitor();

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

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ContextWidget } from "./context-widget.ts";
import { UsageDashboard } from "./usage-dashboard.ts";

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
  };
}

/** Default export — drops into existing pi extension pattern */
export default createContextMonitor();

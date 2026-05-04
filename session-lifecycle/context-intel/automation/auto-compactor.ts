/**
 * Auto Compactor — automatically compacts context when usage exceeds threshold.
 *
 * Previously, Context Intel only *suggested* /recap when >20 messages and idle.
 * Now it *executes* compaction when context usage hits the configured threshold (default 80%).
 *
 * Flow:
 * 1. onTurnEnd: check context usage ratio
 * 2. If over threshold, run pruning pipeline first
 * 3. If still over threshold, call ctx.compact() with a summary of recent messages
 * 4. Notify via telemetry
 */

import type { ContextMonitor } from "../core/context-monitor.js";
import type { WorkflowEngine } from "../pruning/workflow.js";
import type { AutomationConfig } from "../types.js";
import type { TranscriptBuilder } from "../core/transcript-builder.js";
import { TelemetryAutomation } from "./triggers.js";

export class AutoCompactor {
  constructor(
    private config: AutomationConfig,
    private monitor: ContextMonitor,
    private pruning: WorkflowEngine,
  ) {}

  async checkAndCompact(ctx: any): Promise<boolean> {
    if (!this.config.autoCompactEnabled) return false;

    const ratio = this.monitor.getContextUsageRatio();
    if (ratio === null || ratio < this.config.autoCompactThreshold / 100) return false;

    // Pruning already runs on every context event, but run it proactively here too
    const messages = ctx.messages ?? [];
    if (messages.length > 0) {
      const pruned = this.pruning.run(messages);
      const { TranscriptBuilder } = await import("../core/transcript-builder.js");
      const summary = TranscriptBuilder.buildCompactSummary(pruned.slice(-10));

      try {
        await ctx.compact({ summary });
        TelemetryAutomation.autoCompacted(Math.round(ratio * 100));
        this.monitor.markRecap();
        return true;
      } catch {
        // Compact failed silently — no action needed
        return false;
      }
    }

    return false;
  }
}

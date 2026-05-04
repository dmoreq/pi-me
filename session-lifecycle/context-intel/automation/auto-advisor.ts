/**
 * Auto Advisor — smart suggestions based on unified session signals.
 *
 * Replaces the ad-hoc `if (messageCount > 20 && timeSinceRecap > 10min)` check
 * with a composable trigger system. Each trigger checks session stats and
 * fires a notification (with cooldown) when conditions are met.
 */

import { getTelemetry } from "pi-telemetry";
import type { SessionStats } from "../types.js";
import type { AutoAdviceTrigger } from "../types.js";

const TRIGGERS: AutoAdviceTrigger[] = [
  {
    id: "deep-context",
    check: (stats) => stats.messageCount > 50
      ? `Context is deep (${stats.messageCount} messages). Consider /handoff to start fresh.`
      : null,
    cooldownMs: 300_000, // 5 min
  },
  {
    id: "high-activity",
    check: (stats) => stats.toolCallCount > 10
      ? `🔥 ${stats.toolCallCount} tool calls this session — consider a checkpoint.`
      : null,
    cooldownMs: 120_000, // 2 min
  },
  {
    id: "many-files",
    check: (stats) => stats.touchedFiles.length > 15
      ? `📁 ${stats.touchedFiles.length} files touched — ready for /handoff when you are.`
      : null,
    cooldownMs: 120_000,
  },
  {
    id: "bash-heavy",
    check: (stats) => stats.bashCallCount > 20
      ? `🐚 ${stats.bashCallCount} bash commands run — review for repeatable patterns.`
      : null,
    cooldownMs: 300_000,
  },
];

export class AutoAdvisor {
  private lastFired = new Map<string, number>();

  async run(stats: SessionStats, _ctx: any): Promise<void> {
    for (const trigger of TRIGGERS) {
      const last = this.lastFired.get(trigger.id) ?? 0;
      if (Date.now() - last < trigger.cooldownMs) continue;

      const advice = trigger.check(stats);
      if (advice) {
        getTelemetry()?.notify(advice, {
          package: "context-intel-v2",
          severity: "info",
          badge: { text: trigger.id, variant: "info" },
        });
        this.lastFired.set(trigger.id, Date.now());
      }
    }
  }
}

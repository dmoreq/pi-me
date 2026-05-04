/**
 * Telemetry Automation Triggers
 *
 * 9 automation hooks + 3 auto-execution events that fire badge notifications.
 * Consolidated from shared/telemetry-automation.ts into context-intel-v2.
 */

import { getTelemetry } from "pi-telemetry";

export class TelemetryAutomation {
  static contextDepth(messageCount: number): void {
    if (messageCount >= 50) {
      getTelemetry()?.notify(`Context is deep (${messageCount} messages). Consider /handoff to start fresh.`, {
        package: "context-intel-v2", severity: "info",
        badge: { text: "context-depth", variant: "warning" },
      });
    }
  }

  static highActivity(toolCallCount: number): void {
    if (toolCallCount > 5) {
      getTelemetry()?.notify(`🔥 High activity detected (${toolCallCount} tool calls).`, {
        package: "context-intel-v2", severity: "info",
        badge: { text: "high-activity", variant: "warning" },
      });
    }
  }

  static fileInvolvement(fileCount: number): void {
    if (fileCount > 10) {
      getTelemetry()?.notify(`📁 Many files involved (${fileCount}). Ready for /handoff.`, {
        package: "context-intel-v2", severity: "info",
        badge: { text: "files-involved", variant: "info" },
      });
    }
  }

  static planCreated(title: string): void {
    getTelemetry()?.notify(`📋 Plan created: "${title}".`, {
      package: "context-intel-v2", severity: "info",
      badge: { text: "plan-created", variant: "success" },
    });
  }

  static parallelTasks(count: number): void {
    if (count >= 3) {
      getTelemetry()?.notify(`⚡ ${count} independent tasks found. Consider parallel execution.`, {
        package: "context-intel-v2", severity: "info",
        badge: { text: "parallel-hint", variant: "info" },
      });
    }
  }

  static fileIndexed(path: string): void {
    getTelemetry()?.notify(`📚 Indexed: ${path}`, {
      package: "context-intel-v2", severity: "info",
      badge: { text: "indexed", variant: "success" },
    });
  }

  static webSearched(query: string): void {
    getTelemetry()?.notify(`🔍 Searching web for: "${query}"`, {
      package: "context-intel-v2", severity: "info",
      badge: { text: "searching", variant: "info" },
    });
  }

  static qualityCheck(path: string, stage: string): void {
    getTelemetry()?.notify(`✨ Running ${stage} on ${path}...`, {
      package: "context-intel-v2", severity: "info",
      badge: { text: stage, variant: "info" },
    });
  }

  // NEW: Auto-execution events
  static autoCompacted(ratio: number): void {
    getTelemetry()?.notify(`📦 Auto-compacted at ${ratio}% — preserved recent context.`, {
      package: "context-intel-v2", severity: "info",
      badge: { text: "auto-compact", variant: "warning" },
    });
  }

  static autoRecapped(sessionId: string): void {
    getTelemetry()?.notify(`📋 Auto-recap saved for session ${sessionId.slice(0, 8)}.`, {
      package: "context-intel-v2", severity: "info",
      badge: { text: "auto-recap", variant: "success" },
    });
  }

  static memoryConsolidated(facts: number, lessons: number): void {
    getTelemetry()?.notify(`🧠 Learned ${facts} facts, ${lessons} lessons from this session.`, {
      package: "context-intel-v2", severity: "info",
      badge: { text: "memory-learned", variant: "success" },
    });
  }
}

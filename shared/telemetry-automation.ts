/**
 * Telemetry Automation Triggers
 *
 * 9 automation hooks that fire badge notifications when conditions met.
 * Used by extensions to surface context and automation hints to the user.
 */

import type { ExtensionLifecycle } from "./lifecycle.ts";
import { recordEvent } from "pi-telemetry/helpers";

export interface AutomationTrigger {
  id: string;
  condition: boolean;
  message: string;
  badge: {
    text: string;
    variant: "info" | "warning" | "success" | "error";
  };
}

/**
 * Telemetry automation triggers (9 total)
 */
export class TelemetryAutomation {
  /**
   * Trigger 1: Context depth warning
   * Fires when conversation exceeds 50 messages
   */
  static contextDepth(messageCount: number): AutomationTrigger | null {
    if (messageCount >= 50) {
      return {
        id: "context-depth",
        condition: true,
        message: `Context is deep (${messageCount} messages). Consider /handoff to start fresh.`,
        badge: { text: "context-depth", variant: "warning" },
      };
    }
    return null;
  }

  /**
   * Trigger 2: High activity detection
   * Fires when >5 tool calls in recent session
   */
  static highActivityDetected(toolCallCount: number): AutomationTrigger | null {
    if (toolCallCount > 5) {
      return {
        id: "high-activity",
        condition: true,
        message: `🔥 High activity detected (${toolCallCount} tool calls). Consider checkpointing with /recap.`,
        badge: { text: "high-activity", variant: "warning" },
      };
    }
    return null;
  }

  /**
   * Trigger 3: File involvement detection
   * Fires when >10 files have been touched
   */
  static fileInvolvementDetected(fileCount: number): AutomationTrigger | null {
    if (fileCount > 10) {
      return {
        id: "files-involved",
        condition: true,
        message: `📁 Many files involved (${fileCount}). Ready for /handoff when you are.`,
        badge: { text: "files-involved", variant: "info" },
      };
    }
    return null;
  }

  /**
   * Trigger 4: Plan creation tracking
   * Fires whenever a new plan is created (informational)
   */
  static planCreated(planTitle: string): AutomationTrigger {
    return {
      id: "plan-created",
      condition: true,
      message: `📋 Plan created: "${planTitle}". Use /plan to manage steps.`,
      badge: { text: "plan-created", variant: "success" },
    };
  }

  /**
   * Trigger 5: Parallel task detection
   * Fires when 3+ independent tasks detected in DAG
   */
  static parallelTasksDetected(independentCount: number): AutomationTrigger | null {
    if (independentCount >= 3) {
      return {
        id: "parallel-tasks",
        condition: true,
        message: `⚡ ${independentCount} independent tasks found. Consider parallel execution.`,
        badge: { text: "parallel-hint", variant: "info" },
      };
    }
    return null;
  }

  /**
   * Trigger 6: File indexing telemetry
   * Fires when files are indexed (informational)
   */
  static fileIndexed(filePath: string): AutomationTrigger {
    return {
      id: "file-indexed",
      condition: true,
      message: `📚 Indexed: ${filePath}`,
      badge: { text: "indexed", variant: "success" },
    };
  }

  /**
   * Trigger 7: Task normalization tracking
   * Fires when plan steps are normalized to subprocess tasks
   */
  static tasksNormalized(stepCount: number): AutomationTrigger {
    return {
      id: "tasks-normalized",
      condition: true,
      message: `✓ Normalized ${stepCount} plan steps for execution.`,
      badge: { text: "normalized", variant: "success" },
    };
  }

  /**
   * Trigger 8: Web search telemetry
   * Fires on web search (informational)
   */
  static webSearched(query: string): AutomationTrigger {
    return {
      id: "web-search",
      condition: true,
      message: `🔍 Searching web for: "${query}"`,
      badge: { text: "searching", variant: "info" },
    };
  }

  /**
   * Trigger 9: Code quality pipeline
   * Fires when format/fix/analyze pipeline runs
   */
  static qualityCheckRan(filePath: string, stage: string): AutomationTrigger {
    return {
      id: "quality-check",
      condition: true,
      message: `✨ Running ${stage} on ${filePath}...`,
      badge: { text: stage, variant: "info" },
    };
  }

  /**
   * Execute a trigger if condition is met.
   * Returns the trigger if it fired, null otherwise.
   */
  static fire(ext: ExtensionLifecycle, trigger: AutomationTrigger | null): void {
    if (!trigger) return;

    ext.notify(trigger.message, {
      severity: trigger.badge.variant === "error" ? "error" : "info",
      badge: { text: trigger.badge.text, variant: trigger.badge.variant },
    });

    // Also emit as domain event for /telemetry events timeline
    recordEvent(ext.name, trigger.id, trigger.message);
  }
}

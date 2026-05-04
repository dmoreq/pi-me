/**
 * AutomationManager — telemetry-driven automated actions for pi-me extensions.
 *
 * Core design:
 *   Sense → Decide → Act → Inform
 *
 * Each extension has an AutomationManager that:
 * 1. Monitors conditions (context pressure, message count, time elapsed, etc.)
 * 2. Decides whether to notify the user or take automatic action
 * 3. Executes the action (auto-compact, auto-consolidate, etc.)
 * 4. Informs the user via pi-telemetry badge notifications
 *
 * All automation is configurable via settings.json:
 *   { "automation": { "autoCompact": true, "autoConsolidateMemory": true, ... } }
 */

import type { ExtensionLifecycle } from "./lifecycle.ts";

// ============================================================================
// Types
// ============================================================================

export interface AutomationAction {
  type: "notify" | "auto-act";
  name: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  badge?: { text: string; variant?: string };
  /** Called if type is "auto-act" — performs the action */
  perform?: () => Promise<void>;
  metadata?: Record<string, unknown>;
}

export interface AutomationCondition {
  /** Evaluate whether the action should fire. */
  evaluate(): AutomationAction | null;
}

export interface AutomationConfig {
  /** Auto-run context compaction when context exceeds threshold */
  autoCompact: boolean;
  /** Auto-consolidate memory when enough messages accumulate */
  autoConsolidateMemory: boolean;
  /** Suggest permission escalation after repeated blocks */
  autoSuggestEscalation: boolean;
  /** Show cost alerts when session cost exceeds this value (USD) */
  maxCostAlert: number;
  /** Minimum interval between same-type notifications (ms) */
  notifyCooldownMs: number;
}

const DEFAULT_CONFIG: AutomationConfig = {
  autoCompact: true,
  autoConsolidateMemory: true,
  autoSuggestEscalation: true,
  maxCostAlert: 5.0,
  notifyCooldownMs: 60_000, // 1 minute
};

// ============================================================================
// Automation Manager
// ============================================================================

export class AutomationManager {
  private config: AutomationConfig;
  private conditions: AutomationCondition[] = [];
  private lastNotifyTime = new Map<string, number>();
  private ext: ExtensionLifecycle;

  constructor(ext: ExtensionLifecycle, config?: Partial<AutomationConfig>) {
    this.ext = ext;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register an automation condition. */
  addCondition(condition: AutomationCondition): void {
    this.conditions.push(condition);
  }

  /** Load config from settings. */
  loadFromSettings(settings?: Partial<AutomationConfig>): void {
    if (settings) {
      this.config = { ...this.config, ...settings };
    }
  }

  /**
   * Evaluate all conditions and execute actions.
   * Returns the number of actions that fired.
   */
  async evaluate(): Promise<number> {
    let fired = 0;

    for (const condition of this.conditions) {
      const action = condition.evaluate();
      if (!action) continue;

      // Cooldown check
      const last = this.lastNotifyTime.get(action.name) ?? 0;
      if (Date.now() - last < this.config.notifyCooldownMs) continue;

      this.lastNotifyTime.set(action.name, Date.now());

      if (action.type === "auto-act" && action.perform) {
        await action.perform();
        this.ext.notify(`✅ Auto-${action.name} completed`, {
          severity: "success",
          badge: action.badge ?? { text: action.name, variant: "success" },
        });
      } else {
        // Just notify
        this.ext.notify(action.message, {
          severity: action.severity,
          badge: action.badge ?? { text: action.name, variant: action.severity as any },
        });
      }

      this.ext.track(`automation:${action.name}`, action.metadata);
      fired++;
    }

    return fired;
  }
}

// ============================================================================
// Built-in Conditions
// ============================================================================

/**
 * Condition that fires when context usage exceeds a threshold.
 */
export class ContextPressureCondition implements AutomationCondition {
  private getRatio: () => number;

  constructor(getRatio: () => number) {
    this.getRatio = getRatio;
  }

  evaluate(): AutomationAction | null {
    const ratio = this.getRatio();
    if (ratio > 0.85) {
      return {
        type: "notify",
        name: "context-pressure",
        message: `📊 Context at ${Math.round(ratio * 100)}%. Consider compacting with /compact.`,
        severity: "warning",
        badge: { text: "high-context", variant: "warning" },
        metadata: { ratio },
      };
    }
    return null;
  }
}

/**
 * Condition that fires when memory has enough pending messages for consolidation.
 */
export class MemoryConsolidationCondition implements AutomationCondition {
  private getPendingCount: () => number;

  constructor(getPendingCount: () => number) {
    this.getPendingCount = getPendingCount;
  }

  evaluate(): AutomationAction | null {
    const count = this.getPendingCount();
    if (count >= 5) {
      return {
        type: "notify",
        name: "memory-consolidation",
        message: `🧠 ${count} new messages ready for memory consolidation.`,
        severity: "info",
        badge: { text: "memory-ready", variant: "info" },
        metadata: { pendingMessages: count },
      };
    }
    return null;
  }
}

/**
 * Condition that fires when a session is stale (>20 messages over 30+ minutes).
 */
export class SessionStaleCondition implements AutomationCondition {
  private elapsedMinutes: number;
  private messageCount: number;

  constructor(elapsedMinutes: number, messageCount: number) {
    this.elapsedMinutes = elapsedMinutes;
    this.messageCount = messageCount;
  }

  evaluate(): AutomationAction | null {
    if (this.elapsedMinutes > 30 && this.messageCount > 20) {
      return {
        type: "notify",
        name: "session-stale",
        message: `⏰ Session has ${this.messageCount} messages over ${Math.round(this.elapsedMinutes)}m. Consider /handoff to start fresh.`,
        severity: "warning",
        badge: { text: "session-stale", variant: "warning" },
        metadata: { elapsedMinutes: this.elapsedMinutes, messageCount: this.messageCount },
      };
    }
    return null;
  }
}

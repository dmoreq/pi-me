/**
 * ExtensionLifecycle — SOLID base class for all pi-me extensions.
 *
 * Principles applied:
 *   Open/Closed  — subclasses extend by overriding optional hook methods
 *   Interface Segregation — all hooks are optional; only override what you need
 *   DRY — telemetry setup, hook wiring, notify/track helpers are written once
 *
 * Usage:
 *   export class MyExtension extends ExtensionLifecycle {
 *     readonly name = "my-ext";
 *     readonly version = "0.3.0";
 *     protected readonly tools = ["my_tool"];
 *     protected readonly events = ["session_start", "tool_call"];
 *
 *     async onSessionStart(event: any, ctx: ExtensionContext) { ... }
 *     async onToolCall(event: any, ctx: ExtensionContext) { ... }
 *   }
 *
 *   // In the umbrella entry point:
 *   export default function(pi: ExtensionAPI) {
 *     new MyExtension(pi).register();
 *   }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";

/** All pi lifecycle event hooks — all optional so subclasses opt-in selectively. */
export interface LifecycleHooks {
  onSessionStart?(event: any, ctx: ExtensionContext): Promise<void>;
  onSessionShutdown?(event: any, ctx: ExtensionContext): Promise<void>;
  onInput?(event: any, ctx: ExtensionContext): Promise<any>;
  onTurnStart?(event: any, ctx: ExtensionContext): Promise<void>;
  onTurnEnd?(event: any, ctx: ExtensionContext): Promise<void>;
  onAgentStart?(event: any, ctx: ExtensionContext): Promise<void>;
  onAgentEnd?(event: any, ctx: ExtensionContext): Promise<void>;
  onToolCall?(event: any, ctx: ExtensionContext): Promise<any>;
  onToolResult?(event: any, ctx: ExtensionContext): Promise<void>;
}

/** Mapping from LifecycleHooks method name → pi event string. */
const HOOK_EVENT_MAP: Array<[keyof LifecycleHooks, string]> = [
  ["onSessionStart",    "session_start"],
  ["onSessionShutdown", "session_shutdown"],
  ["onInput",           "input"],
  ["onTurnStart",       "turn_start"],
  ["onTurnEnd",         "turn_end"],
  ["onAgentStart",      "agent_start"],
  ["onAgentEnd",        "agent_end"],
  ["onToolCall",        "tool_call"],
  ["onToolResult",      "tool_result"],
];

export abstract class ExtensionLifecycle implements LifecycleHooks {
  /** Package name shown in telemetry dashboard. */
  abstract readonly name: string;
  /** Semver version. */
  abstract readonly version: string;

  /** Override to declare tools registered by this extension (for attribution). */
  protected readonly tools?: string[];
  /** Override to set the description shown in telemetry dashboard. */
  protected readonly description?: string;
  /** Override to declare subscribed events (for telemetry metadata). */
  protected readonly events?: string[];

  constructor(protected readonly pi: ExtensionAPI) {}

  /**
   * Wire pi event hooks and register with telemetry.
   * Call once from the umbrella entry point after constructing.
   */
  register(): void {
    // Register with pi-telemetry (no-op when telemetry not loaded)
    const t = getTelemetry();
    if (t) {
      t.register({
        name: this.name,
        version: this.version,
        description: this.description ?? this.name,
        tools: this.tools ?? [],
        events: this.events ?? [],
      });
      t.heartbeat(this.name);
    }

    // Wire only hooks that the subclass actually defines
    for (const [method, event] of HOOK_EVENT_MAP) {
      if (typeof (this as any)[method] === "function") {
        this.pi.on(event as any, (this as any)[method].bind(this));
      }
    }
  }

  /**
   * Send a user-visible badge notification via pi-telemetry.
   * Safe to call when telemetry is not loaded — silently no-ops.
   */
  protected notify(
    message: string,
    opts?: {
      severity?: "info" | "success" | "warning" | "error";
      badge?: { text: string; variant?: string };
    }
  ): void {
    getTelemetry()?.notify(message, {
      package: this.name,
      severity: opts?.severity ?? "info",
      ...(opts?.badge
        ? { badge: { text: opts.badge.text, variant: (opts.badge.variant ?? "info") as any } }
        : {}),
    });
  }

  /**
   * Record a domain event. Uses pi-telemetry's recordEvent() API.
   * The event appears in /telemetry events timeline.
   */
  protected track(event: string, data?: Record<string, unknown>): void {
    try {
      getTelemetry()?.recordEvent(this.name, 'track', event, data);
    } catch {
      // Telemetry is best-effort
    }
  }
}

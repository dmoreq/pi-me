/**
 * Context Intelligence Extension
 *
 * Merges handoff, auto-compact, session-recap, context-pruning, and
 * read-awareness into one umbrella that intelligently manages conversation
 * context across sessions.
 *
 * Plugin system:
 *   - ContextPruningPlugin: deduplicate/remove obsolete messages
 *   - ReadAwarenessPlugin: track reads, block unread edits
 *   (More plugins can be added via PluginManager)
 *
 * Extends ExtensionLifecycle for automatic telemetry and hook wiring.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { TranscriptBuilder } from "./transcript-builder.ts";
import { PromptBuilder } from "./prompt-builder.ts";
import { PluginManager, type PluginToolCallResult } from "./plugins/plugin.ts";
import { ContextPruningPlugin } from "./plugins/context-pruning.ts";
import { ReadAwarenessPlugin } from "./plugins/read-awareness.ts";

export { PluginManager } from "./plugins/plugin.ts";
export { ContextPruningPlugin } from "./plugins/context-pruning.ts";
export { ReadAwarenessPlugin } from "./plugins/read-awareness.ts";

export class ContextIntelExtension extends ExtensionLifecycle {
  readonly name = "context-intel";
  readonly version = "0.5.0";
  protected readonly description = "Intelligent context management: handoff, auto-compact, session recap, pruning, read-awareness";
  protected readonly tools = ["none"];
  protected readonly events = ["session_start", "turn_end", "agent_end", "session_shutdown", "context", "tool_call"];

  private sessionMessageCount = 0;
  private lastRecapAt = 0;
  private sessionStartTime = 0;
  readonly pluginManager: PluginManager;

  constructor(pi: ExtensionAPI) {
    super(pi);
    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: [],
      events: this.events,
    });

    // Initialize plugin system with built-in plugins
    this.pluginManager = new PluginManager();
    this.pluginManager.register(new ContextPruningPlugin());
    this.pluginManager.register(new ReadAwarenessPlugin());
  }

  // ── Lifecycle Hooks ────────────────────────────────────────

  /**
   * Reset on new session and initialize plugins.
   */
  async onSessionStart(_event: any, ctx: ExtensionContext) {
    this.sessionMessageCount = 0;
    this.lastRecapAt = Date.now();
    this.sessionStartTime = Date.now();
    this.notify("Session started. Use /handoff to transfer context or /recap for summary.", {
      severity: "info",
    });

    // Initialize all plugins
    await this.pluginManager.onSessionStart(ctx);
  }

  /**
   * Cleanup plugins on shutdown.
   */
  async onSessionShutdown() {
    await this.pluginManager.onSessionShutdown();
  }

  /**
   * Track message count and suggest recap if idle or long session.
   */
  async onTurnEnd(ctx: ExtensionContext) {
    this.sessionMessageCount++;

    // Check session staleness via automation triggers
    const elapsedMinutes = (Date.now() - this.sessionStartTime) / 60000;
    const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");

    const staleTrigger = TelemetryAutomation.sessionStale(elapsedMinutes, this.sessionMessageCount);
    TelemetryAutomation.fire(this, staleTrigger);

    // Suggest recap if >20 messages and 10+ minutes since last recap
    if (this.sessionMessageCount > 20 && Date.now() - this.lastRecapAt > 10 * 60 * 1000) {
      this.notify("Consider `/recap` to summarize progress.", {
        badge: { text: "recap-hint", variant: "info" },
      });
    }

    // Let plugins handle turn_end
    await this.pluginManager.onTurnEnd(ctx);
  }

  /**
   * Auto-detect if agent output contains hints for handoff or task extraction.
   */
  async onAgentEnd(_event: any, ctx: any) {
    const messages = ctx.messages ?? [];
    if (messages.length === 0) return;

    const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");

    // Count tool calls to detect high activity
    const toolCalls = TranscriptBuilder.countToolCalls(messages, "bash") +
                      TranscriptBuilder.countToolCalls(messages, "write") +
                      TranscriptBuilder.countToolCalls(messages, "edit");

    const highActivityTrigger = TelemetryAutomation.highActivityDetected(toolCalls);
    TelemetryAutomation.fire(this, highActivityTrigger);
    if (highActivityTrigger) this.track("high_activity_detected", { toolCalls });

    // Extract file paths — if many files touched, suggest handoff prep
    const files = TranscriptBuilder.extractFilePaths(messages);
    const filesTrigger = TelemetryAutomation.fileInvolvementDetected(files.length);
    TelemetryAutomation.fire(this, filesTrigger);

    // Check message count for context depth warning
    const contextTrigger = TelemetryAutomation.contextDepth(messages.length);
    TelemetryAutomation.fire(this, contextTrigger);
  }

  /**
   * Context event — run context pruning plugin to optimize messages.
   */
  async onContext(_event: any, _ctx: ExtensionContext) {
    // Context pruning is handled via the plugin system
    // The actual pruning logic is in ContextPruningPlugin.onContext()
    // which modifies messages before they reach the LLM
  }

  /**
   * Tool call interception — delegate to plugin system.
   */
  async onToolCall(event: any, ctx: ExtensionContext): Promise<PluginToolCallResult | undefined> {
    return this.pluginManager.onToolCall(
      { toolName: event.toolName, input: event.input },
      ctx,
    );
  }

  // ── Helpers for CLI commands ───────────────────────────────

  /**
   * Get a one-line recap of the session.
   */
  async getRecap(messages: any[]): Promise<string> {
    const transcript = TranscriptBuilder.buildTranscript(messages, { fromLastUser: false });
    const { system, user } = PromptBuilder.buildRecap(transcript);
    this.track("recap_requested", { messageCount: messages.length });
    return `[Recap would be generated here]`;
  }

  /**
   * Build handoff context for a new session.
   */
  async buildHandoffContext(messages: any[], goal: string): Promise<string> {
    const transcript = TranscriptBuilder.buildTranscript(messages, { fromLastUser: false });
    const { system, user } = PromptBuilder.buildHandoff(transcript, goal);
    this.track("handoff_initiated", { messageCount: messages.length, goal });
    return `System:\n${system}\n\nUser:\n${user}`;
  }

  /**
   * Get auto-compact instructions.
   */
  getCompactInstructions(customInstructions?: string): string {
    return PromptBuilder.buildCompactInstructions(customInstructions);
  }
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new ContextIntelExtension(pi);
  ext.register();
}

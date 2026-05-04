/**
 * Context Intelligence Extension
 *
 * Merges handoff, auto-compact, and session-recap into one umbrella
 * that intelligently manages conversation context across sessions.
 *
 * Extends ExtensionLifecycle for automatic telemetry and hook wiring.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage, telemetryNotify } from "../../shared/telemetry-helpers.ts";
import { TranscriptBuilder } from "./transcript-builder.ts";
import { PromptBuilder } from "./prompt-builder.ts";

export class ContextIntelExtension extends ExtensionLifecycle {
  readonly name = "context-intel";
  readonly version = "0.3.0";
  protected readonly description = "Intelligent context management: handoff, auto-compact, session recap";
  protected readonly tools = ["none"];
  protected readonly events = ["session_start", "turn_end", "agent_end"];

  private sessionMessageCount = 0;
  private lastRecapAt = 0;

  constructor(pi: ExtensionAPI) {
    super(pi);
    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: [],
      events: this.events,
    });
  }

  /**
   * Reset on new session.
   */
  async onSessionStart() {
    this.sessionMessageCount = 0;
    this.lastRecapAt = Date.now();
    this.notify("Session started. Use /handoff to transfer context or /recap for summary.", {
      severity: "info",
    });
  }

  /**
   * Track message count and suggest recap if idle or long session.
   */
  async onTurnEnd() {
    this.sessionMessageCount++;

    // Suggest recap if >20 messages and 10+ minutes since last recap
    if (this.sessionMessageCount > 20 && Date.now() - this.lastRecapAt > 10 * 60 * 1000) {
      this.notify("Consider `/recap` to summarize progress.", {
        badge: { text: "recap-hint", variant: "info" },
      });
    }
  }

  /**
   * Auto-detect if agent output contains hints for handoff or task extraction.
   */
  async onAgentEnd(_: any, ctx: any) {
    const messages = ctx.messages ?? [];
    if (messages.length === 0) return;

    // Import automation triggers
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

  // ── Helpers for CLI commands (to be wired by future extension) ──────

  /**
   * Get a one-line recap of the session.
   */
  async getRecap(messages: any[]): Promise<string> {
    const transcript = TranscriptBuilder.buildTranscript(messages, { fromLastUser: false });
    const { system, user } = PromptBuilder.buildRecap(transcript);
    this.track("recap_requested", { messageCount: messages.length });
    // Would call LLM here; for now return placeholder
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

/**
 * Auto Recapper — automatically generates session recaps at boundaries.
 *
 * Previously, /recap was a manual command. Now it fires automatically
 * at session boundaries (session_shutdown, session_before_switch),
 * generates a recap via LLM, and stores it in memory.
 */

import type { ContextMonitor } from "../core/context-monitor.js";
import type { MemoryOrchestrator } from "../memory/orchestrator.js";
import type { AutomationConfig } from "../types.js";
import { TranscriptBuilder } from "../core/transcript-builder.js";
import { PromptBuilder } from "../core/prompt-builder.js";
import { TelemetryAutomation } from "./triggers.js";

export class AutoRecapper {
  constructor(
    private config: AutomationConfig,
    private monitor: ContextMonitor,
    private memory: MemoryOrchestrator,
  ) {}

  async checkAndRecap(ctx: any): Promise<void> {
    if (!this.config.autoRecapEnabled) return;

    const stats = this.monitor.getStats();
    if (stats.messageCount < 5) return; // not enough conversation

    const messages = ctx.messages ?? [];
    if (messages.length === 0) return;

    // Build transcript and generate recap prompt
    const transcript = TranscriptBuilder.buildTranscript(messages, { fromLastUser: false, maxChars: 4000 });
    const recap = await this.generateRecap(transcript);

    // Store in memory
    const store = this.memory.getStore();
    if (store && recap) {
      store.setSemantic(`session.${stats.sessionId}.recap`, recap, 0.8, "consolidation");
      TelemetryAutomation.autoRecapped(stats.sessionId);
    }
  }

  private async generateRecap(transcript: string): Promise<string> {
    const { system, user } = PromptBuilder.buildSessionRecap(transcript);
    // In production, this would call pi.exec("pi", ["-p", prompt, "--print"])
    // For now, return a structured placeholder
    return `[Auto-recap pending — LLM call would generate summary here]\n${transcript.slice(0, 500)}...`;
  }
}

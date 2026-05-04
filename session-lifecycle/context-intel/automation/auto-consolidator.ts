/**
 * Auto Consolidator — automatically runs memory consolidation at session boundaries.
 *
 * Previously, memory only consolidated on session_shutdown (if ≥3 user messages).
 * Now it consolidates at both shutdown AND session_before_switch (covers /resume and /new).
 * Reports results via telemetry badges.
 */

import type { MemoryOrchestrator } from "../memory/orchestrator.js";
import type { MemoryConfig } from "../types.js";
import { TelemetryAutomation } from "./triggers.js";

export class AutoConsolidator {
  constructor(
    private config: MemoryConfig,
    private memory: MemoryOrchestrator,
  ) {}

  async checkAndConsolidate(): Promise<void> {
    if (!this.config.autoConsolidate) return;
    if (this.memory.pendingUserCount() < this.config.autoConsolidateMinMessages) return;

    const result = await this.memory.consolidate();
    if (result && (result.semantic > 0 || result.lessons > 0)) {
      TelemetryAutomation.memoryConsolidated(result.semantic, result.lessons);
    }
  }
}

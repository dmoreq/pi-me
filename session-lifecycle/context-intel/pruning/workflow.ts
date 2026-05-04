/**
 * Pruning Workflow Engine
 *
 * Implements the prepare → process → filter pipeline.
 * Simplified from session-lifecycle/context-pruning/workflow.ts:
 *   - No registry (5 rules are static)
 *   - No file logger (console.debug + telemetry)
 *   - No MessageWithMetadata wrapper (parallel arrays: messages[] + metas[])
 */

import type { AgentMessage } from "@mariozechner/pi-coding-agent";
import type { PruningConfig, PruningMeta, PruneRule } from "../types.js";
import { deduplicationRule, resetSeenHashes } from "./rules/deduplication.js";
import { supersededWritesRule } from "./rules/superseded-writes.js";
import { errorPurgingRule } from "./rules/error-purging.js";
import { toolPairingRule } from "./rules/tool-pairing.js";
import { recencyRule } from "./rules/recency.js";

const ALL_RULES: Record<string, PruneRule> = {
  deduplication: deduplicationRule,
  "superseded-writes": supersededWritesRule,
  "error-purging": errorPurgingRule,
  "tool-pairing": toolPairingRule,
  recency: recencyRule,
};

export class WorkflowEngine {
  private rules: PruneRule[];

  constructor(private config: PruningConfig) {
    this.rules = config.rules
      .map((name) => ALL_RULES[name])
      .filter(Boolean);
  }

  /**
   * Run the pruning pipeline on a set of messages.
   * Returns filtered messages with pruned items removed.
   */
  run(messages: AgentMessage[]): AgentMessage[] {
    if (!this.config.enabled || messages.length === 0) return messages;

    resetSeenHashes();

    const metas: PruningMeta[] = messages.map(() => ({}));

    // Phase 1: PREPARE — annotate metadata for all rules
    for (const rule of this.rules) {
      if (rule.prepare) {
        for (let i = 0; i < messages.length; i++) {
          try {
            rule.prepare(messages[i], metas[i], {
              messages,
              metas,
              index: i,
              config: this.config,
            });
          } catch (err) {
            console.debug(`[pruning] Error in prepare of "${rule.name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    // Phase 2: PROCESS — make pruning decisions for all rules
    for (const rule of this.rules) {
      if (rule.process) {
        for (let i = 0; i < messages.length; i++) {
          try {
            rule.process(messages[i], metas[i], {
              messages,
              metas,
              index: i,
              config: this.config,
            });
          } catch (err) {
            console.debug(`[pruning] Error in process of "${rule.name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    // Phase 3: FILTER — remove messages marked for pruning
    const filtered = messages.filter((_, i) => !metas[i].shouldPrune);
    const prunedCount = messages.length - filtered.length;

    if (this.config.debug && prunedCount > 0) {
      console.debug(`[pruning] Filtered: ${prunedCount} pruned, ${filtered.length} kept (${messages.length} total)`);
    }

    return filtered;
  }

  /**
   * Get a human-readable stats string for the status bar.
   */
  getStats(original: number, filtered: number): string {
    const pct = original > 0 ? Math.round(((original - filtered) / original) * 100) : 0;
    return `✂️  Pruning: ${original - filtered}/${original} (${pct}%)`;
  }
}

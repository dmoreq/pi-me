/**
 * Recency Rule
 *
 * Always preserves recent messages from pruning.
 * The last N messages (configurable via keepRecentCount) are protected
 * regardless of what other rules decide.
 *
 * This rule should typically run LAST in the process phase to override
 * other pruning decisions for recent messages.
 */

import type { PruneRule } from "../../types.js";

export const recencyRule: PruneRule = {
  name: "recency",
  description: "Always preserve recent messages from pruning",

  process(_msg, meta, ctx) {
    const distanceFromEnd = ctx.messages.length - ctx.index - 1;

    if (distanceFromEnd < ctx.config.keepRecentCount) {
      const wasPruned = meta.shouldPrune;
      meta.shouldPrune = false;
      meta.pruneReason = undefined;
      meta.protectedByRecency = true;

      if (ctx.config.debug && wasPruned) {
        console.debug(
          `[pruning] Recency: protecting index ${ctx.index} ` +
          `(distance: ${distanceFromEnd}, threshold: ${ctx.config.keepRecentCount})`,
        );
      }
    }
  },
};

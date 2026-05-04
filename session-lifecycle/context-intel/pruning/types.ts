/**
 * Pruning-specific types (subset of the unified types for the pipeline).
 *
 * PruneRule and PruningMeta are defined in the parent types.ts.
 * This file only adds pruning-config aliases.
 */

import type { PruningConfig } from "../types.js";

/** Alias for the config used within the pruning pipeline. */
export type { PruningConfig };

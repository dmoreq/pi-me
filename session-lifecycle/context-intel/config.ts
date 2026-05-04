/**
 * Context Intelligence — Unified config loader
 *
 * Replaces 3 separate config systems (bunfig for pruning, JSON settings for memory,
 * inline options for context-window) with one Zod-validated JSONC config.
 *
 * Config file: ~/.pi/agent/context-intel.jsonc or <cwd>/.pi/context-intel.jsonc
 */

import { loadConfigOrDefault } from "../../shared/pi-config.js";
import { z } from "zod";
import { DEFAULT_CONFIG, type ContextIntelConfig } from "./types.js";

const ConfigSchema = z.object({
  enabled: z.boolean().optional(),
  pruning: z
    .object({
      enabled: z.boolean().optional(),
      keepRecentCount: z.number().int().positive().optional(),
      rules: z.array(z.string()).optional(),
    })
    .optional(),
  memory: z
    .object({
      dbPath: z.string().optional(),
      lessonInjection: z.enum(["all", "selective"]).optional(),
      autoConsolidate: z.boolean().optional(),
      autoConsolidateMinMessages: z.number().int().positive().optional(),
    })
    .optional(),
  automation: z
    .object({
      autoCompactThreshold: z.number().min(0).max(100).optional(),
      autoCompactEnabled: z.boolean().optional(),
      autoRecapEnabled: z.boolean().optional(),
      autoConsolidateEnabled: z.boolean().optional(),
      autoAdviseEnabled: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Load context-intel config from JSONC file, merging with defaults.
 */
export function loadContextIntelConfig(): ContextIntelConfig {
  try {
    return loadConfigOrDefault({
      filename: "context-intel.jsonc",
      schema: ConfigSchema,
      defaults: DEFAULT_CONFIG,
    });
  } catch {
    // Fall back to defaults if config loading fails
    return DEFAULT_CONFIG;
  }
}

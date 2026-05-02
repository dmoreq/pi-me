/**
 * Configuration management using bunfig
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { PruningConfigWithRuleObjects, PruningConfigWithRuleRefs, PruneRule, PruningConfig } from "./types";
import { isPruneRuleObject } from "./types";
import { loadConfig as bunfigLoad } from "bunfig";
import { getRule, getRuleNames } from "./registry";

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PruningConfigWithRuleRefs = {
	enabled: true,
	debug: true,
	rules: ["deduplication", "superseded-writes", "error-purging", "tool-pairing", "recency"],
	keepRecentCount: 10,
};

/**
 * Load configuration from extension settings, files, or defaults
 * Priority (highest to lowest):
 * 1. CLI flags (--cp-enabled, --cp-debug)
 * 2. Config file in current directory (cp.config.ts, etc.)
 * 3. Config file in home directory (~/.cprc)
 * 4. Default configuration
 */
export async function loadConfig(pi: ExtensionAPI): Promise<PruningConfigWithRuleObjects> {
	// bunfig automatically searches for config files in cwd and home directory
	// It supports: cp.config.{ts,js,json,toml,yaml}, .cprc{,.json,.toml,.yaml}
	// and package.json with "cp" key
	const config = await bunfigLoad<PruningConfigWithRuleRefs>({
		name: "context-pruning",
		cwd: process.cwd(),
		defaultConfig: DEFAULT_CONFIG,
		checkEnv: true, // Allow Context Pruning_ENABLED, Context Pruning_DEBUG, etc.
	});

	// Apply flag overrides (highest priority)
	const enabled = pi.getFlag("--cp-enabled");
	const debug = pi.getFlag("--cp-debug");

	// Filter out invalid rules
	const availableRuleNames = getRuleNames();

	const invalidRuleNames: string[] = [];

	const rules: PruneRule[] = config.rules
		.filter((rule) => {
			if (isPruneRuleObject(rule)) {
				return true; // Keep non-string rules (custom rule objects)
			}
			if (typeof rule === 'string' && availableRuleNames.includes(rule)) {
				return true; // Valid rule name
			}
			invalidRuleNames.push(typeof rule === 'string' ? rule : JSON.stringify(rule));
			return false; // Remove invalid rule names
		})
		.map((rule) => {
			if (typeof rule === "string") {
				return getRule(rule)!; // Non-null due to filtering above
			}
			return rule;
			// convert string rule name to rule object
		})


	if (enabled !== undefined) {
		config.enabled = enabled as boolean;
	}
	if (debug !== undefined) {
		config.debug = debug as boolean;
	}

	// Log invalid rules if debug is enabled
	if (config.debug && invalidRuleNames.length > 0) {
		console.warn(`[context-pruning] Warning: The following configured rules are invalid and will be ignored: ${invalidRuleNames.join(", ")}`);
	}

	return {
		...config,
		rules,
	}
}

/**
 * Get default configuration (useful for testing or displaying defaults)
 */
export function getDefaultConfig(): PruningConfig {
	return { ...DEFAULT_CONFIG };
}


/**
 * Generate sample configuration file content
 * Used by the init command to create cp.config.ts
 */
export function generateConfigFileContent(options?: { simplified?: boolean }): string {
	const simplified = options?.simplified ?? false;

	if (simplified) {
		return `/**
 * Context Pruning Configuration
 * 
 * Place this file as:
 * - ./cp.config.ts (project-specific)
 * - ~/.cprc (user-wide)
 */

import type { PruningConfig } from "@mariozechner/pi-me/session-lifecycle/context-pruning/types";

export default {
	enabled: true,
	debug: false,
	rules: ["deduplication", "superseded-writes", "error-purging", "tool-pairing", "recency"],
	keepRecentCount: 10,
} satisfies PruningConfig;
`;
	}

	return `/**
 * Context Pruning Configuration
 * 
 * This file configures the context-pruning extension for intelligent context pruning.
 * 
 * Place this file as:
 * - ./cp.config.ts (project-specific configuration)
 * - ~/.cprc (user-wide configuration)
 * 
 * All fields are optional - defaults will be used for missing values.
 */

import type { PruningConfig } from "@mariozechner/pi-me/session-lifecycle/context-pruning/types";

export default {
	// Enable/disable Context Pruning entirely
	enabled: true,

	// Enable debug logging to see what gets pruned
	debug: false,

	// Rules to apply (in order of execution)
	// Available built-in rules:
	// - "deduplication": Remove duplicate tool outputs
	// - "superseded-writes": Remove older file versions
	// - "error-purging": Remove resolved errors
	// - "tool-pairing": Preserve tool_use/tool_result pairing (CRITICAL)
	// - "recency": Always keep recent messages
	rules: [
		"deduplication",
		"superseded-writes",
		"error-purging",
		"tool-pairing",
		"recency",
	],

	// Number of recent messages to always keep (for recency rule)
	keepRecentCount: 10,
} satisfies PruningConfig;
`;
}

/**
 * Write configuration file to the specified path
 * 
 * @param path - Full path where to write the config file
 * @param options - Options for file generation
 * @returns Promise that resolves when file is written
 */
export async function writeConfigFile(
	path: string,
	options?: { force?: boolean; simplified?: boolean }
): Promise<void> {
	const fs = await import("fs/promises");
	const force = options?.force ?? false;

	// Check if file already exists
	if (!force) {
		try {
			await fs.access(path);
			throw new Error("Config file already exists. Use force option to overwrite.");
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				throw error;
			}
			// File doesn't exist, proceed
		}
	}

	const content = generateConfigFileContent(options);
	await fs.writeFile(path, content, "utf-8");
}

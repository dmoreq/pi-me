/**
 * Pi-DCP: Dynamic Context Pruning Extension (for pi-me)
 *
 * Zero-config, auto-pruning extension for pi-me.
 * Intelligently removes duplicate/obsolete messages to optimize token usage.
 *
 * Hooks:
 * - "context" event: prunes messages before each LLM call
 * - "session_start" event: shows status on session start
 *
 * Status widget:
 * - Shows "DCP: {pruned}/{total}" in the TUI footer (matches token-rate/tab-status pattern)
 *
 * Commands:
 * - /dcp-stats    — Show detailed pruning statistics
 * - /dcp-debug    — Toggle debug logging
 * - /dcp-toggle   — Enable/disable pruning
 * - /dcp-recent N — Set recency threshold
 * - /dcp-init     — Generate a config file
 * - /dcp-logs     — View extension logs
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { StatsTracker } from "./types";
import { loadConfig } from "./config";
import { createContextEventHandler } from "./events/context";
import { createSessionStartEventHandler } from "./events/session-start";
import { getLogger, LogLevel } from "./logger";

// Register all built-in rules on import
import { registerRule, getAllRules } from "./registry";
import { deduplicationRule } from "./rules/deduplication";
import { supersededWritesRule } from "./rules/superseded-writes";
import { errorPurgingRule } from "./rules/error-purging";
import { toolPairingRule } from "./rules/tool-pairing";
import { recencyRule } from "./rules/recency";

// Command factories
import { createStatsCommand } from "./cmds/stats";
import { createDebugCommand } from "./cmds/debug";
import { createToggleCommand } from "./cmds/toggle";
import { createRecentCommand } from "./cmds/recent";
import { createInitCommand } from "./cmds/init";
import { dcpLogsCommand } from "./cmds/logs";

// Register in order they should typically be applied
registerRule(deduplicationRule);
registerRule(supersededWritesRule);
registerRule(errorPurgingRule);
// Tool-pairing MUST run before recency to ensure pairs are intact
registerRule(toolPairingRule);
// Recency should be LAST to override other decisions
registerRule(recencyRule);

const STATUS_KEY = "dcp-stats";

export default async function (pi: ExtensionAPI) {
	const config = await loadConfig(pi);

	// Initialize logger with config-based settings
	const logger = getLogger({
		minLevel: config.debug ? LogLevel.DEBUG : LogLevel.INFO,
		enableConsole: false,
	});

	logger.info("pi-dcp extension loaded", {
		enabled: config.enabled,
		debug: config.debug,
		rules: config.rules.length,
	});

	// Track pruning stats across session (used internally by context handler)
	const statsTracker: StatsTracker = {
		totalPruned: 0,
		totalProcessed: 0,
	};

	const updateStatusBar = (ctx: { hasUI: boolean; ui: { setStatus: (key: string, text?: string) => void; theme: any } }) => {
		if (!ctx.hasUI) return;
		const { totalPruned, totalProcessed } = statsTracker;
		if (totalProcessed === 0) {
			ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", "DCP: --"));
		} else {
			const pct = Math.round((totalPruned / totalProcessed) * 100);
			ctx.ui.setStatus(STATUS_KEY, `DCP: ${totalPruned}/${totalProcessed} (${pct}%)`);
		}
	};

	// Create context event handler that also refreshes the status bar
	const contextHandler = createContextEventHandler({ config, statsTracker });

	pi.on("context", async (event, ctx) => {
		const result = await contextHandler(event, ctx);
		// Update status bar after pruning
		updateStatusBar(ctx);
		return result;
	});

	pi.on("session_start", async (event, ctx) => {
		// Show initial status
		if (ctx.hasUI) {
			updateStatusBar(ctx);
		}
		// Show welcome notification
		const sessionHandler = createSessionStartEventHandler({ config });
		sessionHandler(event, ctx);
	});

	// Only register commands and logger if enabled
	if (!config.enabled) {
		return;
	}

	const ruleCount = getAllRules().length;

	// Register commands
	pi.registerCommand("dcp-stats", createStatsCommand(statsTracker, ruleCount));
	pi.registerCommand("dcp-debug", createDebugCommand(config));
	pi.registerCommand("dcp-toggle", createToggleCommand(config));
	pi.registerCommand("dcp-recent", createRecentCommand(config));
	pi.registerCommand("dcp-init", createInitCommand());
	pi.registerCommand("dcp-logs", dcpLogsCommand);

	// Clean up status on shutdown
	pi.on("session_shutdown", async (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
		}
	});
}

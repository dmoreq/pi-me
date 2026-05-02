/**
 * Context Pruning Debug Command
 * 
 * Toggle debug logging to see what gets pruned.
 */

import type { CommandDefinition, PruningConfig } from "../types";

export function createDebugCommand(config: PruningConfig): CommandDefinition {
	return {
		description: "Toggle Context Pruning debug logging",
		handler: async (args, ctx) => {
			config.debug = !config.debug;
			ctx.ui.notify(`Context Pruning debug: ${config.debug ? "ON" : "OFF"}`, "info");
		},
	};
}

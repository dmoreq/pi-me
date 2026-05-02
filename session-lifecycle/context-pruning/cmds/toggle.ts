/**
 * Context Pruning Toggle Command
 * 
 * Enable or disable the Context Pruning extension.
 */

import type { CommandDefinition, PruningConfig } from "../types";

export function createToggleCommand(config: PruningConfig): CommandDefinition {
	return {
		description: "Toggle Context Pruning on/off",
		handler: async (args, ctx) => {
			config.enabled = !config.enabled;
			ctx.ui.notify(`Context Pruning: ${config.enabled ? "ENABLED" : "DISABLED"}`, "info");
		},
	};
}

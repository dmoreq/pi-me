/**
 * pi-me: permission-gate — Dangerous command interception.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type DangerPattern, DEFAULT_DANGER_PATTERNS } from "./patterns";

export type { DangerPattern } from "./patterns";
export { DEFAULT_DANGER_PATTERNS } from "./patterns";

export interface PermissionGateOptions {
	patterns?: DangerPattern[];
	blockInNonInteractive?: boolean;
}

export function createPermissionGate(options: PermissionGateOptions = {}): (pi: ExtensionAPI) => void {
	const patterns = options.patterns ?? DEFAULT_DANGER_PATTERNS;
	const blockInNonInteractive = options.blockInNonInteractive ?? true;

	return (pi: ExtensionAPI) => {
		pi.on("tool_call", async (event, ctx) => {
			if (event.toolName !== "bash") return;

			const command = (event.input as { command?: string }).command;
			if (!command || typeof command !== "string") return;

			const matches = patterns.filter((p) => p.pattern.test(command));
			if (matches.length === 0) return;

			if (!ctx.hasUI && blockInNonInteractive) {
				const categories = [...new Set(matches.map((m) => m.category))].join(", ");
				return {
					block: true,
					reason: `Dangerous command blocked (${categories}). No UI available for confirmation.`,
				};
			}

			if (!ctx.hasUI) return;

			const matchDetails = matches
				.map((m) => `  [${m.category}] ${m.description}`)
				.join("\n");

			const choice = await ctx.ui.select(
				`Dangerous command detected:\n\n  ${command}\n\nReasons:\n${matchDetails}\n\nAllow execution?`,
				["Block", "Allow once", "Always allow for this session"],
			);

			if (choice === "Block" || choice === undefined) {
				return { block: true, reason: "Blocked by user" };
			}
		});
	};
}

export default createPermissionGate();

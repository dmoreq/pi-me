/**
 * pi-me: auto-compact — Automatic context compaction.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export interface AutoCompactOptions {
	thresholdPercent?: number;
	minMessagesBeforeCompact?: number;
	customInstructions?: string;
}

export function createAutoCompact(options: AutoCompactOptions = {}): (pi: ExtensionAPI) => void {
	const thresholdPercent = options.thresholdPercent ?? 80;
	const minMessagesBeforeCompact = options.minMessagesBeforeCompact ?? 10;
	const customInstructions = options.customInstructions;

	return (pi: ExtensionAPI) => {
		let messageCount = 0;
		let compactionInProgress = false;

		pi.on("message_start", () => {
			messageCount++;
		});

		pi.on("session_start", () => {
			messageCount = 0;
			compactionInProgress = false;
		});

		pi.on("session_compact", () => {
			compactionInProgress = false;
		});

		pi.on("turn_end", async (_event, ctx) => {
			if (compactionInProgress) return;
			if (messageCount < minMessagesBeforeCompact) return;

			const usage = ctx.getContextUsage();
			if (!usage?.tokens || !usage.contextWindow) return;

			const usedPercent = (usage.tokens / usage.contextWindow) * 100;
			if (usedPercent < thresholdPercent) return;

			compactionInProgress = true;

			if (ctx.hasUI) {
				ctx.ui.notify(
					`Context at ${Math.round(usedPercent)}% — compacting...`,
					"warning",
				);
			}

			ctx.compact({
				customInstructions: customInstructions ?? "Focus on recent changes, key decisions, and unresolved items.",
				onComplete: () => { compactionInProgress = false; },
				onError: () => { compactionInProgress = false; },
			});
		});
	};
}

export default createAutoCompact();

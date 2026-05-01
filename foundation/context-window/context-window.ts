/**
 * pi-me: context-window — Context usage monitor widget.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export interface ContextWindowOptions {
	warnThresholdPercent?: number;
	criticalThresholdPercent?: number;
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return String(n);
}

function buildBar(used: number, total: number, width: number, warnAt: number, critAt: number): string {
	const ratio = Math.min(1, total > 0 ? used / total : 0);
	const filled = Math.max(1, Math.floor(ratio * width));
	const empty = width - filled;

	let barChar: string;
	if (ratio >= critAt) barChar = "█";
	else if (ratio >= warnAt) barChar = "▓";
	else barChar = "░";

	return barChar.repeat(filled) + " ".repeat(empty);
}

function getLevel(ratio: number, warnAt: number, critAt: number): "info" | "warning" | "error" {
	if (ratio >= critAt) return "error";
	if (ratio >= warnAt) return "warning";
	return "info";
}

export function createContextWindow(options: ContextWindowOptions = {}): (pi: ExtensionAPI) => void {
	const warnThreshold = options.warnThresholdPercent ?? 70;
	const criticalThreshold = options.criticalThresholdPercent ?? 90;
	const warnAt = warnThreshold / 100;
	const critAt = criticalThreshold / 100;

	return (pi: ExtensionAPI) => {
		pi.on("turn_end", async (_event, ctx) => {
			if (!ctx.hasUI) return;
			const usage = ctx.getContextUsage();
			if (!usage?.tokens || !usage.contextWindow) {
				ctx.ui.setWidget("context", ["", "  Context: calculating..."]);
				return;
			}

			const ratio = usage.tokens / usage.contextWindow;
			const pct = Math.round(ratio * 100);
			const level = getLevel(ratio, warnAt, critAt);
			const bar = buildBar(usage.tokens, usage.contextWindow, 20, warnAt, critAt);

			ctx.ui.setWidget("context", [
				"",
				`  Context: [${bar}] ${pct}% (${formatTokens(usage.tokens)}/${formatTokens(usage.contextWindow)})`,
			]);

			if (level !== "info") {
				ctx.ui.setStatus("context-warn", `Context: ${pct}% used`);
				if (level === "error") {
					ctx.ui.notify(
						`Context at ${pct}% — consider compacting with /compact`,
						"error",
					);
				}
			}
		});

		pi.on("session_start", async (_event, ctx) => {
			if (ctx.hasUI) {
				ctx.ui.setWidget("context", ["", "  Context: monitoring..."]);
			}
		});

		pi.on("session_shutdown", async (_event, ctx) => {
			if (ctx.hasUI) {
				ctx.ui.setWidget("context", []);
				ctx.ui.setStatus("context-warn", "");
			}
		});
	};
}

export default createContextWindow();

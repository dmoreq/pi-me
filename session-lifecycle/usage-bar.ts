/**
 * Usage Bar Extension - Extension Glue
 * Core data processing in usage-bar-core.ts
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { UsageComponent } from "./usage-bar-core.js";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("usage", {
		description: "Show AI provider usage statistics",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Usage requires interactive mode", "error");
				return;
			}

			const modelRegistry = ctx.modelRegistry;
			await ctx.ui.custom((tui, theme, _kb, done) => {
				return new UsageComponent(tui, theme, () => done(), modelRegistry);
			});
		},
	});
}

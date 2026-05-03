/**
 * core-tools — Umbrella entry point.
 *
 * Profile: dev loads subset A; full loads subset A + subset B.
 * Subset A: todo, plan-mode, plan-tracker, memory, formatter, thinking-steps,
 *           edit-session, clipboard, preset, code-actions, read-guard.
 * Subset B: sub-pi, subagent, ralph-loop, web-search, file-collector,
 *           ast-grep, code-review, autofix.
 *
 * Imports real implementation files directly (wrappers deleted in Phase 1.5).
 * Clipboard inlined (~94 lines, OSC52 tool).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readProfile } from "../shared/profile.js";

// ── Subset A — dev + full ────────────────────────────────────────────────

import todo from "./todo/index.ts";
import planMode from "./plan-mode.ts";
import planTracker from "./plan-tracker/plan-tracker.ts";
import memory from "./memory/index.ts";
import formatter from "./formatter/extensions/index.ts";
import thinkingSteps from "./thinking-steps/thinking-steps.ts";
import editSession from "./edit-session/extensions/edit-session-in-place.ts";
import preset from "./preset/index.ts";
import codeActions from "./code-actions/index.ts";
import readGuard from "./read-guard/index.ts";

// ── Subset B — full only ─────────────────────────────────────────────────

import subPi from "./sub-pi/index.ts";
import subagent from "./subagent/extension/index.ts";
import ralphLoop from "./ralph-loop/ralph-loop.ts";
import webSearch from "./web-search.ts";
import fileCollector from "./file-collector/index.ts";
import astGrepTools from "./ast-grep-tool/index.ts";
import codeReview from "./code-review/index.ts";
import autofix from "./autofix/index.ts";

// ── Inlined: clipboard ───────────────────────────────────────────────────

function toBase64(text: string): string {
	return Buffer.from(text, "utf-8").toString("base64");
}

function copyToClipboard(text: string): void {
	const base64Text = toBase64(text);
	const osc52 = `\x1b]52;c;${base64Text}\x07`;
	process.stdout.write(osc52);
}

function clipboardExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "copy_to_clipboard",
		label: "Copy to Clipboard",
		description:
			"Copy text to the user's system clipboard. Use this when the user asks you to " +
			"put something in their clipboard, write a draft reply to clipboard, or copy any " +
			"generated text for easy pasting. The text will be available for pasting immediately.",
		parameters: Type.Object({
			text: Type.String({
				description: "The text to copy to the clipboard",
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { text } = params as { text: string };

			if (!text || text.trim().length === 0) {
				return {
					content: [{ type: "text", text: "Error: No text provided to copy." }],
					details: { success: false, error: "empty_text" },
				};
			}

			try {
				copyToClipboard(text);

				const preview = text.length > 100 ? `${text.slice(0, 100)}...` : text;
				const charCount = text.length;

				if (ctx.hasUI) {
					ctx.ui.notify(`Copied ${charCount} characters to clipboard`, "info");
				}

				return {
					content: [
						{
							type: "text",
							text: `Successfully copied ${charCount} characters to clipboard.\n\nPreview:\n${preview}`,
						},
					],
					details: {
						success: true,
						characterCount: charCount,
						preview,
					},
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				return {
					content: [{ type: "text", text: `Failed to copy to clipboard: ${errorMessage}` }],
					details: { success: false, error: errorMessage },
				};
			}
		},
	});
}

// ── Umbrella default export ──────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile === "minimal") return;

	// Subset A — dev + full
	todo(pi);
	planMode(pi);
	planTracker(pi);
	memory(pi);
	formatter(pi);
	thinkingSteps(pi);
	editSession(pi);
	clipboardExtension(pi);
	preset(pi);
	codeActions(pi);
	readGuard(pi);

	// Subset B — full only
	if (profile === "full") {
		subPi(pi);
		subagent(pi);
		ralphLoop(pi);
		webSearch(pi);
		fileCollector(pi);
		astGrepTools(pi);
		codeReview(pi);
		autofix(pi);
	}
}

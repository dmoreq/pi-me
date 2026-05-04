/**
 * Clipboard — copy text to system clipboard via OSC52 escape sequences.
 * Extracted from core-tools/index.ts for independent testability.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

function toBase64(text: string): string {
	return Buffer.from(text, "utf-8").toString("base64");
}

export function copyToClipboard(text: string): void {
	process.stdout.write(`\x1b]52;c;${toBase64(text)}\x07`);
}

export function registerClipboard(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "copy_to_clipboard",
		label: "Copy to Clipboard",
		description:
			"Copy text to the user's system clipboard. Use this when the user asks you to " +
			"put something in their clipboard, write a draft reply to clipboard, or copy any " +
			"generated text for easy pasting. The text will be available for pasting immediately.",
		parameters: Type.Object({
			text: Type.String({ description: "The text to copy to the clipboard" }),
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
				if (ctx.hasUI) ctx.ui.notify(`Copied ${charCount} characters to clipboard`, "info");
				return {
					content: [{ type: "text", text: `Successfully copied ${charCount} characters to clipboard.\n\nPreview:\n${preview}` }],
					details: { success: true, characterCount: charCount, preview },
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				return {
					content: [{ type: "text", text: `Failed to copy to clipboard: ${msg}` }],
					details: { success: false, error: msg },
				};
			}
		},
	});
}
